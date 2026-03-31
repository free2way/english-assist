/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import Markdown from 'react-markdown';
import { 
  LayoutDashboard, 
  Mic2, 
  BookOpen, 
  BarChart3, 
  Settings, 
  Bell, 
  Search,
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Play,
  Clock,
  Star,
  Trophy,
  MessageSquare,
  Headphones,
  Zap,
  Check,
  X,
  RotateCw,
  Volume2,
  Lock,
  User,
  Eye,
  EyeOff,
  LogOut,
  ShieldCheck,
  GraduationCap,
  PencilLine,
  ChevronDown,
  AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ChallengeModule } from './components/ChallengeModule';
import { DictationModule } from './components/DictationModule';
import { ManagementModule } from './components/ManagementModule';
import { StatCard } from './components/StatCard';
import { Statistics } from './components/Statistics';
import { createPronunciationAssessmentSession, recognizeSpeechFromMicrophone, speakTextWithAzure } from './lib/azureSpeech';
import { cn } from './lib/utils';
import { TextbookModule } from './components/textbook/TextbookModule';
import {
  createTaskId,
  getLessonOutcomeLabel,
  getPronunciationHint,
  getStageLabel,
  normalizeGrammarAnswer,
} from './components/textbook/helpers';

// --- Mock Data ---
const MOCK_TASKS = [
  { id: '1', title: '短文朗读：The Future of AI', type: 'reading', category: 'exam', status: 'completed', time: '19:00 - 19:30', description: '中考模拟题，重点练习连读与重音', score: 92 },
  { id: '2', title: 'AI 情景对话：School Life', type: 'dialogue', category: 'ai', status: 'ongoing', time: '19:30 - 20:00', description: '与 AI 外教讨论你的理想学校', score: 0 },
  { id: '3', title: '视频配音：Zootopia Clip', type: 'dubbing', category: 'fun', status: 'pending', time: '20:00 - 20:30', description: '模仿 Judy 的语气，练习情感表达', score: 0 },
  { id: '4', title: '听后转述：A Trip to London', type: 'retelling', category: 'exam', status: 'pending', time: '20:30 - 21:00', description: '高考模拟题，练习信息提取与整合', score: 0 },
];

const CHART_DATA = [
  { name: '11/16', tasks: 10, completed: 2 },
  { name: '11/17', tasks: 24, completed: 3 },
  { name: '11/18', tasks: 18, completed: 5 },
  { name: '11/19', tasks: 22, completed: 4 },
  { name: '11/20', tasks: 5, completed: 1 },
  { name: '11/21', tasks: 12, completed: 6 },
  { name: '11/22', tasks: 15, completed: 8 },
];

const PIE_DATA = [
  { name: '口语', value: 45, color: '#3b82f6' },
  { name: '听力', value: 30, color: '#8b5cf6' },
  { name: '词汇', value: 25, color: '#10b981' },
];

const GRADES = ['7年级', '8年级', '9年级', '10年级', '11年级', '12年级'];
const SEMESTERS = ['上学期', '下学期'];

interface AppUser {
  id: string;
  username: string;
  grade: string;
  semester: string;
  school: string;
  role: 'admin' | 'user';
}

interface AIConfig {
  model: string;
  apiKey: string;
  baseURL?: string;
}

const DEFAULT_AI_CONFIG: AIConfig = {
  model: 'gpt-4o-mini',
  apiKey: '',
  baseURL: 'https://api.openai.com/v1'
};

const AI_CONFIG_STORAGE_KEY = 'ace_ai_config';
const AUTH_TOKEN_STORAGE_KEY = 'ace_auth_token';
const AUTH_SESSION_HOURS_STORAGE_KEY = 'ace_auth_session_hours';
const SESSION_DURATION_OPTIONS = [
  { value: 12, label: '12小时', description: '适合临时设备' },
  { value: 24 * 7, label: '7天', description: '推荐' },
  { value: 24 * 30, label: '30天', description: '记住登录' },
];

const getAuthToken = () => localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);

const setAuthToken = (token: string | null) => {
  if (token) {
    localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, token);
    return;
  }
  localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
};

const getSavedSessionHours = () => {
  const rawValue = localStorage.getItem(AUTH_SESSION_HOURS_STORAGE_KEY);
  const parsed = rawValue ? Number(rawValue) : NaN;
  if (SESSION_DURATION_OPTIONS.some((option) => option.value === parsed)) {
    return parsed;
  }
  return 24 * 7;
};

const setSavedSessionHours = (hours: number) => {
  localStorage.setItem(AUTH_SESSION_HOURS_STORAGE_KEY, String(hours));
};

const apiFetch = async <T,>(path: string, init: RequestInit = {}): Promise<T> => {
  const token = getAuthToken();
  const headers = new Headers(init.headers);
  if (!headers.has('Content-Type') && init.body) {
    headers.set('Content-Type', 'application/json');
  }
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(path, {
    ...init,
    headers,
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || '请求失败');
  }

  return data as T;
};

interface VocabItem {
  id: string;
  word: string;
  phonetic: string;
  definition: string;
  example: string;
}

interface SentenceItem {
  id: string;
  text: string;
  translation: string;
}

interface SpeechTokenResponse {
  token: string;
  region: string;
  expiresInSeconds: number;
}

interface AzurePronunciationWord {
  word: string;
  accuracyScore: number;
  errorType: string;
}

interface AzurePronunciationResult {
  pronunciationScore: number;
  accuracyScore: number;
  fluencyScore: number;
  completenessScore: number;
  words: AzurePronunciationWord[];
  feedback: string[];
}

type LessonStageKey = 'preview' | 'reading' | 'dictation' | 'speaking';
type TextbookPageKey = 'overview' | 'preview' | 'sentences' | 'grammar' | 'reading-practice';
type AppTabKey =
  | 'dashboard'
  | 'textbook-overview'
  | 'textbook-preview'
  | 'textbook-sentences'
  | 'textbook-grammar'
  | 'textbook-reading'
  | 'dictation'
  | 'tutor'
  | 'stats'
  | 'profile'
  | 'challenge'
  | 'manage'
  | 'exam';
type MistakeCategory = 'vocab' | 'dictation' | 'speaking' | 'grammar';
type MistakeReason =
  | 'unknown_vocab'
  | 'pronunciation'
  | 'missing_word'
  | 'spelling'
  | 'punctuation'
  | 'sentence_structure'
  | 'too_short'
  | 'off_topic'
  | 'fluency'
  | 'grammar_rule'
  | 'word_order'
  | 'sentence_judgement';

interface LessonStage {
  key: LessonStageKey;
  title: string;
  description: string;
  estimatedMinutes: number;
}

interface GrammarExample {
  text: string;
  translation: string;
}

interface GrammarExercise {
  id: string;
  type: 'choice' | 'fill' | 'judge' | 'correction' | 'reorder';
  prompt: string;
  question: string;
  answer: string;
  explanation: string;
  options?: string[];
  clue?: string;
  tokens?: string[];
}

interface GrammarModule {
  id: string;
  title: string;
  focus: string;
  summary: string;
  tips: string[];
  examples: GrammarExample[];
  exercises: GrammarExercise[];
  sourceType?: 'configured' | 'generated';
}

interface UnitBundle {
  id: string;
  textbookId: string;
  grade: string;
  semester: string;
  unit: string;
  title: string;
  summary?: string;
  passage?: string;
  vocab: VocabItem[];
  sentences: SentenceItem[];
  stages: LessonStage[];
  phrases?: Array<{ id: string; phrase: string; meaning: string; example: string; sortOrder: number }>;
  patterns?: Array<{ id: string; text: string; translation: string; kind: 'sentence' | 'pattern'; sortOrder: number }>;
  grammar: GrammarModule;
}

interface TextbookSummary {
  id: string;
  publisher: string;
  series: string;
  title: string;
  stage: string;
  grade: string;
  semester: string;
  volume: string;
  description: string;
}

interface TextbookContent extends TextbookSummary {
  units: Array<{
    id: string;
    unitCode: string;
    title: string;
    summary: string;
    passage: string;
    sortOrder: number;
    lessons: Array<{
      id: string;
      stageKey: LessonStageKey;
      title: string;
      objective: string;
      sortOrder: number;
    }>;
    vocab: Array<VocabItem & { sortOrder: number }>;
    sentences: Array<SentenceItem & { sortOrder: number }>;
    phrases: Array<{ id: string; phrase: string; meaning: string; example: string; sortOrder: number }>;
    patterns: Array<{ id: string; text: string; translation: string; kind: 'sentence' | 'pattern'; sortOrder: number }>;
  }>;
}

interface MistakeRecord {
  id: string;
  unitId: string;
  category: MistakeCategory;
  stage: LessonStageKey;
  prompt: string;
  expected: string;
  answer: string;
  translation?: string;
  reason?: MistakeReason;
  hint?: string;
  createdAt: string;
}

interface DailyCheckinRecord {
  date: string;
  completedTaskIds: string[];
  recommendationIds: string[];
  challengeCompleted: boolean;
  checkedIn: boolean;
}

interface ChallengeAttempt {
  id: string;
  unitId: string;
  score: number;
  total: number;
  completedAt: string;
}

interface PronunciationAssessmentRecord {
  id: string;
  unitId: string;
  sentenceId: string;
  sentenceText: string;
  pronunciationScore: number;
  accuracyScore: number;
  fluencyScore: number;
  completenessScore: number;
  weakWords: string[];
  createdAt: string;
}

interface StudyState {
  currentUnitId: string;
  currentStage: LessonStageKey;
  completedTaskIds: string[];
  masteredWordIds: string[];
  followedSentenceIds: string[];
  completedGrammarQuestionIds: string[];
  mistakes: MistakeRecord[];
  dailyCheckins: DailyCheckinRecord[];
  challengeAttempts: ChallengeAttempt[];
  pronunciationAssessments: PronunciationAssessmentRecord[];
}

interface RecommendationItem {
  id: string;
  title: string;
  description: string;
  stage: LessonStageKey;
  priority: 'high' | 'medium' | 'low';
}

interface ReviewPackItem {
  id: string;
  title: string;
  summary: string;
  reasonLabel: string;
  stage: LessonStageKey;
  mistake: MistakeRecord;
}

const STUDY_STATE_STORAGE_PREFIX = 'ace_study_state';
const STAGE_META: LessonStage[] = [
  { key: 'preview', title: '课时1 词汇预习', description: '先认词义和发音，完成单词预热。', estimatedMinutes: 10 },
  { key: 'reading', title: '课时2 重点句跟读', description: '围绕重点句做跟读和朗读模仿。', estimatedMinutes: 12 },
  { key: 'dictation', title: '课时3 听写巩固', description: '通过单词和句子听写查漏补缺。', estimatedMinutes: 10 },
  { key: 'speaking', title: '课时4 口语表达', description: '围绕本单元话题做输出和问答。', estimatedMinutes: 8 },
];
const UNIT_TITLE_MAP: Record<string, string> = {
  '7年级-上学期-Unit 1': 'My classmates',
  '7年级-上学期-Unit 2': 'My family',
  '7年级-上学期-Unit 3': 'My school',
  '7年级-上学期-Unit 4': 'Healthy food',
  '7年级-上学期-Unit 5': 'My school day',
  '7年级-上学期-Unit 6': 'A trip to the zoo',
  '7年级-下学期-Unit 1': 'Lost and found',
  '7年级-下学期-Unit 2': 'What can you do?',
};

const getStudyStorageKey = (username: string, textbookId: string) => `${STUDY_STATE_STORAGE_PREFIX}:${username}:${textbookId}`;
const getSelectedTextbookStorageKey = (username: string) => `ace_selected_textbook:${username}`;

const buildGrammarExamples = (
  patterns: Array<{ text: string; translation: string }> | undefined,
  sentences: SentenceItem[]
): GrammarExample[] => {
  const sources = (patterns && patterns.length > 0 ? patterns : sentences).slice(0, 2);
  return sources.map((item) => ({
    text: item.text,
    translation: item.translation,
  }));
};

const buildBrokenSentence = (sentence: string) => {
  if (sentence.includes(' are ')) return sentence.replace(' are ', ' is ');
  if (sentence.includes(' is ')) return sentence.replace(' is ', ' are ');
  if (sentence.includes(' can ')) return sentence.replace(' can ', ' can to ');
  if (sentence.includes(' have got ')) return sentence.replace(' have got ', ' has got ');
  if (sentence.includes(' has got ')) return sentence.replace(' has got ', ' have got ');
  if (sentence.includes(' There are ')) return sentence.replace('There are', 'There is');
  if (sentence.includes(' There is ')) return sentence.replace('There is', 'There are');

  const words = sentence.split(/\s+/);
  if (words.length > 3) {
    const swapped = [...words];
    [swapped[0], swapped[1]] = [swapped[1], swapped[0]];
    return swapped.join(' ');
  }

  return `${sentence} not`;
};

const scrambleTokens = (sentence: string) => {
  const tokens = sentence
    .replace(/[.,!?]/g, '')
    .split(/\s+/)
    .filter(Boolean);
  if (tokens.length < 4) return tokens.slice().reverse();
  return [...tokens.slice(2), ...tokens.slice(0, 2)];
};

const buildExtendedGrammarExercises = (
  unitId: string,
  examples: GrammarExample[],
  startIndex: number
): GrammarExercise[] => {
  const firstExample = examples[0]?.text || 'I am from China.';
  const secondExample = examples[1]?.text || firstExample;
  const broken = buildBrokenSentence(firstExample);

  return [
    {
      id: `${unitId}:grammar:${startIndex}`,
      type: 'judge',
      prompt: '判断正误',
      question: `判断下面句子是否正确：${broken}`,
      answer: '错误',
      options: ['正确', '错误'],
      explanation: '先判断句子是否自然，再回头定位主语、动词或词序哪里不对。',
    },
    {
      id: `${unitId}:grammar:${startIndex + 1}`,
      type: 'correction',
      prompt: '病句改错',
      question: broken,
      answer: firstExample,
      clue: '把错误句子改成正确的完整句。',
      explanation: '改错题最重要的是把整句改通顺，而不只是改单个单词。',
    },
    {
      id: `${unitId}:grammar:${startIndex + 2}`,
      type: 'reorder',
      prompt: '连词成句',
      question: '请把下面这些词组成一个正确句子。',
      answer: secondExample,
      tokens: scrambleTokens(secondExample),
      clue: '先找主语和动词，再补足其他成分。',
      explanation: '连词成句时，优先确定“谁做什么”，再安排时间、地点等补充信息。',
    },
  ];
};

const buildKeyPatternExercises = (unit: {
  id: string;
  title: string;
  patterns?: Array<{ text: string; translation: string }>;
  sentences: SentenceItem[];
}): GrammarExercise[] => {
  const first = unit.patterns?.[0] || unit.sentences[0];
  const second = unit.patterns?.[1] || unit.sentences[1] || first;
  return [
    {
      id: `${unit.id}:grammar:1`,
      type: 'choice',
      prompt: '识别本单元常用句型',
      question: '下面哪一句最符合本单元正在练习的重点表达？',
      answer: first?.text || '',
      options: [first?.text || '', second?.translation || '', unit.title, second?.text || ''],
      explanation: '先抓住课文里反复出现的句型，再迁移到口语和写作里。',
    },
    {
      id: `${unit.id}:grammar:2`,
      type: 'fill',
      prompt: '补全重点表达',
      question: first?.text || '',
      answer: first?.text.split(/\s+/)[0] || '',
      clue: '输入句子的第一个关键词。',
      explanation: '能准确说出句子开头，通常说明你已经记住了这个句型的发起方式。',
    },
    {
      id: `${unit.id}:grammar:3`,
      type: 'choice',
      prompt: '选择最自然的表达',
      question: `如果你要围绕 “${unit.title}” 开头表达，哪一句最自然？`,
      answer: second?.text || '',
      options: [unit.title, second?.text || '', second?.translation || '', 'I am English study.'],
      explanation: '语法训练的目标不是死记规则，而是选出自然、完整的句子。',
    },
  ];
};

const buildGrammarModule = (unit: {
  id: string;
  title: string;
  summary?: string;
  patterns?: Array<{ text: string; translation: string }>;
  sentences: SentenceItem[];
}): GrammarModule => {
  const source = `${unit.title} ${unit.summary || ''} ${(unit.patterns || []).map((item) => item.text).join(' ')}`.toLowerCase();
  const examples = buildGrammarExamples(unit.patterns, unit.sentences);

  if (source.includes('where are you from') || source.includes('years old')) {
    const exercises: GrammarExercise[] = [
      { id: `${unit.id}:grammar:1`, type: 'choice', prompt: '主谓搭配', question: 'I ___ from China.', answer: 'am', options: ['am', 'is', 'are'], explanation: '主语是 I，所以要用 am。' },
      { id: `${unit.id}:grammar:2`, type: 'choice', prompt: '问句结构', question: 'Where ___ you from?', answer: 'are', options: ['am', 'is', 'are'], explanation: '主语是 you，问句里要用 are。' },
      { id: `${unit.id}:grammar:3`, type: 'fill', prompt: '句子补全', question: 'She ___ thirteen years old.', answer: 'is', clue: '主语是 she。', explanation: 'she 是第三人称单数，所以这里填 is。' },
      ...buildExtendedGrammarExercises(unit.id, examples, 4),
    ];
    return {
      id: `${unit.id}:grammar`,
      title: '语法模块：be 动词 am / is / are',
      focus: '学会根据主语选择 am、is、are，并完成自我介绍。',
      summary: '这一单元的核心是用 be 动词介绍姓名、年龄、班级和来自哪里。先判断主语是谁，再选对 be 动词。',
      tips: ['I 搭配 am', 'he / she / it 搭配 is', 'you / we / they 搭配 are'],
      examples,
      exercises,
      sourceType: 'configured',
    };
  }

  if (source.includes('whose') || source.includes('yours')) {
    const exercises: GrammarExercise[] = [
      { id: `${unit.id}:grammar:1`, type: 'choice', prompt: '所属表达', question: 'This bag is ___.', answer: 'mine', options: ['my', 'mine', 'me'], explanation: '后面没有名词，所以要用名词性物主代词 mine。' },
      { id: `${unit.id}:grammar:2`, type: 'choice', prompt: '所属提问', question: '___ crayons are these?', answer: 'Whose', options: ['Who', 'Whose', 'Where'], explanation: '询问“谁的”要用 Whose。' },
      { id: `${unit.id}:grammar:3`, type: 'fill', prompt: '句子补全', question: 'Are these crayons ___?', answer: 'yours', clue: '后面没有名词。', explanation: '这里缺的是名词性物主代词 yours。' },
      ...buildExtendedGrammarExercises(unit.id, examples, 4),
    ];
    return {
      id: `${unit.id}:grammar`,
      title: '语法模块：物主代词',
      focus: '区分 my / your 和 mine / yours，学会表达“是谁的东西”。',
      summary: '这一单元常见的语法任务是失物招领，所以要能正确问和答“这是谁的”。',
      tips: ['形容词性物主代词后面要跟名词', '名词性物主代词可以单独使用', 'Whose ... is this? 用来询问所属'],
      examples,
      exercises,
      sourceType: 'configured',
    };
  }

  if (source.includes('can you') || source.includes('join the music club')) {
    const exercises: GrammarExercise[] = [
      { id: `${unit.id}:grammar:1`, type: 'choice', prompt: '能力表达', question: 'She can ___ the piano.', answer: 'play', options: ['plays', 'play', 'to play'], explanation: 'can 后接动词原形，所以选 play。' },
      { id: `${unit.id}:grammar:2`, type: 'choice', prompt: '一般疑问句', question: '___ you swim?', answer: 'Can', options: ['Do', 'Can', 'Are'], explanation: '询问能力时要把 can 放在句首。' },
      { id: `${unit.id}:grammar:3`, type: 'fill', prompt: '否定句', question: 'I ___ dance very well.', answer: "can't", clue: '表达“不会”。', explanation: '否定能力要用 can’t。' },
      ...buildExtendedGrammarExercises(unit.id, examples, 4),
    ];
    return {
      id: `${unit.id}:grammar`,
      title: '语法模块：情态动词 can',
      focus: '用 can / can’t 表达能力、会不会做某事和加入社团的条件。',
      summary: '这一单元会频繁出现“会不会做某事”的问答。can 后面直接接动词原形，不需要再加 to。',
      tips: ['can 后接动词原形', '否定形式是 can’t', '一般疑问句把 can 放到句首'],
      examples,
      exercises,
      sourceType: 'configured',
    };
  }

  if (source.includes('there are') || source.includes('there is')) {
    const exercises: GrammarExercise[] = [
      { id: `${unit.id}:grammar:1`, type: 'choice', prompt: '单复数判断', question: 'There ___ a big library in our school.', answer: 'is', options: ['is', 'are', 'be'], explanation: 'library 是单数，所以用 is。' },
      { id: `${unit.id}:grammar:2`, type: 'choice', prompt: '单复数判断', question: 'There ___ thirty classrooms in my school.', answer: 'are', options: ['is', 'are', 'has'], explanation: 'classrooms 是复数，所以用 are。' },
      { id: `${unit.id}:grammar:3`, type: 'fill', prompt: '句子补全', question: 'There ___ many books in the library.', answer: 'are', clue: 'many books 是复数。', explanation: '主语是复数名词 books，所以用 are。' },
      ...buildExtendedGrammarExercises(unit.id, examples, 4),
    ];
    return {
      id: `${unit.id}:grammar`,
      title: '语法模块：there is / there are',
      focus: '描述某地“有”什么，先判断后面的名词是单数还是复数。',
      summary: '介绍学校、教室、图书馆时，常用 there is / there are 来描述某处存在什么。',
      tips: ['单数名词前用 there is', '复数名词前用 there are', '句子里常搭配地点状语'],
      examples,
      exercises,
      sourceType: 'configured',
    };
  }

  if (source.includes('have got')) {
    const exercises: GrammarExercise[] = [
      { id: `${unit.id}:grammar:1`, type: 'choice', prompt: '主谓搭配', question: 'We ___ lots of apples.', answer: 'have got', options: ['has got', 'have got', 'have gets'], explanation: '主语是 We，所以用 have got。' },
      { id: `${unit.id}:grammar:2`, type: 'choice', prompt: '一般疑问句', question: '___ we got any juice?', answer: 'Have', options: ['Do', 'Have', 'Has'], explanation: '主语是 we，疑问句要用 Have 开头。' },
      { id: `${unit.id}:grammar:3`, type: 'fill', prompt: '主谓搭配', question: 'She ___ some milk at home.', answer: 'has got', clue: '主语是 she。', explanation: '第三人称单数 she 要用 has got。' },
      ...buildExtendedGrammarExercises(unit.id, examples, 4),
    ];
    return {
      id: `${unit.id}:grammar`,
      title: '语法模块：have got / has got',
      focus: '表达“有”某物，并能正确构成一般疑问句和否定句。',
      summary: '这一单元围绕食物和健康展开，常用 have got / has got 描述家里或自己拥有的食物。',
      tips: ['I / we / you / they 搭配 have got', 'he / she / it 搭配 has got', '疑问句把 have / has 提前'],
      examples,
      exercises,
      sourceType: 'configured',
    };
  }

  if (source.includes('what time') || source.includes('school starts')) {
    const exercises: GrammarExercise[] = [
      { id: `${unit.id}:grammar:1`, type: 'choice', prompt: '日常表达', question: 'School ___ at eight.', answer: 'starts', options: ['start', 'starts', 'starting'], explanation: 'School 看作单数主语，所以动词要用 starts。' },
      { id: `${unit.id}:grammar:2`, type: 'choice', prompt: '时间表达', question: 'I get up ___ seven o’clock.', answer: 'at', options: ['in', 'on', 'at'], explanation: '具体几点前通常用 at。' },
      { id: `${unit.id}:grammar:3`, type: 'fill', prompt: '一般现在时', question: 'He ___ his homework in the evening.', answer: 'does', clue: '主语是 he。', explanation: 'he 是第三人称单数，动词 do 要变成 does。' },
      ...buildExtendedGrammarExercises(unit.id, examples, 4),
    ];
    return {
      id: `${unit.id}:grammar`,
      title: '语法模块：一般现在时与时间表达',
      focus: '用一般现在时描述日常作息，并读懂时间表达。',
      summary: '这一单元主要讲日常作息。描述经常发生的事情时，一般现在时最常见，第三人称单数动词要加 s。',
      tips: ['经常性动作用一般现在时', '第三人称单数动词常加 s', '时间点前常用 at'],
      examples,
      exercises,
      sourceType: 'configured',
    };
  }

  if (source.includes('indefinite pronouns')) {
    const exercises: GrammarExercise[] = [
      { id: `${unit.id}:grammar:1`, type: 'choice', prompt: '语境选择', question: '___ is waiting for you outside.', answer: 'Someone', options: ['Someone', 'Anyone', 'No one'], explanation: '肯定句里表达“有人”常用 Someone。' },
      { id: `${unit.id}:grammar:2`, type: 'choice', prompt: '疑问句选择', question: 'Did you see ___ at the race?', answer: 'anyone', options: ['anyone', 'someone', 'everyone'], explanation: '一般疑问句里通常用 anyone。' },
      { id: `${unit.id}:grammar:3`, type: 'fill', prompt: '单数谓语', question: 'Everyone ___ excited.', answer: 'is', clue: 'Everyone 看作单数。', explanation: 'Everyone 虽然表示很多人，但语法上通常按单数处理。' },
      ...buildExtendedGrammarExercises(unit.id, examples, 4),
    ];
    return {
      id: `${unit.id}:grammar`,
      title: '语法模块：不定代词',
      focus: '掌握 someone / anyone / everyone / something 等表达方式。',
      summary: '不定代词可以帮助我们在不知道具体对象时表达“某人、任何人、每个人、某物”等意思。',
      tips: ['肯定句里常见 someone / something', '疑问句和否定句里常见 anyone / anything', '不定代词作主语时通常看作单数'],
      examples,
      exercises,
      sourceType: 'configured',
    };
  }

  if (source.includes('linking verbs')) {
    const exercises: GrammarExercise[] = [
      { id: `${unit.id}:grammar:1`, type: 'choice', prompt: '形容词搭配', question: 'The soup smells ___.', answer: 'nice', options: ['nicely', 'nice', 'well'], explanation: '系动词后要接形容词 nice。' },
      { id: `${unit.id}:grammar:2`, type: 'choice', prompt: '语境选择', question: 'These dumplings ___ delicious.', answer: 'taste', options: ['taste', 'tastes', 'tasting'], explanation: '主语是复数 dumplings，所以这里用 taste。' },
      { id: `${unit.id}:grammar:3`, type: 'fill', prompt: '感受表达', question: 'Warm porridge ___ comforting.', answer: 'feels', clue: '主语是单数。', explanation: '主语是单数 porridge，这里用 feels。' },
      ...buildExtendedGrammarExercises(unit.id, examples, 4),
    ];
    return {
      id: `${unit.id}:grammar`,
      title: '语法模块：系动词',
      focus: '用 look / smell / taste / feel / be 等系动词描述食物和感受。',
      summary: '系动词后面常跟形容词，用来说明“是什么样、闻起来怎样、尝起来怎样”。',
      tips: ['系动词后面常接形容词', 'look / smell / taste / feel 都可以表达状态', '不要把系动词后误接副词'],
      examples,
      exercises,
      sourceType: 'configured',
    };
  }

  const exercises: GrammarExercise[] = [
    ...buildKeyPatternExercises(unit),
    ...buildExtendedGrammarExercises(unit.id, examples, 4),
  ];
  return {
    id: `${unit.id}:grammar`,
    title: '语法模块：本单元关键句型',
    focus: '通过重点句型回看本单元最常用的表达结构。',
    summary: '先看课文里最常出现的句型，再通过小练习把它们变成自己会用的表达。',
    tips: ['先读懂句型的意思', '注意句子开头的提问方式', '把重点句型替换成自己的内容再说一遍'],
    examples,
    exercises,
    sourceType: 'generated',
  };
};

const buildUnitBundlesFromTextbook = (textbook: TextbookContent | null): UnitBundle[] => {
  if (!textbook) return [];

  return textbook.units
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((unit) => ({
      id: unit.id,
      textbookId: textbook.id,
      grade: textbook.grade,
      semester: textbook.semester,
      unit: unit.unitCode,
      title: unit.title || UNIT_TITLE_MAP[`${textbook.grade}-${textbook.semester}-${unit.unitCode}`] || unit.unitCode,
      summary: unit.summary,
      passage: unit.passage,
      vocab: unit.vocab,
      sentences: unit.sentences,
      stages: unit.lessons.length > 0
        ? unit.lessons
            .slice()
            .sort((a, b) => a.sortOrder - b.sortOrder)
            .map((lesson) => ({
              key: lesson.stageKey,
              title: lesson.title,
              description: lesson.objective,
              estimatedMinutes: STAGE_META.find((item) => item.key === lesson.stageKey)?.estimatedMinutes || 10,
            }))
        : STAGE_META,
      phrases: unit.phrases,
      patterns: unit.patterns,
      grammar: buildGrammarModule({
        id: unit.id,
        title: unit.title,
        summary: unit.summary,
        patterns: unit.patterns,
        sentences: unit.sentences,
      }),
    }));
};

const createInitialStudyState = (units: UnitBundle[]): StudyState => ({
  currentUnitId: units[0]?.id || '',
  currentStage: 'preview',
  completedTaskIds: [],
  masteredWordIds: [],
  followedSentenceIds: [],
  completedGrammarQuestionIds: [],
  mistakes: [],
  dailyCheckins: [],
  challengeAttempts: [],
  pronunciationAssessments: [],
});

const normalizeStudyState = (raw: Partial<StudyState> | null, units: UnitBundle[]): StudyState => {
  const fallback = createInitialStudyState(units);
  if (!raw) return fallback;

  const currentUnitId = units.some((unit) => unit.id === raw.currentUnitId) ? raw.currentUnitId! : fallback.currentUnitId;
  const currentStage = STAGE_META.some((stage) => stage.key === raw.currentStage) ? raw.currentStage! : fallback.currentStage;

  return {
    currentUnitId,
    currentStage,
    completedTaskIds: Array.isArray(raw.completedTaskIds) ? raw.completedTaskIds : [],
    masteredWordIds: Array.isArray(raw.masteredWordIds) ? raw.masteredWordIds : [],
    followedSentenceIds: Array.isArray(raw.followedSentenceIds) ? raw.followedSentenceIds : [],
    completedGrammarQuestionIds: Array.isArray(raw.completedGrammarQuestionIds) ? raw.completedGrammarQuestionIds : [],
    mistakes: Array.isArray(raw.mistakes) ? raw.mistakes.slice(0, 30) : [],
    dailyCheckins: Array.isArray(raw.dailyCheckins) ? raw.dailyCheckins.slice(0, 30) : [],
    challengeAttempts: Array.isArray(raw.challengeAttempts) ? raw.challengeAttempts.slice(0, 20) : [],
    pronunciationAssessments: Array.isArray(raw.pronunciationAssessments) ? raw.pronunciationAssessments.slice(0, 30) : [],
  };
};

const getTodayKey = () => new Date().toISOString().slice(0, 10);

const getOrCreateDailyCheckin = (studyState: StudyState, date: string): DailyCheckinRecord => {
  return studyState.dailyCheckins.find((item) => item.date === date) || {
    date,
    completedTaskIds: [],
    recommendationIds: [],
    challengeCompleted: false,
    checkedIn: false,
  };
};

const calculateCheckinStatus = (record: DailyCheckinRecord) => {
  const progressCount = record.completedTaskIds.length + record.recommendationIds.length + (record.challengeCompleted ? 1 : 0);
  return {
    progressCount,
    ready: progressCount >= 3,
  };
};

const getCheckinStreak = (dailyCheckins: DailyCheckinRecord[]) => {
  const checkedDates = new Set(dailyCheckins.filter((item) => item.checkedIn).map((item) => item.date));
  let streak = 0;
  const cursor = new Date();

  while (true) {
    const date = cursor.toISOString().slice(0, 10);
    if (!checkedDates.has(date)) break;
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  return streak;
};

const MISTAKE_REASON_LABELS: Record<MistakeReason, string> = {
  unknown_vocab: '词义不熟',
  pronunciation: '跟读纠音',
  missing_word: '漏词',
  spelling: '拼写错误',
  punctuation: '标点/格式',
  sentence_structure: '句子结构',
  too_short: '表达过短',
  off_topic: '内容偏题',
  fluency: '表达不流畅',
  grammar_rule: '语法规则',
  word_order: '词序问题',
  sentence_judgement: '正误判断',
};

const classifyDictationIssue = (input: string, target: string) => {
  const cleanedInput = input.trim();
  const cleanedTarget = target.trim();
  const normalizedInput = cleanedInput.toLowerCase().replace(/[.,!?;:]/g, '');
  const normalizedTarget = cleanedTarget.toLowerCase().replace(/[.,!?;:]/g, '');

  if (!cleanedInput) {
    return { reason: 'missing_word' as MistakeReason, hint: '这题没有作答，建议先听一遍抓关键词，再补全整句。' };
  }

  if (normalizedInput === normalizedTarget && cleanedInput !== cleanedTarget) {
    return { reason: 'punctuation' as MistakeReason, hint: '内容基本正确，主要是大小写或标点格式需要再规范。' };
  }

  const inputWords = normalizedInput.split(/\s+/).filter(Boolean);
  const targetWords = normalizedTarget.split(/\s+/).filter(Boolean);
  if (targetWords.length > 1 && inputWords.length < targetWords.length) {
    return { reason: 'missing_word' as MistakeReason, hint: '这题更像是漏词，建议先听主语、动词和时间地点信息。' };
  }

  if (targetWords.length > 1) {
    return { reason: 'sentence_structure' as MistakeReason, hint: '句子顺序或结构有偏差，建议先跟读重点句再回听写。' };
  }

  return { reason: 'spelling' as MistakeReason, hint: '这题主要是拼写问题，建议先分音节拼读再重新默写。' };
};

const buildSpeakingFeedback = (userText: string, unit: UnitBundle | null) => {
  const trimmed = userText.trim();
  if (!trimmed) {
    return { reason: 'too_short' as MistakeReason, hint: '先用 1-2 句完整句回答，再补充原因。', score: 0 };
  }

  const wordCount = trimmed.split(/\s+/).filter(Boolean).length;
  if (wordCount < 5) {
    return { reason: 'too_short' as MistakeReason, hint: '回答有点短，建议至少说到“观点 + 原因”两部分。', score: 1 };
  }

  const keywords = unit
    ? [...unit.vocab.slice(0, 6).map((item) => item.word.toLowerCase()), ...unit.sentences.slice(0, 3).flatMap((item) => item.text.toLowerCase().split(/\s+/))]
    : [];
  const matchedKeywords = keywords.filter((keyword) => trimmed.toLowerCase().includes(keyword)).length;

  if (unit && matchedKeywords === 0) {
    return { reason: 'off_topic' as MistakeReason, hint: '内容和本单元主题连接不强，建议带上本单元关键词或重点句型。', score: 1 };
  }

  if (wordCount < 10) {
    return { reason: 'fluency' as MistakeReason, hint: '意思基本到了，可以再多说一句，让表达更完整顺畅。', score: 2 };
  }

  return { reason: null, hint: '表达比较完整，继续保持完整句输出。', score: 3 };
};

const buildReviewPack = (studyState: StudyState): ReviewPackItem[] => {
  const seen = new Set<string>();
  return studyState.mistakes
    .filter((item) => {
      const key = `${item.stage}:${item.prompt}:${item.reason || 'none'}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 3)
    .map((mistake) => ({
      id: `review-${mistake.id}`,
      title: mistake.stage === 'preview'
        ? `回到 ${getStageLabel('preview')} 复习词汇`
        : mistake.stage === 'dictation'
          ? '重做一条听写巩固'
          : '补一次口语表达',
      summary: mistake.hint || `${mistake.prompt} 建议立即复盘，避免同类错误重复出现。`,
      reasonLabel: mistake.reason ? MISTAKE_REASON_LABELS[mistake.reason] : '待复盘',
      stage: mistake.stage,
      mistake,
    }));
};

const normalizeEnglishText = (text: string) =>
  text
    .toLowerCase()
    .replace(/[.,!?;:'"]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

const getWeaknessSummary = (studyState: StudyState) => {
  const counters = {
    vocab: studyState.mistakes.filter((item) => item.category === 'vocab').length,
    dictation: studyState.mistakes.filter((item) => item.category === 'dictation').length,
    speaking: studyState.mistakes.filter((item) => item.category === 'speaking').length,
  };

  return [
    { label: '词汇掌握', count: counters.vocab, hint: counters.vocab > 0 ? '建议先回到课时1复习易错词' : '词汇基础比较稳定', color: counters.vocab > 0 ? 'text-orange-500' : 'text-emerald-500' },
    { label: '听写准确率', count: counters.dictation, hint: counters.dictation > 0 ? '优先巩固听写错句和漏词' : '听写表现稳定', color: counters.dictation > 0 ? 'text-red-500' : 'text-emerald-500' },
    { label: '口语表达', count: counters.speaking, hint: counters.speaking > 0 ? '建议补充口语句型和复述训练' : '口语输出保持不错', color: counters.speaking > 0 ? 'text-amber-500' : 'text-emerald-500' },
  ];
};

const loadStudyStateForUser = (username: string, textbookId: string, units: UnitBundle[]) => {
  const raw = localStorage.getItem(getStudyStorageKey(username, textbookId));
  if (!raw) return createInitialStudyState(units);
  try {
    return normalizeStudyState(JSON.parse(raw) as Partial<StudyState>, units);
  } catch (error) {
    return createInitialStudyState(units);
  }
};

const getUnitChallengeStatus = (unit: UnitBundle | null, studyState: StudyState) => {
  if (!unit) {
    return { ready: false, score: 0, progress: 0, challengeLabel: '暂无单元' };
  }

  const completedStages = unit.stages.filter((stage) => studyState.completedTaskIds.includes(createTaskId(unit.id, stage.key))).length;
  const vocabProgress = unit.vocab.length === 0 ? 1 : unit.vocab.filter((word) => studyState.masteredWordIds.includes(word.id)).length / unit.vocab.length;
  const sentenceProgress = unit.sentences.length === 0 ? 1 : unit.sentences.filter((sentence) => studyState.followedSentenceIds.includes(sentence.id)).length / unit.sentences.length;
  const progress = Math.round((((completedStages / unit.stages.length) + vocabProgress + sentenceProgress) / 3) * 100);

  return {
    ready: progress >= 80,
    score: progress,
    progress,
    challengeLabel: progress >= 80 ? '可进入单元闯关' : '继续完成推荐任务',
  };
};

const generateDailyRecommendations = (unit: UnitBundle | null, studyState: StudyState): RecommendationItem[] => {
  if (!unit) return [];

  const recommendations: RecommendationItem[] = [];
  const reviewPack = buildReviewPack(studyState);
  const latestMistake = studyState.mistakes[0];

  if (reviewPack[0] && latestMistake) {
    recommendations.push({
      id: `retry-${latestMistake.id}`,
      title: '先完成今日复习包',
      description: `${reviewPack[0].reasonLabel}优先处理，${latestMistake.prompt} 建议今天先回练。`,
      stage: latestMistake.stage,
      priority: 'high',
    });
  }

  const currentStageMeta = unit.stages.find((stage) => stage.key === studyState.currentStage) || unit.stages[0];
  const currentTaskId = createTaskId(unit.id, currentStageMeta.key);
  if (!studyState.completedTaskIds.includes(currentTaskId)) {
    recommendations.push({
      id: `stage-${currentStageMeta.key}`,
      title: `完成${currentStageMeta.title}`,
      description: currentStageMeta.description,
      stage: currentStageMeta.key,
      priority: 'high',
    });
  }

  if (unit.vocab.some((word) => !studyState.masteredWordIds.includes(word.id))) {
    recommendations.push({
      id: 'preview-refresh',
      title: '补齐本单元未掌握词汇',
      description: '先把词义和发音补稳，再进入听写和口语输出会更顺。',
      stage: 'preview',
      priority: 'medium',
    });
  }

  if (unit.sentences.some((sentence) => !studyState.followedSentenceIds.includes(sentence.id))) {
    recommendations.push({
      id: 'reading-refresh',
      title: '完成重点句跟读',
      description: '逐句跟读重点句，帮助后面的听写和表达更顺。',
      stage: 'reading',
      priority: 'medium',
    });
  }

  if (unit.grammar.exercises.some((exercise) => !studyState.completedGrammarQuestionIds.includes(exercise.id))) {
    recommendations.push({
      id: 'grammar-refresh',
      title: '完成本单元语法模块',
      description: `先完成 ${unit.grammar.title}，再做听写和口语会更稳。`,
      stage: 'reading',
      priority: 'medium',
    });
  }

  if (!recommendations.some((item) => item.stage === 'speaking')) {
    recommendations.push({
      id: 'speaking-boost',
      title: '做一次单元口语输出',
      description: '围绕本单元主题回答 2-3 个问题，把输入真正转成输出。',
      stage: 'speaking',
      priority: 'low',
    });
  }

  return recommendations.slice(0, 4);
};

const buildChallengeQuestions = (unit: UnitBundle | null) => {
  if (!unit) return [];

  const vocabQuestions = unit.vocab.slice(0, 2).map((word, index) => ({
    id: `${unit.id}-vocab-${word.id}`,
    prompt: `请说出 "${word.word}" 的中文含义或用法`,
    expected: word.definition,
    kind: index === 0 ? 'vocab' : 'meaning',
  }));

  const sentenceQuestions = unit.sentences.slice(0, 2).map((sentence) => ({
    id: `${unit.id}-sentence-${sentence.id}`,
    prompt: `请朗读并解释句子：${sentence.text}`,
    expected: sentence.translation,
    kind: 'sentence',
  }));

  const summaryQuestion = {
    id: `${unit.id}-summary`,
    prompt: `围绕 ${unit.title} 做 3 句口语表达`,
    expected: unit.sentences.slice(0, 2).map((sentence) => sentence.text).join(' / '),
    kind: 'speaking',
  };

  return [...vocabQuestions, ...sentenceQuestions, summaryQuestion];
};

const getChallengeHistoryForUnit = (studyState: StudyState, unitId: string) => {
  return studyState.challengeAttempts.filter((attempt) => attempt.unitId === unitId);
};

const buildSevenDayTrend = (dailyCheckins: DailyCheckinRecord[]) => {
  return Array.from({ length: 7 }).map((_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - index));
    const dateKey = date.toISOString().slice(0, 10);
    const label = `${date.getMonth() + 1}/${date.getDate()}`;
    const record = dailyCheckins.find((item) => item.date === dateKey);
    const status = record ? calculateCheckinStatus(record) : { progressCount: 0, ready: false };
    return {
      date: dateKey,
      label,
      progress: status.progressCount,
      checkedIn: record?.checkedIn ? 1 : 0,
    };
  });
};

const getSpeakingCoachConfig = (unit: UnitBundle | null) => {
  if (!unit) {
    return {
      intro: 'Hello! Let us practice everyday English together.',
      goal: 'Talk about a familiar topic in short English sentences.',
      prompts: ['Introduce yourself.', 'Tell me about your school.', 'What do you like learning?'],
    };
  }

  const joinedSentences = unit.sentences.slice(0, 4).map((item) => item.text).join(' ');
  const configs: Record<string, { intro: string; goal: string; prompts: string[] }> = {
    'My classmates': {
      intro: `We are studying ${unit.title}. Let us practice introducing classmates and personal information.`,
      goal: 'Use simple introductions, age, country and class information.',
      prompts: ['Introduce one of your classmates.', 'Where is your classmate from?', 'How old is your friend?'],
    },
    'My family': {
      intro: `We are studying ${unit.title}. Let us practice describing family members and jobs.`,
      goal: 'Use family words and job descriptions clearly.',
      prompts: ['Tell me about your family.', 'What does your mother do?', 'Who is the kindest person in your family?'],
    },
    'My school': {
      intro: `We are studying ${unit.title}. Let us practice describing school places and favorite subjects.`,
      goal: 'Describe your school and explain why you like a subject.',
      prompts: ['Describe your school.', 'What subjects do you like?', 'Tell me about your library or classroom.'],
    },
    'Healthy food': {
      intro: `We are studying ${unit.title}. Let us practice talking about food choices and healthy habits.`,
      goal: 'Say what food you like and what is healthy.',
      prompts: ['What is your favourite food?', 'What food is healthy for students?', 'Describe your breakfast.'],
    },
    'My school day': {
      intro: `We are studying ${unit.title}. Let us practice your daily routine and time expressions.`,
      goal: 'Talk about time and daily activities in order.',
      prompts: ['What time do you get up?', 'Describe your school day.', 'What do you do in the evening?'],
    },
    'A trip to the zoo': {
      intro: `We are studying ${unit.title}. Let us practice talking about animals and habitats.`,
      goal: 'Describe animals using simple present tense.',
      prompts: ['What animals do you like?', 'What does the panda eat?', 'Describe a zoo trip.'],
    },
    'Lost and found': {
      intro: `We are studying ${unit.title}. Let us practice asking about lost things and giving help.`,
      goal: 'Ask and answer whose things they are.',
      prompts: ['What did you lose?', 'How can you help in the lost and found office?', 'Whose bag is this?'],
    },
    'What can you do?': {
      intro: `We are studying ${unit.title}. Let us practice talking about abilities and clubs.`,
      goal: 'Use can, cannot and club activities naturally.',
      prompts: ['What can you do?', 'What club do you want to join?', 'Can you play sports or music?'],
    },
  };

  return configs[unit.title] || {
    intro: `We are studying ${unit.title}. Please coach me with simple speaking questions based on these key sentences: ${joinedSentences}`,
    goal: 'Use the key sentences to answer in complete English.',
    prompts: unit.sentences.slice(0, 3).map((item) => item.text),
  };
};

// --- Components ---

const TaskCard = ({ task }: any) => {
  const isCompleted = task.status === 'completed';
  const isOngoing = task.status === 'ongoing';

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-2xl p-4 sm:p-5 shadow-sm border border-slate-100 flex flex-col sm:flex-row sm:items-center gap-4 group hover:shadow-md transition-all"
    >
      <div className={cn(
        "w-12 h-12 rounded-xl flex items-center justify-center shrink-0",
        task.category === 'exam' ? "bg-blue-50 text-blue-500" : 
        task.category === 'ai' ? "bg-purple-50 text-purple-500" : "bg-emerald-50 text-emerald-500"
      )}>
        {task.type === 'reading' && <Mic2 size={24} />}
        {task.type === 'dialogue' && <MessageSquare size={24} />}
        {task.type === 'dubbing' && <Play size={24} />}
        {task.type === 'retelling' && <Headphones size={24} />}
      </div>
      
      <div className="flex-1 min-w-0 w-full">
        <div className="flex items-center gap-2 mb-1">
          <h3 className="font-bold text-slate-800 truncate">{task.title}</h3>
          <span className={cn(
            "text-[10px] px-2 py-0.5 rounded-full font-medium",
            isCompleted ? "bg-emerald-100 text-emerald-600" : 
            isOngoing ? "bg-blue-100 text-blue-600" : "bg-slate-100 text-slate-500"
          )}>
            {isCompleted ? '已完成' : isOngoing ? '进行中' : '待开始'}
          </span>
        </div>
        <p className="text-xs text-slate-500 truncate mb-2">{task.description}</p>
        <div className="flex items-center gap-3 text-[10px] text-slate-400">
          <span className="flex items-center gap-1"><Clock size={12} /> {task.time}</span>
          {isCompleted && <span className="flex items-center gap-1 text-orange-500 font-bold"><Star size={12} fill="currentColor" /> {task.score} 分</span>}
        </div>
      </div>

      <div className="flex flex-col gap-2 w-full sm:w-auto">
        <button className={cn(
          "px-4 py-2 rounded-full text-xs font-bold transition-all w-full sm:w-auto",
          isCompleted ? "bg-blue-500 text-white shadow-lg shadow-blue-200" : "bg-emerald-500 text-white shadow-lg shadow-emerald-200"
        )}>
          {isCompleted ? '查看报告' : isOngoing ? '继续练习' : '开始任务'}
        </button>
      </div>
    </motion.div>
  );
};

// --- Views ---

const Dashboard = ({
  currentUser,
  currentUnit,
  studyState,
  onSelectStage,
  onOpenStage,
  onOpenChallenge,
  onCheckInToday,
  onCompleteRecommendation,
}: {
  currentUser: AppUser;
  currentUnit: UnitBundle | null;
  studyState: StudyState;
  onSelectStage: (stage: LessonStageKey) => void;
  onOpenStage: (stage: LessonStageKey) => void;
  onOpenChallenge: () => void;
  onCheckInToday: () => void;
  onCompleteRecommendation: (item: RecommendationItem) => void;
}) => {
  const todayTasks = currentUnit
    ? currentUnit.stages.map((stage) => ({
        id: createTaskId(currentUnit.id, stage.key),
        title: stage.title,
        type: stage.key === 'preview' ? 'reading' : stage.key === 'reading' ? 'retelling' : stage.key === 'dictation' ? 'dubbing' : 'dialogue',
        category: stage.key === 'speaking' ? 'ai' : 'exam',
        status: studyState.completedTaskIds.includes(createTaskId(currentUnit.id, stage.key))
          ? 'completed'
          : studyState.currentStage === stage.key
            ? 'ongoing'
            : 'pending',
        time: `${stage.estimatedMinutes} min`,
        description: stage.description,
        score: studyState.completedTaskIds.includes(createTaskId(currentUnit.id, stage.key)) ? 100 : 0,
        stageKey: stage.key,
      }))
    : [];

  const completedCount = todayTasks.filter((task) => task.status === 'completed').length;
  const weaknessSummary = getWeaknessSummary(studyState);
  const recommendations = generateDailyRecommendations(currentUnit, studyState);
  const reviewPack = buildReviewPack(studyState);
  const challengeStatus = getUnitChallengeStatus(currentUnit, studyState);
  const todayRecord = getOrCreateDailyCheckin(studyState, getTodayKey());
  const todayCheckin = calculateCheckinStatus(todayRecord);
  const streak = getCheckinStreak(studyState.dailyCheckins);

  return (
    <div className="space-y-6 pb-20">
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        <StatCard label="今日任务" value={`${completedCount}/${todayTasks.length || 4}`} colorClass="text-blue-500" />
        <StatCard label="当前单元" value={currentUnit?.unit || '--'} colorClass="text-purple-500" />
        <StatCard label="错题累计" value={String(studyState.mistakes.length)} colorClass="text-rose-500" />
        <StatCard label="连续打卡" value={`${streak}天`} icon={Trophy} colorClass="text-orange-500" />
      </div>

      <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <p className="text-xs font-bold text-blue-500 uppercase tracking-[0.3em]">Today Center</p>
            <h2 className="text-2xl font-black text-slate-800 mt-2">今天先完成 {currentUnit?.title || '教材同步任务'}</h2>
            <p className="text-sm text-slate-500 mt-1">
              {currentUser.grade} {currentUser.semester} · {currentUnit?.unit || '暂无单元'} · 当前课时 {STAGE_META.find((item) => item.key === studyState.currentStage)?.title}
            </p>
          </div>
          <button
            onClick={() => onOpenStage(studyState.currentStage)}
            className="px-5 py-3 rounded-2xl blue-gradient text-white font-bold shadow-lg shadow-blue-100"
          >
            继续当前任务
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
          {currentUnit?.stages.map((stage, index) => {
            const isCompleted = studyState.completedTaskIds.includes(createTaskId(currentUnit.id, stage.key));
            const isCurrent = studyState.currentStage === stage.key;
            return (
              <button
                key={stage.key}
                onClick={() => onSelectStage(stage.key)}
                className={cn(
                  "rounded-2xl border p-4 text-left transition-all",
                  isCompleted
                    ? "border-emerald-200 bg-emerald-50"
                    : isCurrent
                      ? "border-blue-200 bg-blue-50"
                      : "border-slate-100 bg-slate-50 hover:border-slate-200"
                )}
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Step {index + 1}</span>
                  {isCompleted ? <Check size={16} className="text-emerald-500" /> : <ChevronRight size={16} className="text-slate-300" />}
                </div>
                <div className="font-bold text-slate-800 mb-1">{stage.title}</div>
                <div className="text-xs text-slate-500">{stage.description}</div>
                <div className="text-[11px] text-slate-400 mt-3">{getLessonOutcomeLabel(currentUnit, stage.key, studyState)}</div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between px-2">
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <div className="w-1 h-5 bg-emerald-500 rounded-full" />
            今日任务中心
          </h2>
          <span className="text-xs text-slate-400">教材同步练习路径</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {recommendations.map((item) => (
            <div
              key={item.id}
              className="rounded-2xl border border-slate-100 bg-white p-4 text-left hover:border-blue-200 transition-all"
            >
              <div className="flex items-center justify-between mb-2">
                <span className={cn(
                  "text-[10px] font-bold uppercase tracking-[0.2em]",
                  item.priority === 'high' ? 'text-rose-500' : item.priority === 'medium' ? 'text-amber-500' : 'text-blue-500'
                )}>
                  {item.priority === 'high' ? '优先' : item.priority === 'medium' ? '推荐' : '拓展'}
                </span>
                <ChevronRight size={14} className="text-slate-300" />
              </div>
              <div className="font-bold text-slate-800">{item.title}</div>
              <div className="text-xs text-slate-500 mt-1">{item.description}</div>
              <div className="flex gap-2 mt-4">
                <button
                  onClick={() => onOpenStage(item.stage)}
                  className="px-3 py-2 rounded-xl bg-blue-500 text-white text-xs font-bold"
                >
                  去完成
                </button>
                <button
                  onClick={() => onCompleteRecommendation(item)}
                  className="px-3 py-2 rounded-xl bg-slate-100 text-slate-600 text-xs font-bold"
                >
                  记为已做
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="space-y-3">
          {todayTasks.map((task) => (
            <div key={task.id} onClick={() => onOpenStage(task.stageKey as LessonStageKey)} className="cursor-pointer">
              <TaskCard task={task} />
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-bold text-slate-800">今日复习包</h3>
            <p className="text-sm text-slate-500 mt-1">把今天最该回练的错点先清掉，再推进新课时。</p>
          </div>
          <span className="text-xs text-slate-400">最多 3 条高优先内容</span>
        </div>
        {reviewPack.length === 0 ? (
          <div className="rounded-2xl bg-emerald-50 border border-emerald-100 p-4 text-sm text-emerald-700">
            今天暂时没有待清理的复习包，可以直接推进当前课时。
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {reviewPack.map((item) => (
              <div key={item.id} className="rounded-2xl bg-slate-50 border border-slate-100 p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-rose-500">{item.reasonLabel}</span>
                  <span className="text-[10px] text-slate-400">{getStageLabel(item.stage)}</span>
                </div>
                <div className="font-bold text-slate-800">{item.title}</div>
                <div className="text-xs text-slate-500 mt-2">{item.summary}</div>
                <div className="text-xs text-slate-400 mt-2 line-clamp-2">对应内容：{item.mistake.prompt}</div>
                <button
                  onClick={() => onOpenStage(item.stage)}
                  className="mt-4 px-3 py-2 rounded-xl bg-blue-500 text-white text-xs font-bold"
                >
                  立即回练
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
          <h3 className="font-bold text-slate-800 mb-4">弱项提醒</h3>
          <div className="space-y-3">
            {weaknessSummary.map((item) => (
              <div key={item.label} className="rounded-2xl bg-slate-50 p-4 border border-slate-100">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-bold text-slate-700">{item.label}</span>
                  <span className={cn("text-sm font-black", item.color)}>{item.count}</span>
                </div>
                <p className="text-xs text-slate-500">{item.hint}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
          <h3 className="font-bold text-slate-800 mb-4">错题回顾</h3>
          <div className="space-y-3">
            {studyState.mistakes.length === 0 ? (
              <div className="rounded-2xl bg-emerald-50 border border-emerald-100 p-4 text-sm text-emerald-700">
                目前没有待复盘的错题，继续保持。
              </div>
            ) : (
              studyState.mistakes.slice(0, 3).map((mistake) => (
                <div key={mistake.id} className="rounded-2xl bg-rose-50 border border-rose-100 p-4">
                  <div className="text-xs font-bold text-rose-600 mb-1">
                    {mistake.category === 'dictation' ? '听写错题' : mistake.category === 'speaking' ? '口语表达提醒' : '词汇薄弱'}
                  </div>
                  <div className="text-sm font-bold text-slate-800">{mistake.prompt}</div>
                  <div className="text-xs text-slate-500 mt-1">你的答案：{mistake.answer || '未作答'}</div>
                  <div className="text-xs text-rose-600 mt-1">正确内容：{mistake.expected}</div>
                  {mistake.reason && <div className="text-xs text-amber-600 mt-1">问题类型：{MISTAKE_REASON_LABELS[mistake.reason]}</div>}
                  {mistake.hint && <div className="text-xs text-slate-500 mt-1">建议：{mistake.hint}</div>}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-5">
          <div>
            <h3 className="font-bold text-slate-800">每日打卡</h3>
            <p className="text-sm text-slate-500 mt-1">
              今日已推进 {todayCheckin.progressCount}/3 个关键动作，{todayCheckin.ready ? '可以打卡' : '再完成一点就能打卡'}
            </p>
          </div>
          <button
            onClick={onCheckInToday}
            disabled={!todayCheckin.ready || todayRecord.checkedIn}
            className={cn(
              "px-5 py-3 rounded-2xl font-bold",
              todayRecord.checkedIn
                ? "bg-emerald-100 text-emerald-700"
                : todayCheckin.ready
                  ? "bg-emerald-500 text-white"
                  : "bg-slate-100 text-slate-400"
            )}
          >
            {todayRecord.checkedIn ? '今日已打卡' : '完成今日打卡'}
          </button>
        </div>
        <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden mb-2">
          <div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.min(100, Math.round((todayCheckin.progressCount / 3) * 100))}%` }} />
        </div>
        <div className="text-xs text-slate-400">建议每日完成 1 个主课时 + 1 个推荐任务 + 1 次闯关/复盘。</div>
      </div>

      <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 className="font-bold text-slate-800">单元闯关</h3>
            <p className="text-sm text-slate-500 mt-1">
              {currentUnit ? `${currentUnit.unit} · ${currentUnit.title}` : '暂无当前单元'} · {challengeStatus.challengeLabel}
            </p>
          </div>
          <button
            onClick={() => challengeStatus.ready ? onOpenChallenge() : onOpenStage(studyState.currentStage)}
            className={cn(
              "px-5 py-3 rounded-2xl text-white font-bold",
              challengeStatus.ready ? "bg-emerald-500" : "bg-slate-800"
            )}
          >
            {challengeStatus.ready ? '开始单元闯关' : '继续积累进度'}
          </button>
        </div>
        <div className="mt-5">
          <div className="flex items-center justify-between text-xs mb-2">
            <span className="text-slate-500">闯关准备度</span>
            <span className="font-bold text-slate-700">{challengeStatus.score}%</span>
          </div>
          <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
            <div className={cn("h-full rounded-full", challengeStatus.ready ? "bg-emerald-500" : "bg-blue-500")} style={{ width: `${challengeStatus.progress}%` }} />
          </div>
        </div>
      </div>
    </div>
  );
};

const getAIConfig = (): AIConfig => {
  const savedConfig = localStorage.getItem(AI_CONFIG_STORAGE_KEY);
  if (savedConfig) {
    try {
      const parsed = JSON.parse(savedConfig);
      return {
        ...DEFAULT_AI_CONFIG,
        model: typeof parsed.model === 'string' && parsed.model.trim() ? parsed.model : DEFAULT_AI_CONFIG.model,
        apiKey: typeof parsed.apiKey === 'string' ? parsed.apiKey : DEFAULT_AI_CONFIG.apiKey,
        baseURL: typeof parsed.baseURL === 'string' && parsed.baseURL.trim() ? parsed.baseURL : DEFAULT_AI_CONFIG.baseURL,
      };
    } catch (e) {
      console.error('Failed to parse AI config', e);
    }
  }
  return DEFAULT_AI_CONFIG;
};

const getBaseUrl = (url?: string) => {
  let baseUrl = (url || 'https://api.openai.com/v1').trim();
  if (!baseUrl.startsWith('http://') && !baseUrl.startsWith('https://')) {
    baseUrl = 'https://' + baseUrl;
  }
  return baseUrl.replace(/\/+$/, '');
};

const generateChatResponse = async (userText: string): Promise<string> => {
  const config = getAIConfig();
  if (!config.apiKey) throw new Error('请先在系统管理中配置 API Key');

  const baseUrl = getBaseUrl(config.baseURL);
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`
    },
    body: JSON.stringify({
      model: config.model,
      messages: [
        { role: 'system', content: "You are a friendly English tutor. Correct the student's grammar if necessary, but keep the conversation flowing. Use simple but natural English suitable for middle/high school students." },
        { role: 'user', content: `You are a friendly and professional English tutor. Help the student practice English. Keep responses concise and encouraging. Student says: ${userText}` }
      ]
    })
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || `Failed to fetch AI response (${response.status})`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
};

const generateTTS = async (text: string, accent: 'US' | 'UK'): Promise<boolean> => {
  const config = getAIConfig();
  if (!config.apiKey) return false;

  try {
    const baseUrl = getBaseUrl(config.baseURL);
    const voice = accent === 'US' ? 'alloy' : 'onyx';
    const response = await fetch(`${baseUrl}/audio/speech`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`
      },
      body: JSON.stringify({
        model: 'tts-1',
        input: text,
        voice: voice
      })
    });

    if (!response.ok) return false;

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    
    return new Promise((resolve) => {
      audio.onended = () => {
        URL.revokeObjectURL(url);
        resolve(true);
      };
      audio.onerror = () => resolve(false);
      audio.play().catch(() => resolve(false));
    });
  } catch (error) {
    return false;
  }
};

const playBrowserTTS = (text: string, accent: 'US' | 'UK', rate: number = 1.0): Promise<boolean> => {
  return new Promise((resolve) => {
    const utterance = new SpeechSynthesisUtterance(text);
    const lang = accent === 'US' ? 'en-US' : 'en-GB';
    utterance.lang = lang;
    utterance.rate = rate;
    
    const voices = window.speechSynthesis.getVoices();
    const preferredVoices = accent === 'US' 
      ? ['Google US English', 'Samantha', 'Alex', 'Microsoft Zira', 'Microsoft David']
      : ['Google UK English Female', 'Google UK English Male', 'Daniel', 'Serena', 'Microsoft Hazel'];
      
    let selectedVoice = null;
    for (const name of preferredVoices) {
      selectedVoice = voices.find(v => v.name.includes(name));
      if (selectedVoice) break;
    }
    
    if (!selectedVoice) {
      selectedVoice = voices.find(v => v.lang === lang) || voices[0];
    }
    
    if (selectedVoice) {
      utterance.voice = selectedVoice;
    }
    
    utterance.onend = () => resolve(true);
    utterance.onerror = () => resolve(false);
    
    window.speechSynthesis.speak(utterance);
  });
};

const playWordAudio = async (text: string, accent: 'US' | 'UK' = 'US'): Promise<void> => {
  console.log('🔊 Playing word:', text);
  
  // 首先尝试浏览器原生 TTS（最可靠）
  try {
    const utterance = new SpeechSynthesisUtterance(text);
    const lang = accent === 'US' ? 'en-US' : 'en-GB';
    utterance.lang = lang;
    utterance.rate = 0.9;
    
    // 等待语音列表加载
    let voices = window.speechSynthesis.getVoices();
    if (voices.length === 0) {
      // 如果语音列表还没加载，等待一下
      await new Promise(resolve => setTimeout(resolve, 100));
      voices = window.speechSynthesis.getVoices();
    }
    
    const preferredVoices = accent === 'US' 
      ? ['Google US English', 'Samantha', 'Alex', 'Microsoft Zira', 'Microsoft David', 'Google UK English Male']
      : ['Google UK English Female', 'Google UK English Male', 'Daniel', 'Serena', 'Microsoft Hazel', 'Google US English'];
      
    let selectedVoice = null;
    for (const name of preferredVoices) {
      selectedVoice = voices.find(v => v.name.includes(name));
      if (selectedVoice) break;
    }
    
    if (!selectedVoice) {
      selectedVoice = voices.find(v => v.lang === lang) || voices[0];
    }
    
    if (selectedVoice) {
      utterance.voice = selectedVoice;
      console.log('✅ Using voice:', selectedVoice.name);
    }
    
    return new Promise((resolve, reject) => {
      utterance.onend = () => {
        console.log('✅ Audio finished');
        resolve();
      };
      utterance.onerror = (e) => {
        console.error('❌ TTS error:', e);
        reject(e);
      };
      window.speechSynthesis.speak(utterance);
    });
  } catch (e) {
    console.error('Browser TTS failed:', e);
    throw e;
  }
};

const AITutor = ({
  currentUnit,
  onCompleteStage,
  onAddMistake,
  fetchSpeechToken,
}: {
  currentUnit: UnitBundle | null;
  onCompleteStage: (stage: LessonStageKey) => void;
  onAddMistake: (record: Omit<MistakeRecord, 'id' | 'createdAt'>) => void;
  fetchSpeechToken: () => Promise<SpeechTokenResponse>;
}) => {
  const [tutorMode, setTutorMode] = useState<'unit' | 'free-talk'>('unit');
  const coachConfig = tutorMode === 'free-talk'
    ? {
        intro: 'Hello! Let us have a free talk in English. You can chat about school, hobbies, plans, or anything from your day.',
        goal: 'Speak naturally in complete English sentences and keep the conversation going.',
        prompts: ['What did you do today?', 'What are you interested in these days?', 'Tell me something about your weekend plan.'],
      }
    : getSpeakingCoachConfig(currentUnit);
  const starterQuestion = coachConfig.intro;
  const [messages, setMessages] = useState<{ role: 'user' | 'ai', text: string }[]>([
    { role: 'ai', text: starterQuestion }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState<number | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [accent, setAccent] = useState<'US' | 'UK'>('US');
  const scrollRef = useRef<HTMLDivElement>(null);

  // 存储识别候选结果
  const [practiceFeedback, setPracticeFeedback] = useState<{ level: 'good' | 'needs-work'; text: string } | null>(null);
  const [speakingAssessment, setSpeakingAssessment] = useState<AzurePronunciationResult | null>(null);
  const [speakingAssessmentText, setSpeakingAssessmentText] = useState('');
  const [isAssessingSpeaking, setIsAssessingSpeaking] = useState(false);
  const [speakingAssessmentError, setSpeakingAssessmentError] = useState('');
  const speakingSessionRef = useRef<Awaited<ReturnType<typeof createPronunciationAssessmentSession>> | null>(null);

  useEffect(() => {
    setMessages([{ role: 'ai', text: starterQuestion }]);
    setPracticeFeedback(null);
    setSpeakingAssessment(null);
    setSpeakingAssessmentText('');
    setSpeakingAssessmentError('');
    speakingSessionRef.current?.cancel();
    speakingSessionRef.current = null;
    setIsAssessingSpeaking(false);
  }, [starterQuestion]);

  const toggleListening = async () => {
    if (isListening) return;

    setIsListening(true);
    try {
      const { token, region } = await fetchSpeechToken();
      const transcript = await recognizeSpeechFromMicrophone({
        token,
        region,
        language: accent === 'US' ? 'en-US' : 'en-GB',
      });
      setInputValue(transcript.replace(/[.。]\s*$/, ''));
    } catch (error: any) {
      alert(error?.message || 'Azure 语音识别失败，请检查麦克风权限后重试。');
    } finally {
      setIsListening(false);
    }
  };

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const latestUserMessage = [...messages].reverse().find((message) => message.role === 'user')?.text || '';

  const handleAssessSpeaking = async () => {
    const referenceText = inputValue.trim() || latestUserMessage.trim();
    if (!referenceText) {
      setSpeakingAssessmentError('先输入一句话，或先完成一次语音表达，再进行 Azure 口语评测。');
      return;
    }

    if (isAssessingSpeaking && speakingSessionRef.current) {
      try {
        const { assessment, weakWords } = await speakingSessionRef.current.stop();
        speakingSessionRef.current = null;
        setSpeakingAssessment(assessment);
        setSpeakingAssessmentText(referenceText);

        if (currentUnit && (assessment.pronunciationScore < 75 || weakWords.length > 0)) {
          onAddMistake({
            unitId: currentUnit.id,
            category: 'speaking',
            stage: 'speaking',
            prompt: tutorMode === 'free-talk' ? 'Free Talk Azure 口语评测' : `口语任务：${currentUnit.title}`,
            expected: referenceText,
            answer: weakWords.join(', ') || '发音分数偏低',
            reason: 'pronunciation',
            hint: assessment.feedback[1] || assessment.feedback[0],
          });
        }
      } catch (error: any) {
        setSpeakingAssessmentError(error?.message || 'Azure 口语评测失败，请稍后再试。');
      } finally {
        setIsAssessingSpeaking(false);
      }
      return;
    }

    setIsAssessingSpeaking(true);
    setSpeakingAssessment(null);
    setSpeakingAssessmentError('');

    try {
      const { token, region } = await fetchSpeechToken();
      speakingSessionRef.current = await createPronunciationAssessmentSession({
        token,
        region,
        referenceText,
        language: accent === 'US' ? 'en-US' : 'en-GB',
      });
      setSpeakingAssessmentText(referenceText);
    } catch (error: any) {
      setSpeakingAssessmentError(error?.message || 'Azure 口语评测失败，请稍后再试。');
      setIsAssessingSpeaking(false);
    }
  };

  const handleSend = async () => {
    if (!inputValue.trim() || isLoading) return;

    const userText = inputValue;
    setInputValue('');
    setMessages(prev => [...prev, { role: 'user', text: userText }]);
    setIsLoading(true);

    try {
      const feedback = buildSpeakingFeedback(userText, tutorMode === 'unit' ? currentUnit : null);
      setPracticeFeedback({
        level: feedback.reason ? 'needs-work' : 'good',
        text: feedback.hint,
      });
      if (feedback.reason && currentUnit) {
        onAddMistake({
          unitId: currentUnit.id,
          category: 'speaking',
          stage: 'speaking',
          prompt: tutorMode === 'free-talk' ? 'Free Talk 自由对话' : `口语任务：${currentUnit.title}`,
          expected: coachConfig.goal,
          answer: userText,
          reason: feedback.reason,
          hint: feedback.hint,
        });
      }
      const lessonPrompt = tutorMode === 'free-talk'
        ? `You are a friendly English speaking partner for a middle or high school student. Keep the conversation natural, encouraging, and short. Ask one follow-up question at a time. Student says: ${userText}`
        : currentUnit
          ? `You are coaching a middle or high school student on FLTRP unit "${currentUnit.title}". Goal: ${coachConfig.goal}. Ask short follow-up questions and help the student answer more naturally. Key sentences: ${currentUnit.sentences.slice(0, 4).map((item) => item.text).join(' ')}. Student response: ${userText}`
          : userText;
      const aiResponse = await generateChatResponse(lessonPrompt);
      setMessages(prev => [...prev, { role: 'ai', text: aiResponse }]);
      onCompleteStage('speaking');
      
      // Auto-speak the AI response
      speakText(aiResponse, messages.length + 1);
    } catch (error: any) {
      setMessages(prev => [...prev, { role: 'ai', text: `Error: ${error.message || 'Something went wrong'}` }]);
    } finally {
      setIsLoading(false);
    }
  };

  const speakText = async (text: string, index: number) => {
    if (isSpeaking !== null) return;
    setIsSpeaking(index);

    try {
      const { token, region } = await fetchSpeechToken();
      await speakTextWithAzure({
        token,
        region,
        text,
        voiceName: accent === 'US' ? 'en-US-AvaMultilingualNeural' : 'en-GB-SoniaNeural',
      });
      setIsSpeaking(null);
      return;
    } catch (error) {
      console.error('Azure TTS Error:', error);
    }

    try {
      const success = await generateTTS(text, accent);
      if (success) {
        setIsSpeaking(null);
        return;
      }
    } catch (error) {
      console.error('TTS Error:', error);
    }

    // Fallback to browser TTS if API TTS fails or no key
    await playBrowserTTS(text, accent);
    setIsSpeaking(null);
  };

  return (
    <div className="h-full flex flex-col pb-20">
      <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 mb-6 flex-1 flex flex-col min-h-0">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl blue-gradient flex items-center justify-center text-white shadow-lg shadow-blue-200">
              <Zap size={32} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-800">AI 私人外教</h2>
              <p className="text-sm text-slate-500">
                {tutorMode === 'free-talk'
                  ? '当前模式：Free Talk 自由对话'
                  : `正在讨论：${currentUnit ? `${currentUnit.unit} · ${currentUnit.title}` : '教材口语练习'}`}
              </p>
              <p className="text-xs text-slate-400 mt-1">{coachConfig.goal}</p>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <div className="flex bg-slate-100 p-1 rounded-xl">
              <button
                onClick={() => setTutorMode('unit')}
                className={cn("px-3 py-1.5 rounded-lg text-xs font-bold transition-all", tutorMode === 'unit' ? "bg-white text-blue-600 shadow-sm" : "text-slate-400")}
              >
                教材陪练
              </button>
              <button
                onClick={() => setTutorMode('free-talk')}
                className={cn("px-3 py-1.5 rounded-lg text-xs font-bold transition-all", tutorMode === 'free-talk' ? "bg-white text-blue-600 shadow-sm" : "text-slate-400")}
              >
                Free Talk
              </button>
            </div>
            <div className="flex bg-slate-100 p-1 rounded-xl">
              <button 
                onClick={() => setAccent('US')}
                className={cn("px-3 py-1.5 rounded-lg text-xs font-bold transition-all", accent === 'US' ? "bg-white text-blue-600 shadow-sm" : "text-slate-400")}
              >
                美式 (US)
              </button>
              <button 
                onClick={() => setAccent('UK')}
                className={cn("px-3 py-1.5 rounded-lg text-xs font-bold transition-all", accent === 'UK' ? "bg-white text-blue-600 shadow-sm" : "text-slate-400")}
              >
                英式 (UK)
              </button>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mb-5">
          {coachConfig.prompts.map((prompt) => (
            <button
              key={prompt}
              onClick={() => setInputValue(prompt)}
              className="px-3 py-2 rounded-full bg-slate-100 text-slate-600 text-xs font-bold hover:bg-slate-200 transition-all"
            >
              {prompt}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-3 mb-5">
          <button
            onClick={handleAssessSpeaking}
            className={cn(
              'px-4 py-2 rounded-2xl text-sm font-bold',
              isAssessingSpeaking ? 'bg-red-500 text-white' : 'bg-violet-500 text-white',
            )}
          >
            {isAssessingSpeaking ? '停止并提交 Azure 口语评测' : '开始 Azure 口语评测'}
          </button>
          <div className="text-xs text-slate-400 self-center">
            {tutorMode === 'free-talk' ? '会按当前输入或最近一句自由表达做发音评测。' : '会按当前输入或最近一句教材表达做发音评测。'}
          </div>
        </div>

        {practiceFeedback && (
          <div className={cn(
            "mb-5 rounded-2xl border p-4 text-sm",
            practiceFeedback.level === 'good'
              ? "bg-emerald-50 border-emerald-100 text-emerald-700"
              : "bg-amber-50 border-amber-100 text-amber-700"
          )}>
            {practiceFeedback.text}
          </div>
        )}

        {(speakingAssessment || speakingAssessmentError) && (
          <div className="mb-5 rounded-2xl border border-slate-100 bg-slate-50 p-4 space-y-4">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div>
                <div className="text-xs font-bold text-slate-400 mb-1">Azure 口语评测</div>
                <div className="text-sm text-slate-600">{speakingAssessmentText || '当前表达'}</div>
              </div>
              {speakingAssessment && (
                <div className="px-3 py-2 rounded-xl bg-violet-50 text-violet-600 text-sm font-bold">
                  总分 {speakingAssessment.pronunciationScore}
                </div>
              )}
            </div>

            {speakingAssessment && (
              <>
                <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
                  <div className="rounded-2xl bg-white border border-slate-100 p-4">
                    <div className="text-xs text-slate-400">发音</div>
                    <div className="text-xl font-black text-slate-800 mt-1">{speakingAssessment.pronunciationScore}</div>
                  </div>
                  <div className="rounded-2xl bg-white border border-slate-100 p-4">
                    <div className="text-xs text-slate-400">准确度</div>
                    <div className="text-xl font-black text-slate-800 mt-1">{speakingAssessment.accuracyScore}</div>
                  </div>
                  <div className="rounded-2xl bg-white border border-slate-100 p-4">
                    <div className="text-xs text-slate-400">流利度</div>
                    <div className="text-xl font-black text-slate-800 mt-1">{speakingAssessment.fluencyScore}</div>
                  </div>
                  <div className="rounded-2xl bg-white border border-slate-100 p-4">
                    <div className="text-xs text-slate-400">完整度</div>
                    <div className="text-xl font-black text-slate-800 mt-1">{speakingAssessment.completenessScore}</div>
                  </div>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                  <div className="rounded-2xl bg-white border border-slate-100 p-4">
                    <div className="text-xs font-bold text-slate-400 mb-3">逐词反馈</div>
                    <div className="flex flex-wrap gap-2">
                      {speakingAssessment.words.map((word) => (
                        <span
                          key={`${word.word}-${word.accuracyScore}`}
                          className={cn(
                            'px-3 py-2 rounded-xl text-sm font-bold border',
                            word.accuracyScore >= 85
                              ? 'bg-emerald-50 border-emerald-100 text-emerald-700'
                              : word.accuracyScore >= 70
                                ? 'bg-amber-50 border-amber-100 text-amber-700'
                                : 'bg-rose-50 border-rose-100 text-rose-700',
                          )}
                        >
                          {word.word} {Math.round(word.accuracyScore)}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-2xl bg-white border border-slate-100 p-4">
                    <div className="text-xs font-bold text-slate-400 mb-3">学习建议</div>
                    <div className="space-y-2">
                      {speakingAssessment.feedback.map((item) => (
                        <div key={item} className="text-sm text-slate-600">• {item}</div>
                      ))}
                    </div>
                  </div>
                </div>
              </>
            )}

            {speakingAssessmentError && (
              <div className="rounded-2xl bg-amber-50 border border-amber-100 p-4 text-sm text-amber-700">
                {speakingAssessmentError}
              </div>
            )}
          </div>
        )}

        <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto custom-scrollbar pr-2 mb-6">
          {messages.map((msg, idx) => (
            <div key={idx} className={cn("flex gap-3", msg.role === 'user' ? "flex-row-reverse" : "")}>
              <div className={cn(
                "w-8 h-8 rounded-lg flex items-center justify-center shrink-0 font-bold text-xs",
                msg.role === 'ai' ? "bg-blue-100 text-blue-600" : "bg-emerald-100 text-emerald-600"
              )}>
                {msg.role === 'ai' ? 'AI' : '我'}
              </div>
              <div className="flex flex-col gap-1 max-w-[80%]">
                <div className={cn(
                  "p-4 rounded-2xl text-sm",
                  msg.role === 'ai' 
                    ? "bg-slate-50 rounded-tl-none text-slate-700" 
                    : "bg-blue-500 rounded-tr-none text-white shadow-md shadow-blue-100"
                )}>
                  <div className="markdown-body">
                    <Markdown>{msg.text}</Markdown>
                  </div>
                </div>
                {msg.role === 'ai' && (
                  <button 
                    onClick={() => speakText(msg.text, idx)}
                    className={cn(
                      "flex items-center gap-1 text-[10px] font-bold transition-all",
                      isSpeaking === idx ? "text-blue-500" : "text-slate-400 hover:text-blue-500"
                    )}
                  >
                    {isSpeaking === idx ? <RotateCw size={10} className="animate-spin" /> : <Volume2 size={10} />}
                    {isSpeaking === idx ? '正在播放...' : '播放音频'}
                  </button>
                )}
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center text-blue-600 shrink-0">AI</div>
              <div className="bg-slate-50 p-4 rounded-2xl rounded-tl-none text-sm text-slate-400 flex items-center gap-2">
                <RotateCw size={14} className="animate-spin" />
                AI 正在思考中...
              </div>
            </div>
          )}
        </div>

        <div className="relative">
          <div className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
            <button 
              onClick={toggleListening}
              className={cn(
                "w-10 h-10 rounded-xl flex items-center justify-center transition-all",
                isListening ? "bg-red-500 text-white animate-pulse" : "bg-slate-100 text-slate-400 hover:bg-slate-200"
              )}
            >
              <Mic2 size={18} />
            </button>
          </div>
          <input 
            type="text" 
            value={inputValue}
            onChange={e => setInputValue(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSend()}
            placeholder={isListening ? "Azure 正在听你说..." : tutorMode === 'free-talk' ? "随便聊聊今天、兴趣或计划..." : "用英语和外教聊聊吧..."}
            className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 pl-16 pr-14 text-sm outline-none focus:border-blue-500 transition-all"
          />
          <button 
            onClick={handleSend}
            disabled={!inputValue.trim() || isLoading}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-xl blue-gradient text-white flex items-center justify-center shadow-lg shadow-blue-100 disabled:opacity-50"
          >
            <Play size={18} />
          </button>
        </div>

        <div className="mt-2 flex items-center gap-2 text-xs text-slate-400">
          <AlertCircle size={12} />
          <span>麦克风输入与对话播报会优先使用 Azure Speech。</span>
        </div>
      </div>

      {/* Scaffolding Tools */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <button className="bg-white p-3 rounded-2xl border border-slate-100 shadow-sm text-center hover:bg-slate-50 transition-all">
          <div className="text-[10px] text-slate-400 mb-1">关键词提示</div>
          <div className="text-xs font-bold text-blue-600">
            {currentUnit?.vocab.slice(0, 2).map((item) => item.word).join(', ') || 'school, family'}
          </div>
        </button>
        <button className="bg-white p-3 rounded-2xl border border-slate-100 shadow-sm text-center hover:bg-slate-50 transition-all">
          <div className="text-[10px] text-slate-400 mb-1">句式模板</div>
          <div className="text-xs font-bold text-purple-600">
            {currentUnit?.sentences[0]?.text || 'I think... because...'}
          </div>
        </button>
        <button className="bg-white p-3 rounded-2xl border border-slate-100 shadow-sm text-center hover:bg-slate-50 transition-all">
          <div className="text-[10px] text-slate-400 mb-1">参考范文</div>
          <div className="text-xs font-bold text-emerald-600">{currentUnit?.title || 'My School Life'}</div>
        </button>
      </div>
    </div>
  );
};

const ProfileModule = ({
  currentUser,
  onPasswordChanged,
}: {
  currentUser: AppUser;
  onPasswordChanged: (user: AppUser, token: string) => void;
}) => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [sessionHours, setSessionHours] = useState<number>(() => getSavedSessionHours());
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!currentPassword.trim() || !newPassword.trim() || !confirmPassword.trim()) {
      setError('请完整填写密码信息');
      return;
    }

    if (newPassword.trim().length < 6) {
      setError('新密码至少需要 6 位');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('两次输入的新密码不一致');
      return;
    }

    setIsSubmitting(true);
    try {
      const data = await apiFetch<{ token: string; user: AppUser; expiresAt: string }>('/api/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({
          currentPassword,
          newPassword,
          sessionHours,
        }),
      });

      setSavedSessionHours(sessionHours);
      setAuthToken(data.token);
      onPasswordChanged(data.user, data.token);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setError('');
      setSuccessMessage(`密码修改成功，当前登录已续期至 ${new Date(data.expiresAt).toLocaleString()}`);
    } catch (error) {
      setError(error instanceof Error ? error.message : '修改密码失败');
      setSuccessMessage('');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-8 pb-20">
      <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center">
            <User size={30} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-800">我的账号</h2>
            <p className="text-sm text-slate-500">查看当前登录信息并管理密码</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
          <div className="bg-slate-50 rounded-2xl p-4">
            <div className="text-xs text-slate-400 mb-1">用户名</div>
            <div className="font-bold text-slate-800">{currentUser.username}</div>
          </div>
          <div className="bg-slate-50 rounded-2xl p-4">
            <div className="text-xs text-slate-400 mb-1">角色</div>
            <div className="font-bold text-slate-800">{currentUser.role === 'admin' ? '管理员' : '普通用户'}</div>
          </div>
          <div className="bg-slate-50 rounded-2xl p-4">
            <div className="text-xs text-slate-400 mb-1">年级学期</div>
            <div className="font-bold text-slate-800">{currentUser.grade} · {currentUser.semester}</div>
          </div>
          <div className="bg-slate-50 rounded-2xl p-4">
            <div className="text-xs text-slate-400 mb-1">学校</div>
            <div className="font-bold text-slate-800">{currentUser.school}</div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
        <h3 className="font-bold text-slate-800 mb-6">修改密码</h3>
        <form onSubmit={handleChangePassword} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 ml-2 uppercase">当前密码</label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm outline-none focus:border-blue-500 transition-all"
                placeholder="请输入当前密码"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 ml-2 uppercase">新密码</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm outline-none focus:border-blue-500 transition-all"
                placeholder="至少 6 位"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 ml-2 uppercase">确认新密码</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm outline-none focus:border-blue-500 transition-all"
                placeholder="再次输入新密码"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 ml-2 uppercase">登录保留时长</label>
              <select
                value={sessionHours}
                onChange={(e) => setSessionHours(Number(e.target.value))}
                className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm outline-none focus:border-blue-500 transition-all"
              >
                {SESSION_DURATION_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label} · {option.description}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {error && <p className="text-sm font-bold text-red-500">{error}</p>}
          {successMessage && <p className="text-sm font-bold text-emerald-600">{successMessage}</p>}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full md:w-auto px-6 py-3 rounded-xl bg-blue-500 text-white font-bold shadow-lg shadow-blue-100 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50"
          >
            {isSubmitting ? '提交中...' : '更新密码'}
          </button>
        </form>
      </div>
    </div>
  );
};

const Login = ({ onLogin }: { onLogin: (user: AppUser) => void }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sessionHours, setSessionHours] = useState<number>(() => getSavedSessionHours());

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedUsername = username.trim();
    const trimmedPassword = password.trim();

    if (!trimmedUsername || !trimmedPassword) {
      setError('请输入用户名和密码');
      return;
    }

    setIsSubmitting(true);
    try {
      const data = await apiFetch<{ token: string; user: AppUser }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          username: trimmedUsername,
          password: trimmedPassword,
          sessionHours,
        }),
      });

      setSavedSessionHours(sessionHours);
      setAuthToken(data.token);
      setError('');
      onLogin(data.user);
    } catch (error) {
      setError(error instanceof Error ? error.message : '登录失败');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg-main flex items-center justify-center p-4 sm:p-6">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md bg-white rounded-[2rem] sm:rounded-[2.5rem] shadow-2xl shadow-blue-500/10 p-6 sm:p-10 border border-slate-100"
      >
        <div className="text-center mb-10">
          <div className="w-20 h-20 rounded-3xl blue-gradient flex items-center justify-center text-white shadow-xl shadow-blue-200 mx-auto mb-6">
            <Zap size={40} />
          </div>
          <h1 className="text-3xl font-black text-slate-800 tracking-tight mb-2">AceEnglish</h1>
          <p className="text-slate-400 text-sm">请输入管理员账号登录</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-500 ml-4 uppercase tracking-wider">用户名</label>
            <div className="relative">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={20} />
              <input 
                type="text" 
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="admin"
                className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 pl-12 pr-4 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/5 transition-all"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-500 ml-4 uppercase tracking-wider">密码</label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={20} />
              <input 
                type={showPassword ? "text" : "password"} 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 pl-12 pr-12 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/5 transition-all"
              />
              <button 
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500"
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-500 ml-4 uppercase tracking-wider">登录保留时长</label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {SESSION_DURATION_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setSessionHours(option.value)}
                  className={cn(
                    "rounded-xl border px-3 py-3 text-left transition-all",
                    sessionHours === option.value
                      ? "border-blue-500 bg-blue-50 text-blue-700"
                      : "border-slate-100 bg-slate-50 text-slate-500 hover:border-slate-200"
                  )}
                >
                  <div className="text-xs font-bold">{option.label}</div>
                  <div className="text-[10px] opacity-70">{option.description}</div>
                </button>
              ))}
            </div>
          </div>

          {error && (
            <motion.p 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-red-500 text-xs font-bold text-center"
            >
              {error}
            </motion.p>
          )}

          <button 
            type="submit"
            disabled={isSubmitting}
            className="w-full blue-gradient py-4 rounded-2xl text-white font-black shadow-xl shadow-blue-200 hover:scale-[1.02] active:scale-95 transition-all mt-4"
          >
            {isSubmitting ? '登录中...' : '登录系统'}
          </button>
        </form>

        <div className="mt-10 text-center">
          <p className="text-[10px] text-slate-300 uppercase tracking-widest font-bold">
            AceEnglish Management System v1.0
          </p>
        </div>
      </motion.div>
    </div>
  );
};

// --- Main App ---

export default function App() {
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [activeTab, setActiveTab] = useState<AppTabKey>('dashboard');
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [isTextbookLoading, setIsTextbookLoading] = useState(false);
  const [textbooks, setTextbooks] = useState<TextbookSummary[]>([]);
  const [selectedTextbookId, setSelectedTextbookId] = useState('');
  const [selectedTextbook, setSelectedTextbook] = useState<TextbookContent | null>(null);
  const [textbookError, setTextbookError] = useState('');
  const [studyState, setStudyState] = useState<StudyState>(createInitialStudyState([]));

  useEffect(() => {
    const restoreSession = async () => {
      const token = getAuthToken();
      if (!token) {
        setIsAuthLoading(false);
        return;
      }

      try {
        const data = await apiFetch<{ user: AppUser }>('/api/auth/me');
        setCurrentUser(data.user);
      } catch (error) {
        setAuthToken(null);
        setCurrentUser(null);
      } finally {
        setIsAuthLoading(false);
      }
    };

    restoreSession();
  }, []);

  const loadTextbooks = useCallback(async () => {
    if (!currentUser) return;
    setIsTextbookLoading(true);
    try {
      const data = await apiFetch<{ textbooks: TextbookSummary[] }>('/api/textbooks');
      setTextbooks(data.textbooks);

      const savedId = localStorage.getItem(getSelectedTextbookStorageKey(currentUser.username));
      const preferred =
        data.textbooks.find((item) => item.id === savedId) ||
        data.textbooks.find((item) => item.grade === currentUser.grade && item.semester === currentUser.semester) ||
        data.textbooks[0];

      setSelectedTextbookId(preferred?.id || '');
      setTextbookError('');
    } catch (error) {
      setTextbookError(error instanceof Error ? error.message : '加载教材列表失败');
      setTextbooks([]);
      setSelectedTextbookId('');
    } finally {
      setIsTextbookLoading(false);
    }
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser) return;
    loadTextbooks();
  }, [currentUser, loadTextbooks]);

  useEffect(() => {
    if (!currentUser || !selectedTextbookId) {
      setSelectedTextbook(null);
      return;
    }

    let cancelled = false;
    const loadSelectedTextbook = async () => {
      try {
        const data = await apiFetch<{ textbook: TextbookContent }>(`/api/textbooks/${selectedTextbookId}`);
        if (!cancelled) {
          setSelectedTextbook(data.textbook);
          localStorage.setItem(getSelectedTextbookStorageKey(currentUser.username), selectedTextbookId);
          setTextbookError('');
        }
      } catch (error) {
        if (!cancelled) {
          setSelectedTextbook(null);
          setTextbookError(error instanceof Error ? error.message : '加载教材内容失败');
        }
      }
    };

    loadSelectedTextbook();

    return () => {
      cancelled = true;
    };
  }, [currentUser?.username, selectedTextbookId]);

  const availableUnits = buildUnitBundlesFromTextbook(selectedTextbook);
  const currentUnit = availableUnits.find((unit) => unit.id === studyState.currentUnitId) || availableUnits[0] || null;

  useEffect(() => {
    if (!currentUser || !selectedTextbookId) {
      setStudyState(createInitialStudyState([]));
      return;
    }
    const raw = localStorage.getItem(getStudyStorageKey(currentUser.username, selectedTextbookId));
    try {
      const parsed = raw ? JSON.parse(raw) as Partial<StudyState> : null;
      setStudyState(normalizeStudyState(parsed, availableUnits));
    } catch (error) {
      setStudyState(createInitialStudyState(availableUnits));
    }
  }, [currentUser?.username, selectedTextbookId, availableUnits.length]);

  useEffect(() => {
    if (!currentUser || !selectedTextbookId) return;
    localStorage.setItem(getStudyStorageKey(currentUser.username, selectedTextbookId), JSON.stringify(studyState));
  }, [studyState, currentUser?.username, selectedTextbookId]);

  const handleSelectUnit = (unitId: string) => {
    setStudyState((prev) => ({
      ...prev,
      currentUnitId: unitId,
      currentStage: 'preview',
    }));
  };

  const handleSelectStage = (stage: LessonStageKey) => {
    setStudyState((prev) => ({
      ...prev,
      currentStage: stage,
    }));
  };

  const getTextbookTabByStage = (stage: LessonStageKey): AppTabKey =>
    stage === 'preview'
      ? 'textbook-preview'
      : stage === 'reading'
        ? 'textbook-sentences'
        : stage === 'dictation'
          ? 'dictation'
          : 'tutor';

  const handleOpenStage = (stage: LessonStageKey) => {
    handleSelectStage(stage);
    setActiveTab(getTextbookTabByStage(stage));
  };

  const updateTodayRecord = (
    prev: StudyState,
    updater: (record: DailyCheckinRecord) => DailyCheckinRecord
  ): DailyCheckinRecord[] => {
    const today = getTodayKey();
    const existing = getOrCreateDailyCheckin(prev, today);
    const nextRecord = updater(existing);
    const rest = prev.dailyCheckins.filter((item) => item.date !== today);
    return [nextRecord, ...rest].slice(0, 30);
  };

  const handleCompleteStage = (stage: LessonStageKey) => {
    if (!currentUnit) return;
    const taskId = createTaskId(currentUnit.id, stage);
    setStudyState((prev) => ({
      ...prev,
      currentStage: stage,
      completedTaskIds: prev.completedTaskIds.includes(taskId)
        ? prev.completedTaskIds
        : [...prev.completedTaskIds, taskId],
      dailyCheckins: updateTodayRecord(prev, (record) => ({
        ...record,
        completedTaskIds: record.completedTaskIds.includes(taskId)
          ? record.completedTaskIds
          : [...record.completedTaskIds, taskId],
      })),
    }));
  };

  const handleMarkWord = (wordId: string, mastered: boolean) => {
    setStudyState((prev) => ({
      ...prev,
      masteredWordIds: mastered
        ? Array.from(new Set([...prev.masteredWordIds, wordId]))
        : prev.masteredWordIds.filter((id) => id !== wordId),
    }));
  };

  const handleToggleSentenceFollowed = (sentenceId: string) => {
    setStudyState((prev) => ({
      ...prev,
      followedSentenceIds: prev.followedSentenceIds.includes(sentenceId)
        ? prev.followedSentenceIds.filter((id) => id !== sentenceId)
        : [...prev.followedSentenceIds, sentenceId],
    }));
  };

  const handleCompleteGrammarExercise = (exerciseId: string) => {
    setStudyState((prev) => ({
      ...prev,
      completedGrammarQuestionIds: prev.completedGrammarQuestionIds.includes(exerciseId)
        ? prev.completedGrammarQuestionIds
        : [...prev.completedGrammarQuestionIds, exerciseId],
      dailyCheckins: updateTodayRecord(prev, (record) => ({
        ...record,
        completedTaskIds: record.completedTaskIds.includes(`grammar:${exerciseId}`)
          ? record.completedTaskIds
          : [...record.completedTaskIds, `grammar:${exerciseId}`],
      })),
    }));
  };

  const handleAddPronunciationAssessment = (record: Omit<PronunciationAssessmentRecord, 'id' | 'createdAt'>) => {
    setStudyState((prev) => ({
      ...prev,
      pronunciationAssessments: [
        {
          ...record,
          id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
          createdAt: new Date().toISOString(),
        },
        ...prev.pronunciationAssessments.filter((item) => item.sentenceId !== record.sentenceId),
      ].slice(0, 30),
    }));
  };

  const handleAddMistake = (record: Omit<MistakeRecord, 'id' | 'createdAt'>) => {
    setStudyState((prev) => ({
      ...prev,
      mistakes: [
        {
          ...record,
          id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
          createdAt: new Date().toISOString(),
        },
        ...prev.mistakes.filter((item) => !(item.prompt === record.prompt && item.stage === record.stage && item.reason === record.reason)),
      ].slice(0, 30),
    }));
  };

  const handleRetryMistake = (mistake: MistakeRecord) => {
    setStudyState((prev) => ({
      ...prev,
      currentUnitId: mistake.unitId,
      currentStage: mistake.stage,
    }));
    setActiveTab(getTextbookTabByStage(mistake.stage));
  };

  const handleCompleteRecommendation = (item: RecommendationItem) => {
    setStudyState((prev) => ({
      ...prev,
      currentStage: item.stage,
      dailyCheckins: updateTodayRecord(prev, (record) => ({
        ...record,
        recommendationIds: record.recommendationIds.includes(item.id)
          ? record.recommendationIds
          : [...record.recommendationIds, item.id],
      })),
    }));
  };

  const handleCheckInToday = () => {
    setStudyState((prev) => ({
      ...prev,
      dailyCheckins: updateTodayRecord(prev, (record) => {
        const status = calculateCheckinStatus(record);
        return status.ready ? { ...record, checkedIn: true } : record;
      }),
    }));
  };

  const handleOpenChallenge = () => {
    setActiveTab('challenge');
  };

  const handleCompleteChallenge = (score: number, total: number) => {
    if (!currentUnit) return;
    setStudyState((prev) => ({
      ...prev,
      challengeAttempts: [
        {
          id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
          unitId: currentUnit.id,
          score,
          total,
          completedAt: new Date().toISOString(),
        },
        ...prev.challengeAttempts,
      ].slice(0, 20),
      dailyCheckins: updateTodayRecord(prev, (record) => ({
        ...record,
        challengeCompleted: true,
      })),
    }));
    setActiveTab('dashboard');
  };

  const navItems: Array<{ id: AppTabKey; label: string; icon: React.ElementType; primary?: boolean }> = [
    { id: 'dashboard', label: '首页', icon: LayoutDashboard },
    { id: 'textbook-overview', label: '单元总览', icon: BookOpen },
    { id: 'textbook-preview', label: '词汇预习', icon: GraduationCap },
    { id: 'textbook-sentences', label: '重点句', icon: MessageSquare },
    { id: 'textbook-grammar', label: '语法', icon: PencilLine },
    { id: 'textbook-reading', label: '朗读评测', icon: Headphones },
    { id: 'dictation', label: '听写', icon: PencilLine },
    { id: 'tutor', label: 'AI外教', icon: Mic2, primary: true },
    { id: 'stats', label: '统计', icon: BarChart3 },
    { id: 'profile', label: '我的', icon: Settings },
  ];

  // Add management tab for admin
  const displayNavItems = currentUser?.role === 'admin' 
    ? [...navItems, { id: 'manage' as AppTabKey, label: '管理', icon: ShieldCheck }]
    : navItems;

  if (isAuthLoading) {
    return (
      <div className="min-h-screen bg-bg-main flex items-center justify-center text-slate-400">
        正在恢复登录状态...
      </div>
    );
  }

  if (!currentUser) {
    return <Login onLogin={(user) => setCurrentUser(user)} />;
  }

  return (
    <div className="min-h-screen bg-bg-main flex flex-col xl:flex-row font-sans">
      {/* Desktop Sidebar */}
      <aside className="hidden xl:flex w-72 bg-white border-r border-slate-100 flex-col p-6 sticky top-0 h-screen">
        <div className="mb-10">
          <h1 className="text-2xl font-black text-blue-600 tracking-tight">AceEnglish</h1>
          <p className="text-[10px] text-slate-400 mt-1">英语听说提分管家</p>
        </div>

        <nav className="flex-1 space-y-2">
          {displayNavItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-2xl font-bold transition-all",
                activeTab === item.id 
                  ? "bg-blue-500 text-white shadow-lg shadow-blue-100" 
                  : "text-slate-400 hover:bg-slate-50 hover:text-slate-600"
              )}
            >
              <item.icon size={20} />
              <span className="text-sm">{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="mt-auto space-y-4">
          <div className="p-4 bg-slate-50 rounded-2xl">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-blue-100 overflow-hidden">
                <img src="https://picsum.photos/seed/user/100/100" alt="Avatar" referrerPolicy="no-referrer" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-800 truncate">{currentUser.username}</p>
                <p className="text-[10px] text-slate-400">{currentUser.school} · {currentUser.grade} {currentUser.semester || '上学期'}</p>
              </div>
            </div>
            <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
              <div className="h-full bg-blue-500 w-3/4" />
            </div>
          </div>
          
          <button 
            onClick={async () => {
              try {
                await apiFetch<{ ok: true }>('/api/auth/logout', { method: 'POST' });
              } catch (error) {
                console.error(error);
              } finally {
                setAuthToken(null);
                setSelectedTextbookId('');
                setSelectedTextbook(null);
                setTextbooks([]);
                setCurrentUser(null);
              }
            }}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl font-bold text-red-400 hover:bg-red-50 transition-all"
          >
            <LogOut size={20} />
            <span className="text-sm">退出登录</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header (Mobile & Desktop) */}
        <header className="px-4 py-4 sm:px-6 lg:px-8 flex items-center justify-between gap-3 sticky top-0 bg-bg-main/80 backdrop-blur-md z-40">
          <div className="xl:hidden min-w-0">
            <h1 className="text-xl font-black text-blue-600 tracking-tight">AceEnglish</h1>
          </div>
          <div className="hidden xl:block">
            <div className="flex items-center gap-2 text-slate-400 text-sm">
              <span>学习中心</span>
              <ChevronRight size={14} />
              <span className="text-slate-800 font-bold">
                {displayNavItems.find(i => i.id === activeTab)?.label}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-4">
            <div className="hidden lg:flex items-center bg-white border border-slate-100 rounded-full px-4 py-2 shadow-sm">
              <Search size={16} className="text-slate-400 mr-2" />
              <input type="text" placeholder="搜索课程或单词..." className="bg-transparent text-xs outline-none w-32 lg:w-48" />
            </div>
            <button className="relative w-10 h-10 rounded-full bg-white shadow-sm flex items-center justify-center text-slate-400">
              <Bell size={20} />
              <div className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white" />
            </button>
          </div>
        </header>

        <div className="xl:hidden px-4 sm:px-6 lg:px-8 mb-4">
          <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar">
            {displayNavItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={cn(
                  "shrink-0 flex items-center gap-2 px-4 py-2 rounded-2xl text-sm font-bold border transition-all",
                  activeTab === item.id
                    ? "bg-blue-500 text-white border-blue-500 shadow-lg shadow-blue-100"
                    : "bg-white text-slate-500 border-slate-100"
                )}
              >
                <item.icon size={16} />
                <span>{item.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Content Scroll Area */}
        <main className="flex-1 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full pb-28 xl:pb-10">
          <div className="mb-6 bg-white rounded-3xl p-4 sm:p-5 shadow-sm border border-slate-100">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div>
                <div className="text-xs font-bold uppercase tracking-[0.2em] text-blue-500">Textbook Selector</div>
                <h2 className="text-lg font-bold text-slate-800 mt-2">选择当前学习教材</h2>
                <p className="text-sm text-slate-500 mt-1">
                  {selectedTextbook
                    ? `${selectedTextbook.publisher} · ${selectedTextbook.title} · ${selectedTextbook.units.length} 个单元`
                    : currentUser.role === 'admin'
                      ? '当前还没有导入教材，请前往管理页导入样板教材。'
                      : '当前还没有可用教材，请联系管理员导入教材。'}
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
                <select
                  value={selectedTextbookId}
                  onChange={(e) => setSelectedTextbookId(e.target.value)}
                  className="w-full sm:min-w-[260px] bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 text-sm outline-none focus:border-blue-500 transition-all"
                  disabled={isTextbookLoading || textbooks.length === 0}
                >
                  <option value="">{isTextbookLoading ? '教材加载中...' : '请选择教材'}</option>
                  {textbooks.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.title} · {item.grade} {item.semester}
                    </option>
                  ))}
                </select>
                {currentUser.role === 'admin' && (
                  <button
                    onClick={() => setActiveTab('manage')}
                    className="px-4 py-3 rounded-2xl bg-emerald-500 text-white text-sm font-bold"
                  >
                    管理教材
                  </button>
                )}
              </div>
            </div>
            {textbookError && <p className="text-xs font-bold text-red-500 mt-3">{textbookError}</p>}
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="h-full"
            >
              {!selectedTextbook && activeTab !== 'manage' ? (
                <div className="bg-white rounded-3xl p-10 shadow-sm border border-slate-100 text-center">
                  <BookOpen size={48} className="mx-auto mb-4 text-slate-300" />
                  <h3 className="text-xl font-bold text-slate-800">还没有可用教材</h3>
                  <p className="text-sm text-slate-500 mt-2">
                    {currentUser.role === 'admin' ? '请先在管理页导入外研版教材样板，再开始学习流程。' : '请联系管理员导入教材后再开始学习。'}
                  </p>
                  {currentUser.role === 'admin' && (
                    <button
                      onClick={() => setActiveTab('manage')}
                      className="mt-5 px-5 py-3 rounded-2xl bg-blue-500 text-white font-bold"
                    >
                      前往教材导入后台
                    </button>
                  )}
                </div>
              ) : activeTab === 'dashboard' && (
                <Dashboard
                  currentUser={currentUser}
                  currentUnit={currentUnit}
                  studyState={studyState}
                  onSelectStage={handleSelectStage}
                  onOpenStage={handleOpenStage}
                  onOpenChallenge={handleOpenChallenge}
                  onCheckInToday={handleCheckInToday}
                  onCompleteRecommendation={handleCompleteRecommendation}
                />
              )}
              {(activeTab === 'textbook-overview' ||
                activeTab === 'textbook-preview' ||
                activeTab === 'textbook-sentences' ||
                activeTab === 'textbook-grammar' ||
                activeTab === 'textbook-reading') && (
                <TextbookModule
                  units={availableUnits}
                  currentUnit={currentUnit}
                  studyState={studyState}
                  onSelectUnit={handleSelectUnit}
                  onSelectStage={handleSelectStage}
                  onOpenStage={handleOpenStage}
                  onMarkWord={handleMarkWord}
                  onToggleSentenceFollowed={handleToggleSentenceFollowed}
                  onCompleteStage={handleCompleteStage}
                  onCompleteGrammarExercise={handleCompleteGrammarExercise}
                  onAddPronunciationAssessment={handleAddPronunciationAssessment}
                  onAddMistake={handleAddMistake}
                  playWordAudio={playWordAudio}
                  fetchSpeechToken={() => apiFetch<SpeechTokenResponse>('/api/speech-token')}
                  lockedPage={
                    activeTab === 'textbook-overview'
                      ? 'overview'
                      : activeTab === 'textbook-preview'
                        ? 'preview'
                        : activeTab === 'textbook-sentences'
                          ? 'sentences'
                          : activeTab === 'textbook-grammar'
                            ? 'grammar'
                            : 'reading-practice'
                  }
                />
              )}
              {activeTab === 'dictation' && (
                <DictationModule
                  currentUnit={currentUnit}
                  onCompleteStage={handleCompleteStage}
                  onAddMistake={handleAddMistake}
                  playWordAudio={playWordAudio}
                  generateTTS={generateTTS}
                  playBrowserTTS={playBrowserTTS}
                  classifyDictationIssue={classifyDictationIssue}
                  mistakeReasonLabels={MISTAKE_REASON_LABELS}
                />
              )}
              {activeTab === 'tutor' && (
                <AITutor
                  currentUnit={currentUnit}
                  onCompleteStage={handleCompleteStage}
                  onAddMistake={handleAddMistake}
                  fetchSpeechToken={() => apiFetch<SpeechTokenResponse>('/api/speech-token')}
                />
              )}
              {activeTab === 'stats' && (
                <Statistics
                  studyState={studyState}
                  currentUnit={currentUnit}
                  onRetryMistake={handleRetryMistake}
                  mistakeReasonLabels={MISTAKE_REASON_LABELS}
                  getWeaknessSummary={getWeaknessSummary}
                  buildReviewPack={buildReviewPack}
                  stageMeta={STAGE_META}
                />
              )}
              {activeTab === 'profile' && (
                <ProfileModule
                  currentUser={currentUser}
                  onPasswordChanged={(user, token) => {
                    setAuthToken(token);
                    setCurrentUser(user);
                  }}
                />
              )}
              {activeTab === 'challenge' && (
                <ChallengeModule
                  currentUnit={currentUnit}
                  studyState={studyState}
                  onBack={() => setActiveTab('dashboard')}
                  onCompleteChallenge={handleCompleteChallenge}
                  buildChallengeQuestions={buildChallengeQuestions}
                  getUnitChallengeStatus={getUnitChallengeStatus}
                  getChallengeHistoryForUnit={getChallengeHistoryForUnit}
                />
              )}
              {activeTab === 'manage' && (
                <ManagementModule
                  textbooks={textbooks}
                  onTextbooksChanged={loadTextbooks}
                  apiFetch={apiFetch}
                  gradeOptions={GRADES}
                  semesterOptions={SEMESTERS}
                  defaultAIConfig={DEFAULT_AI_CONFIG}
                  aiConfigStorageKey={AI_CONFIG_STORAGE_KEY}
                  buildUnitBundlesFromTextbook={buildUnitBundlesFromTextbook}
                  loadStudyStateForUser={loadStudyStateForUser}
                  createInitialStudyState={createInitialStudyState}
                  getUnitChallengeStatus={getUnitChallengeStatus}
                  getCheckinStreak={getCheckinStreak}
                  buildSevenDayTrend={buildSevenDayTrend}
                />
              )}
              {activeTab === 'exam' && (
                <div className="flex flex-col items-center justify-center h-[60vh] text-slate-400">
                  <Mic2 size={64} className="mb-4 opacity-20" />
                  <p className="font-bold">{displayNavItems.find(i => i.id === activeTab)?.label}模块开发中</p>
                  <p className="text-xs">即将上线，敬请期待</p>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-lg border-t border-slate-100 px-3 py-3 overflow-x-auto custom-scrollbar z-50">
        <div className="flex items-end gap-4 min-w-max">
        {displayNavItems.map((item) => (
          item.primary ? (
            <div key={item.id} className="relative -top-6">
              <button 
                onClick={() => setActiveTab(item.id)}
                className="w-14 h-14 rounded-full blue-gradient flex items-center justify-center text-white shadow-xl shadow-blue-200 active:scale-95 transition-all"
              >
                <item.icon size={28} />
              </button>
            </div>
          ) : (
            <button 
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={cn("flex flex-col items-center gap-1 transition-all min-w-[48px]", activeTab === item.id ? "text-blue-500" : "text-slate-400")}
            >
              <item.icon size={24} />
              <span className="text-[10px] font-bold">{item.label}</span>
            </button>
          )
        ))}
        </div>
      </nav>
    </div>
  );
}
