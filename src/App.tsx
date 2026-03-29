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
  Plus,
  Trash2,
  Save,
  School,
  GraduationCap,
  PencilLine,
  ChevronDown,
  AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from './lib/utils';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line
} from 'recharts';

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

type LessonStageKey = 'preview' | 'reading' | 'dictation' | 'speaking';
type MistakeCategory = 'vocab' | 'dictation' | 'speaking';
type MistakeReason =
  | 'unknown_vocab'
  | 'pronunciation'
  | 'missing_word'
  | 'spelling'
  | 'punctuation'
  | 'sentence_structure'
  | 'too_short'
  | 'off_topic'
  | 'fluency';

interface LessonStage {
  key: LessonStageKey;
  title: string;
  description: string;
  estimatedMinutes: number;
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

interface StudyState {
  currentUnitId: string;
  currentStage: LessonStageKey;
  completedTaskIds: string[];
  masteredWordIds: string[];
  followedSentenceIds: string[];
  mistakes: MistakeRecord[];
  dailyCheckins: DailyCheckinRecord[];
  challengeAttempts: ChallengeAttempt[];
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

const createTaskId = (unitId: string, stage: LessonStageKey) => `${unitId}:${stage}`;

const getStudyStorageKey = (username: string, textbookId: string) => `${STUDY_STATE_STORAGE_PREFIX}:${username}:${textbookId}`;
const getSelectedTextbookStorageKey = (username: string) => `ace_selected_textbook:${username}`;

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
    }));
};

const createInitialStudyState = (units: UnitBundle[]): StudyState => ({
  currentUnitId: units[0]?.id || '',
  currentStage: 'preview',
  completedTaskIds: [],
  masteredWordIds: [],
  followedSentenceIds: [],
  mistakes: [],
  dailyCheckins: [],
  challengeAttempts: [],
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
    mistakes: Array.isArray(raw.mistakes) ? raw.mistakes.slice(0, 30) : [],
    dailyCheckins: Array.isArray(raw.dailyCheckins) ? raw.dailyCheckins.slice(0, 30) : [],
    challengeAttempts: Array.isArray(raw.challengeAttempts) ? raw.challengeAttempts.slice(0, 20) : [],
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
};

const getStageLabel = (stage: LessonStageKey) =>
  stage === 'preview' ? '课时1 词汇预习' :
  stage === 'reading' ? '课时2 重点句跟读' :
  stage === 'dictation' ? '课时3 听写巩固' :
  '课时4 口语表达';

const getLessonOutcomeLabel = (unit: UnitBundle | null, stage: LessonStageKey, studyState: StudyState) => {
  if (!unit) return '暂无课时数据';

  if (stage === 'preview') {
    const mastered = unit.vocab.filter((word) => studyState.masteredWordIds.includes(word.id)).length;
    return `已掌握 ${mastered}/${unit.vocab.length || 0} 个核心词汇`;
  }

  if (stage === 'reading') {
    const followed = unit.sentences.filter((sentence) => studyState.followedSentenceIds.includes(sentence.id)).length;
    return `已完成 ${followed}/${unit.sentences.length || 0} 句重点句跟读`;
  }

  if (stage === 'dictation') {
    const count = studyState.mistakes.filter((item) => item.stage === 'dictation' && item.unitId === unit.id).length;
    return count > 0 ? `待复盘 ${count} 条听写问题` : '本单元听写表现稳定';
  }

  const count = studyState.mistakes.filter((item) => item.stage === 'speaking' && item.unitId === unit.id).length;
  return count > 0 ? `待优化 ${count} 条口语反馈` : '口语输出已形成基本闭环';
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

const calculateTextSimilarity = (input: string, target: string) => {
  const normalizedInput = normalizeEnglishText(input);
  const normalizedTarget = normalizeEnglishText(target);

  if (!normalizedInput || !normalizedTarget) return 0;
  if (normalizedInput === normalizedTarget) return 100;

  const inputWords = normalizedInput.split(' ');
  const targetWords = normalizedTarget.split(' ');
  const matchedWords = targetWords.filter((word) => inputWords.includes(word)).length;
  const ratio = matchedWords / Math.max(targetWords.length, 1);
  return Math.max(0, Math.min(100, Math.round(ratio * 100)));
};

const getPronunciationHint = (score: number) => {
  if (score >= 90) return '发音和内容都比较接近原句，可以继续保持这个节奏。';
  if (score >= 70) return '整体不错，建议再注意连读、重音和停顿，让句子更完整自然。';
  if (score >= 50) return '能说出部分关键词，建议先听一句、跟一句，再完整复述。';
  return '和目标句差距还比较大，建议先慢速播放原句，再分段录音练习。';
};

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

const StatCard = ({ label, value, icon: Icon, colorClass }: any) => (
  <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 flex flex-col items-center justify-center min-w-[100px] flex-1">
    <span className="text-slate-400 text-xs mb-1">{label}</span>
    <div className={cn("text-xl font-bold mb-1", colorClass)}>{value}</div>
    {Icon && <Icon size={16} className="text-slate-300" />}
  </div>
);

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

const Statistics = ({
  studyState,
  currentUnit,
  onRetryMistake,
}: {
  studyState: StudyState;
  currentUnit: UnitBundle | null;
  onRetryMistake: (mistake: MistakeRecord) => void;
}) => {
  const [categoryFilter, setCategoryFilter] = useState<'all' | MistakeCategory>('all');
  const [stageFilter, setStageFilter] = useState<'all' | LessonStageKey>('all');
  const [unitFilter, setUnitFilter] = useState<string>('all');
  const totalTasks = studyState.completedTaskIds.length;
  const accuracy = studyState.mistakes.length + totalTasks > 0
    ? Math.round((totalTasks / (studyState.mistakes.length + totalTasks)) * 100)
    : 100;
  const weaknessSummary = getWeaknessSummary(studyState);
  const filteredMistakes = studyState.mistakes.filter((mistake) => {
    if (categoryFilter !== 'all' && mistake.category !== categoryFilter) return false;
    if (stageFilter !== 'all' && mistake.stage !== stageFilter) return false;
    if (unitFilter !== 'all' && mistake.unitId !== unitFilter) return false;
    return true;
  });
  const unitOptions = Array.from(new Set(studyState.mistakes.map((mistake) => mistake.unitId)));
  const reviewPack = buildReviewPack(studyState);
  const topWeakness = [...weaknessSummary].sort((a, b) => b.count - a.count)[0];
  const topActions = [
    reviewPack[0] ? `先复练：${reviewPack[0].reasonLabel}` : '继续保持当前节奏',
    topWeakness?.count
      ? topWeakness.hint
      : '当前弱项压力不大，可以进入下一个课时',
    currentUnit ? `当前单元建议优先完成 ${getStageLabel(currentUnit.stages.find((stage) => !studyState.completedTaskIds.includes(createTaskId(currentUnit.id, stage.key)))?.key || studyState.currentStage)}` : '暂无当前单元',
  ];
  const progressChart = STAGE_META.map((stage) => ({
    name: stage.title.replace('课时', '').slice(0, 6),
    completed: studyState.completedTaskIds.filter((id) => id.endsWith(`:${stage.key}`)).length,
    target: 1,
  }));
  const pieData = [
    { name: '词汇', value: studyState.masteredWordIds.length || 1, color: '#10b981' },
    { name: '跟读', value: studyState.followedSentenceIds.length || 1, color: '#3b82f6' },
    { name: '错题复盘', value: studyState.mistakes.length || 1, color: '#f97316' },
  ];

  return (
    <div className="space-y-6 pb-20">
      <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-black text-slate-800">成长报告</h2>
            <p className="text-sm text-slate-500 mt-1">
              {currentUnit ? `当前跟踪单元：${currentUnit.unit} · ${currentUnit.title}` : '暂无当前单元'}
            </p>
          </div>
          <div className="flex gap-3">
            <StatCard label="已完成课时" value={`${totalTasks}/4`} colorClass="text-blue-500" />
            <StatCard label="综合准确率" value={`${accuracy}%`} colorClass="text-emerald-500" />
            <StatCard label="待复盘错题" value={String(studyState.mistakes.length)} colorClass="text-rose-500" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
          <h3 className="font-bold text-slate-800 mb-6">课时推进情况</h3>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={progressChart}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                <Tooltip />
                <Bar dataKey="target" fill="#e2e8f0" radius={[4, 4, 0, 0]} barSize={18} />
                <Bar dataKey="completed" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={18} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
          <h3 className="font-bold text-slate-800 mb-6">学习投入结构</h3>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={5} dataKey="value">
                  {pieData.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex justify-center gap-4 mt-2">
            {pieData.map((item) => (
              <div key={item.name} className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                <span className="text-[10px] text-slate-500">{item.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
          <h3 className="font-bold text-slate-800 mb-4">今天最该补什么</h3>
          <div className="space-y-3">
            {topActions.map((item) => (
              <div key={item} className="rounded-2xl bg-slate-50 border border-slate-100 p-4 text-sm text-slate-600">
                {item}
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
          <h3 className="font-bold text-slate-800 mb-4">弱项分析</h3>
          <div className="space-y-4">
            {weaknessSummary.map((item) => {
              const total = Math.max(studyState.mistakes.length, 1);
              const value = Math.min(100, Math.round((item.count / total) * 100));
              return (
                <div key={item.label}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-700 font-medium">{item.label}</span>
                    <span className="text-slate-400">{value}% 关注度</span>
                  </div>
                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full bg-blue-500" style={{ width: `${value}%` }} />
                  </div>
                  <p className="text-xs text-slate-500 mt-2">{item.hint}</p>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
          <h3 className="font-bold text-slate-800 mb-4">错题本</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-4">
            <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value as 'all' | MistakeCategory)} className="bg-slate-50 border border-slate-100 rounded-xl px-3 py-2 text-xs outline-none">
              <option value="all">全部类型</option>
              <option value="vocab">词汇</option>
              <option value="dictation">听写</option>
              <option value="speaking">口语</option>
            </select>
            <select value={stageFilter} onChange={(e) => setStageFilter(e.target.value as 'all' | LessonStageKey)} className="bg-slate-50 border border-slate-100 rounded-xl px-3 py-2 text-xs outline-none">
              <option value="all">全部课时</option>
              <option value="preview">课时1 预习</option>
              <option value="reading">课时2 跟读</option>
              <option value="dictation">课时3 听写</option>
              <option value="speaking">课时4 口语</option>
            </select>
            <select value={unitFilter} onChange={(e) => setUnitFilter(e.target.value)} className="bg-slate-50 border border-slate-100 rounded-xl px-3 py-2 text-xs outline-none">
              <option value="all">全部单元</option>
              {unitOptions.map((unitId) => (
                <option key={unitId} value={unitId}>{unitId.split('-').slice(-1)[0]}</option>
              ))}
            </select>
          </div>
          <div className="space-y-3">
            {filteredMistakes.length === 0 ? (
              <div className="rounded-2xl bg-emerald-50 border border-emerald-100 p-4 text-sm text-emerald-700">
                当前筛选条件下没有错题，可以切换筛选或继续推进课时。
              </div>
            ) : (
              filteredMistakes.slice(0, 6).map((mistake) => (
                <div key={mistake.id} className="rounded-2xl bg-slate-50 border border-slate-100 p-4">
                  <div className="text-xs font-bold text-slate-400 mb-1">
                    {mistake.stage === 'preview' ? '词汇预习' : mistake.stage === 'dictation' ? '听写巩固' : '口语表达'}
                  </div>
                  <div className="text-sm font-bold text-slate-800">{mistake.prompt}</div>
                  <div className="text-xs text-slate-500 mt-1">你的答案：{mistake.answer || '未作答'}</div>
                  <div className="text-xs text-rose-600 mt-1">正确内容：{mistake.expected}</div>
                  {mistake.reason && (
                    <div className="text-xs text-amber-600 mt-1">错误类型：{MISTAKE_REASON_LABELS[mistake.reason]}</div>
                  )}
                  {mistake.hint && (
                    <div className="text-xs text-slate-500 mt-1">复习建议：{mistake.hint}</div>
                  )}
                  <button
                    onClick={() => onRetryMistake(mistake)}
                    className="mt-3 px-3 py-2 rounded-xl bg-blue-500 text-white text-xs font-bold"
                  >
                    立即复练
                  </button>
                </div>
              ))
            )}
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
}: {
  currentUnit: UnitBundle | null;
  onCompleteStage: (stage: LessonStageKey) => void;
  onAddMistake: (record: Omit<MistakeRecord, 'id' | 'createdAt'>) => void;
}) => {
  const coachConfig = getSpeakingCoachConfig(currentUnit);
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
  const recognitionRef = useRef<any>(null);

  // 存储识别候选结果
  const [recognitionAlternatives, setRecognitionAlternatives] = useState<string[]>([]);
  const [showAlternatives, setShowAlternatives] = useState(false);
  const [recognitionConfidence, setRecognitionConfidence] = useState(0);
  const [practiceFeedback, setPracticeFeedback] = useState<{ level: 'good' | 'needs-work'; text: string } | null>(null);

  useEffect(() => {
    setMessages([{ role: 'ai', text: starterQuestion }]);
    setPracticeFeedback(null);
  }, [starterQuestion]);

  // 教育场景常用词汇提示，帮助提高识别准确率
  const EDUCATION_PHRASES = [
    'school', 'student', 'teacher', 'classroom', 'homework', 'assignment',
    'examination', 'exam', 'test', 'quiz', 'study', 'learn', 'education',
    'knowledge', 'understand', 'remember', 'practice', 'review', 'preview',
    'mathematics', 'physics', 'chemistry', 'biology', 'history', 'geography',
    'literature', 'language', 'English', 'Chinese', 'science', 'art', 'music',
    'because', 'therefore', 'however', 'although', 'furthermore', 'moreover',
    'favorite', 'interesting', 'difficult', 'important', 'necessary',
    'hobby', 'interest', 'sport', 'reading', 'writing', 'listening', 'speaking'
  ];

  // 初始化语音识别
  const initSpeechRecognition = useCallback(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.maxAlternatives = 5; // 获取5个识别候选结果
      recognition.lang = accent === 'US' ? 'en-US' : 'en-GB';

      // 使用自定义词汇提示（如果浏览器支持）
      if ('grammars' in recognition) {
        try {
          const SpeechGrammarList = (window as any).SpeechGrammarList || (window as any).webkitSpeechGrammarList;
          if (SpeechGrammarList) {
            const grammarList = new SpeechGrammarList();
            // 添加教育场景常用词汇
            const grammar = '#JSGF V1.0; grammar education; public <education> = ' + EDUCATION_PHRASES.join(' | ') + ';';
            grammarList.addFromString(grammar, 1);
            recognition.grammars = grammarList;
          }
        } catch (e) {
          console.log('Grammar list not supported');
        }
      }

      recognition.onresult = (event: any) => {
        const results = event.results[0];
        const transcript = results[0].transcript;
        const confidence = results[0].confidence || 0;
        
        setRecognitionConfidence(confidence);
        
        // 收集所有候选结果
        const alternatives: string[] = [];
        for (let i = 0; i < results.length; i++) {
          if (results[i].transcript && results[i].transcript !== transcript) {
            alternatives.push(results[i].transcript);
          }
        }
        setRecognitionAlternatives(alternatives);
        
        setInputValue(transcript);
        
        if (event.results[0].isFinal) {
          setIsListening(false);
          // 如果置信度较低，显示候选选项
          if (confidence < 0.7 && alternatives.length > 0) {
            setShowAlternatives(true);
            if (currentUnit) {
              onAddMistake({
                unitId: currentUnit.id,
                category: 'speaking',
                stage: 'speaking',
                prompt: '语音识别置信度较低',
                expected: transcript,
                answer: alternatives[0] || transcript,
                reason: 'pronunciation',
                hint: '建议放慢语速，再说一遍完整句子。',
              });
            }
          }
        }
      };

      recognition.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        if (event.error === 'not-allowed') {
          alert('麦克风权限被拒绝，请在浏览器设置中允许使用麦克风。');
        } else if (event.error === 'network') {
          alert('语音识别网络错误，请检查网络连接。');
        } else if (event.error === 'no-speech') {
          // 没有检测到语音，不显示错误
          console.log('No speech detected');
        } else if (event.error !== 'aborted') {
          alert(`语音识别发生错误: ${event.error}`);
        }
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
      return true;
    }
    return false;
  }, [accent]);

  // 选择候选文本
  const selectAlternative = (text: string) => {
    setInputValue(text);
    setShowAlternatives(false);
  };

  // 组件挂载时初始化
  useEffect(() => {
    // 尝试立即初始化
    if (!initSpeechRecognition()) {
      // 如果失败，延迟重试（某些浏览器需要时间加载）
      const timer = setTimeout(() => {
        initSpeechRecognition();
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, []);

  // accent 变化时更新识别语言
  useEffect(() => {
    if (recognitionRef.current) {
      recognitionRef.current.lang = accent === 'US' ? 'en-US' : 'en-GB';
    }
  }, [accent]);

  const toggleListening = () => {
    // 如果没有初始化，尝试初始化
    if (!recognitionRef.current) {
      if (!initSpeechRecognition()) {
        alert('您的浏览器不支持语音识别功能，推荐使用 Chrome 或 Edge 浏览器。');
        return;
      }
    }

    if (isListening) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        console.error(e);
      }
      setIsListening(false);
    } else {
      try {
        recognitionRef.current.start();
        setIsListening(true);
      } catch (error: any) {
        console.error('Failed to start recognition:', error);
        if (error.name === 'NotAllowedError') {
          alert('麦克风权限被拒绝，请在浏览器设置中允许使用麦克风。');
        } else {
          alert('无法启动麦克风，请检查权限设置或刷新页面重试。');
        }
        setIsListening(false);
      }
    }
  };

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!inputValue.trim() || isLoading) return;

    const userText = inputValue;
    setInputValue('');
    setMessages(prev => [...prev, { role: 'user', text: userText }]);
    setIsLoading(true);

    try {
      const feedback = buildSpeakingFeedback(userText, currentUnit);
      setPracticeFeedback({
        level: feedback.reason ? 'needs-work' : 'good',
        text: feedback.hint,
      });
      if (feedback.reason && currentUnit) {
        onAddMistake({
          unitId: currentUnit.id,
          category: 'speaking',
          stage: 'speaking',
          prompt: `口语任务：${currentUnit.title}`,
          expected: coachConfig.goal,
          answer: userText,
          reason: feedback.reason,
          hint: feedback.hint,
        });
      }
      const lessonPrompt = currentUnit
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
                正在讨论：{currentUnit ? `${currentUnit.unit} · ${currentUnit.title}` : '教材口语练习'}
              </p>
              <p className="text-xs text-slate-400 mt-1">{coachConfig.goal}</p>
            </div>
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
            placeholder={isListening ? "正在倾听..." : "用英语和外教聊聊吧..."}
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

        {/* 语音识别候选结果 */}
        <AnimatePresence>
          {showAlternatives && recognitionAlternatives.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-xl"
            >
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle size={14} className="text-amber-500" />
                <span className="text-xs text-amber-700 font-medium">识别结果不确定，请选择更准确的文本：</span>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setShowAlternatives(false)}
                  className="px-3 py-1.5 bg-white border border-amber-200 rounded-lg text-xs text-amber-700 hover:bg-amber-100 transition-colors"
                >
                  {inputValue} ✓
                </button>
                {recognitionAlternatives.map((alt, idx) => (
                  <button
                    key={idx}
                    onClick={() => selectAlternative(alt)}
                    className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-600 hover:border-blue-300 hover:text-blue-600 transition-colors"
                  >
                    {alt}
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 识别置信度指示器 */}
        {!showAlternatives && recognitionConfidence > 0 && recognitionConfidence < 0.7 && (
          <div className="mt-2 flex items-center gap-2 text-xs text-amber-600">
            <AlertCircle size={12} />
            <span>识别置信度较低，建议检查文本或重试</span>
          </div>
        )}
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

const VocabularyModule = ({
  units,
  currentUnit,
  studyState,
  onSelectUnit,
  onSelectStage,
  onOpenStage,
  onMarkWord,
  onToggleSentenceFollowed,
  onCompleteStage,
  onAddMistake,
}: {
  units: UnitBundle[];
  currentUnit: UnitBundle | null;
  studyState: StudyState;
  onSelectUnit: (unitId: string) => void;
  onSelectStage: (stage: LessonStageKey) => void;
  onOpenStage: (stage: LessonStageKey) => void;
  onMarkWord: (wordId: string, mastered: boolean, word: VocabItem) => void;
  onToggleSentenceFollowed: (sentenceId: string) => void;
  onCompleteStage: (stage: LessonStageKey) => void;
  onAddMistake: (record: Omit<MistakeRecord, 'id' | 'createdAt'>) => void;
}) => {
  if (!currentUnit) {
    return (
      <div className="py-20 text-center text-slate-300">
        <BookOpen size={48} className="mx-auto mb-4 opacity-20" />
        <p>当前账号暂无教材数据</p>
      </div>
    );
  }

  const masteredCount = currentUnit.vocab.filter((word) => studyState.masteredWordIds.includes(word.id)).length;
  const followedCount = currentUnit.sentences.filter((sentence) => studyState.followedSentenceIds.includes(sentence.id)).length;
  const [readingIndex, setReadingIndex] = useState(0);
  const [focusStage, setFocusStage] = useState<LessonStageKey | null>(null);
  const [isRecordingSentence, setIsRecordingSentence] = useState(false);
  const [recordedSentenceUrl, setRecordedSentenceUrl] = useState('');
  const [recognizedSentenceText, setRecognizedSentenceText] = useState('');
  const [pronunciationScore, setPronunciationScore] = useState<number | null>(null);
  const [recordingError, setRecordingError] = useState('');
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const speechRecognitionRef = useRef<any>(null);
  const previewSectionRef = useRef<HTMLDivElement>(null);
  const readingSectionRef = useRef<HTMLDivElement>(null);
  const currentReadingSentence = currentUnit.sentences[readingIndex] || currentUnit.sentences[0];
  const previewCompleted = studyState.completedTaskIds.includes(createTaskId(currentUnit.id, 'preview'));
  const readingCompleted = studyState.completedTaskIds.includes(createTaskId(currentUnit.id, 'reading'));

  useEffect(() => {
    setReadingIndex(0);
    setRecordedSentenceUrl('');
    setRecognizedSentenceText('');
    setPronunciationScore(null);
    setRecordingError('');
  }, [currentUnit.id]);

  useEffect(() => {
    setRecognizedSentenceText('');
    setPronunciationScore(null);
    setRecordingError('');
    if (recordedSentenceUrl) {
      URL.revokeObjectURL(recordedSentenceUrl);
      setRecordedSentenceUrl('');
    }
  }, [readingIndex]);

  useEffect(() => {
    if (!focusStage) return;
    const timer = window.setTimeout(() => setFocusStage(null), 1800);
    return () => window.clearTimeout(timer);
  }, [focusStage]);

  useEffect(() => {
    if (!currentReadingSentence || pronunciationScore === null || pronunciationScore >= 70) return;
    onAddMistake({
      unitId: currentUnit.id,
      category: 'speaking',
      stage: 'reading',
      prompt: currentReadingSentence.text,
      expected: currentReadingSentence.text,
      answer: recognizedSentenceText || '录音完成但识别较弱',
      translation: currentReadingSentence.translation,
      reason: 'pronunciation',
      hint: getPronunciationHint(pronunciationScore),
    });
  }, [pronunciationScore]);

  useEffect(() => {
    return () => {
      if (recordedSentenceUrl) {
        URL.revokeObjectURL(recordedSentenceUrl);
      }
      mediaRecorderRef.current?.stop?.();
      mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
      speechRecognitionRef.current?.stop?.();
    };
  }, [recordedSentenceUrl]);

  const stopReadingPractice = () => {
    mediaRecorderRef.current?.stop?.();
    speechRecognitionRef.current?.stop?.();
    mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    mediaStreamRef.current = null;
    setIsRecordingSentence(false);
  };

  const handleToggleSentenceRecording = async () => {
    if (!currentReadingSentence) return;

    if (isRecordingSentence) {
      stopReadingPractice();
      return;
    }

    try {
      setRecordingError('');
      setRecognizedSentenceText('');
      setPronunciationScore(null);
      if (recordedSentenceUrl) {
        URL.revokeObjectURL(recordedSentenceUrl);
        setRecordedSentenceUrl('');
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      recordedChunksRef.current = [];

      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };
      recorder.onstop = () => {
        if (recordedChunksRef.current.length > 0) {
          const blob = new Blob(recordedChunksRef.current, { type: 'audio/webm' });
          const url = URL.createObjectURL(blob);
          setRecordedSentenceUrl(url);
        }
      };
      recorder.start();

      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        speechRecognitionRef.current = recognition;
        recognition.lang = 'en-US';
        recognition.continuous = false;
        recognition.interimResults = true;
        recognition.maxAlternatives = 1;
        recognition.onresult = (event: any) => {
          const transcript = Array.from(event.results)
            .map((result: any) => result[0]?.transcript || '')
            .join(' ')
            .trim();
          setRecognizedSentenceText(transcript);
          if (event.results[0]?.isFinal) {
            const score = calculateTextSimilarity(transcript, currentReadingSentence.text);
            setPronunciationScore(score);
          }
        };
        recognition.onerror = () => {
          setRecordingError('录音已保存，但语音识别没有成功，你仍然可以回放自己的录音。');
        };
        recognition.onend = () => {
          if (isRecordingSentence) {
            setIsRecordingSentence(false);
          }
        };
        recognition.start();
      }

      setIsRecordingSentence(true);
    } catch (error) {
      setRecordingError('当前浏览器无法开启麦克风，请检查麦克风权限。');
      setIsRecordingSentence(false);
    }
  };

  return (
    <div className="space-y-6 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800">教材同步路径</h2>
          <p className="text-sm text-slate-500">{currentUnit.grade} {currentUnit.semester} · {currentUnit.unit} · {currentUnit.title}</p>
        </div>
        <div className="flex gap-3">
          <div className="bg-white px-4 py-2 rounded-2xl shadow-sm border border-slate-100 text-xs font-bold text-blue-600">
            已掌握单词 {masteredCount}/{currentUnit.vocab.length}
          </div>
          <div className="bg-white px-4 py-2 rounded-2xl shadow-sm border border-slate-100 text-xs font-bold text-purple-600">
            已跟读句子 {followedCount}/{currentUnit.sentences.length}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-slate-800">选择单元</h3>
          <span className="text-xs text-slate-400">按课时推进学习</span>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar">
          {units.map((unit) => (
            <button
              key={unit.id}
              onClick={() => onSelectUnit(unit.id)}
              className={cn(
                "px-4 py-3 rounded-2xl border text-left min-w-[180px] transition-all",
                currentUnit.id === unit.id
                  ? "border-blue-200 bg-blue-50"
                  : "border-slate-100 bg-slate-50 hover:border-slate-200"
              )}
            >
              <div className="text-xs text-slate-400">{unit.unit}</div>
              <div className="font-bold text-slate-800">{unit.title}</div>
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {currentUnit.stages.map((stage, index) => {
          const completed = studyState.completedTaskIds.includes(createTaskId(currentUnit.id, stage.key));
          return (
            <button
              key={stage.key}
              onClick={() => onSelectStage(stage.key)}
              className={cn(
                "rounded-3xl border p-5 text-left transition-all",
                studyState.currentStage === stage.key
                  ? "border-blue-200 bg-blue-50"
                  : "border-slate-100 bg-white hover:border-slate-200",
              )}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Lesson {index + 1}</span>
                {completed ? <Check size={16} className="text-emerald-500" /> : <Clock size={16} className="text-slate-300" />}
              </div>
              <div className="font-bold text-slate-800">{stage.title}</div>
              <p className="text-xs text-slate-500 mt-2">{stage.description}</p>
              <div className="text-[10px] text-slate-400 mt-3">{stage.estimatedMinutes} 分钟</div>
              <div className="text-[11px] text-slate-400 mt-2">{getLessonOutcomeLabel(currentUnit, stage.key, studyState)}</div>
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {currentUnit.stages.map((stage) => (
          <div key={`${stage.key}-goal`} className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100">
            <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-blue-500 mb-2">{getStageLabel(stage.key)}</div>
            <div className="font-bold text-slate-800">{stage.description}</div>
            <div className="text-xs text-slate-500 mt-2">{getLessonOutcomeLabel(currentUnit, stage.key, studyState)}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 2xl:grid-cols-2 gap-6">
        <div
          ref={previewSectionRef}
          className={cn(
            "bg-white rounded-3xl p-6 shadow-sm border transition-all",
            focusStage === 'preview' ? "border-blue-300 ring-4 ring-blue-500/10" : "border-slate-100"
          )}
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-slate-800">课时1 词汇预习</h3>
            <button
              onClick={() => onSelectStage('preview')}
              className="text-xs font-bold text-blue-500"
            >
              设为当前课时
            </button>
          </div>
          <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1 custom-scrollbar">
            {currentUnit.vocab.slice(0, 12).map((word) => {
              const mastered = studyState.masteredWordIds.includes(word.id);
              return (
                <div key={word.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-bold text-slate-800">{word.word}</div>
                      <div className="text-xs text-slate-400 font-mono">{word.phonetic}</div>
                      <div className="text-sm text-slate-600 mt-1">{word.definition}</div>
                      <div className="text-xs text-slate-500 mt-2 italic">"{word.example}"</div>
                    </div>
                    <button
                      onClick={() => playWordAudio(word.word, 'US')}
                      className="w-10 h-10 rounded-xl bg-white text-blue-500 flex items-center justify-center border border-slate-100"
                    >
                      <Volume2 size={18} />
                    </button>
                  </div>
                  <div className="flex gap-2 mt-4">
                    <button
                      onClick={() => {
                        onMarkWord(word.id, false, word);
                        onAddMistake({
                          unitId: currentUnit.id,
                          category: 'vocab',
                          stage: 'preview',
                          prompt: word.word,
                          expected: word.definition,
                          answer: '未掌握',
                          reason: 'unknown_vocab',
                          hint: '建议先听发音，再结合例句确认词义和用法。',
                        });
                      }}
                      className="flex-1 py-2 rounded-xl bg-white border border-slate-100 text-slate-500 text-xs font-bold"
                    >
                      还不熟
                    </button>
                    <button
                      onClick={() => onMarkWord(word.id, true, word)}
                      className={cn(
                        "flex-1 py-2 rounded-xl text-xs font-bold",
                        mastered ? "bg-emerald-500 text-white" : "bg-emerald-50 text-emerald-600 border border-emerald-100"
                      )}
                    >
                      {mastered ? '已掌握' : '标记掌握'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
          <button
            onClick={() => {
              onCompleteStage('preview');
              onSelectStage('reading');
              readingSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
              setFocusStage('reading');
            }}
            className={cn(
              "mt-4 w-full py-3 rounded-2xl text-white font-bold",
              previewCompleted ? "bg-emerald-500" : "bg-blue-500"
            )}
          >
            {previewCompleted ? '词汇预习已完成，继续课时2' : '完成词汇预习并进入课时2'}
          </button>
        </div>

        <div
          ref={readingSectionRef}
          className={cn(
            "bg-white rounded-3xl p-6 shadow-sm border transition-all",
            focusStage === 'reading' ? "border-purple-300 ring-4 ring-purple-500/10" : "border-slate-100"
          )}
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-slate-800">课时2 重点句跟读</h3>
            <button
              onClick={() => onSelectStage('reading')}
              className="text-xs font-bold text-blue-500"
            >
              设为当前课时
            </button>
          </div>
          <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1 custom-scrollbar">
            {currentUnit.sentences.map((sentence) => {
              const followed = studyState.followedSentenceIds.includes(sentence.id);
              return (
                <div key={sentence.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                  <div className="font-bold text-slate-800">{sentence.text}</div>
                  <div className="text-sm text-slate-500 mt-1">{sentence.translation}</div>
                  <div className="flex gap-2 mt-4">
                    <button
                      onClick={() => playWordAudio(sentence.text, 'US')}
                      className="px-4 py-2 rounded-xl bg-white border border-slate-100 text-blue-500 text-xs font-bold"
                    >
                      播放跟读
                    </button>
                    <button
                      onClick={() => onToggleSentenceFollowed(sentence.id)}
                      className={cn(
                        "px-4 py-2 rounded-xl text-xs font-bold",
                        followed ? "bg-emerald-500 text-white" : "bg-emerald-50 text-emerald-600 border border-emerald-100"
                      )}
                    >
                      {followed ? '已完成跟读' : '标记已跟读'}
                    </button>
                    <button
                      onClick={() => onAddMistake({
                        unitId: currentUnit.id,
                        category: 'speaking',
                        stage: 'reading',
                        prompt: sentence.text,
                        expected: '读准重音、连读和停顿',
                        answer: '需要纠音',
                        translation: sentence.translation,
                        reason: 'pronunciation',
                        hint: '先逐词听一遍，再完整跟读一遍，重点注意重音和停顿。',
                      })}
                      className="px-4 py-2 rounded-xl bg-white border border-amber-200 text-amber-600 text-xs font-bold"
                    >
                      需要纠音
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
          <button
            onClick={() => {
              onCompleteStage('reading');
              onOpenStage('dictation');
            }}
            className={cn(
              "mt-4 w-full py-3 rounded-2xl text-white font-bold",
              readingCompleted ? "bg-emerald-500" : "bg-purple-500"
            )}
          >
            {readingCompleted ? '重点句跟读已完成，继续听写' : '完成重点句跟读并进入听写'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 2xl:grid-cols-2 gap-6">
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
          <h3 className="font-bold text-slate-800 mb-4">课文内容</h3>
          <div className="rounded-2xl bg-slate-50 border border-slate-100 p-5">
            <p className="text-sm text-slate-600 leading-7">
              {currentUnit.passage || currentUnit.sentences.slice(0, 5).map((sentence) => sentence.text).join(' ')}
            </p>
          </div>
          <p className="text-xs text-slate-400 mt-3">
            建议先通读课文，再回到上方依次完成词汇预习和重点句跟读。
          </p>
        </div>

        <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
          <h3 className="font-bold text-slate-800 mb-4">重点句型</h3>
          <div className="space-y-3">
            {(currentUnit.patterns && currentUnit.patterns.length > 0 ? currentUnit.patterns : currentUnit.sentences.slice(0, 4)).map((sentence, index) => (
              <div key={sentence.id} className="rounded-2xl bg-slate-50 border border-slate-100 p-4">
                <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-blue-500 mb-2">Pattern {index + 1}</div>
                <div className="font-bold text-slate-800">{sentence.text}</div>
                <div className="text-sm text-slate-500 mt-1">{sentence.translation}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {currentUnit.phrases && currentUnit.phrases.length > 0 && (
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
          <h3 className="font-bold text-slate-800 mb-4">固定搭配</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {currentUnit.phrases.map((phrase) => (
              <div key={phrase.id} className="rounded-2xl bg-slate-50 border border-slate-100 p-4">
                <div className="font-bold text-slate-800">{phrase.phrase}</div>
                <div className="text-sm text-slate-500 mt-1">{phrase.meaning}</div>
                <div className="text-xs text-slate-400 mt-2">{phrase.example}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-5">
          <div>
            <h3 className="font-bold text-slate-800">课文朗读训练</h3>
            <p className="text-sm text-slate-500 mt-1">按句推进，逐句播放、跟读、标记完成。</p>
          </div>
          <button
            onClick={() => onSelectStage('reading')}
            className="px-4 py-2 rounded-xl bg-blue-50 text-blue-600 text-sm font-bold"
          >
            当前课时：重点句跟读
          </button>
        </div>

        {currentReadingSentence ? (
          <div className="grid grid-cols-1 2xl:grid-cols-[1.4fr_1fr] gap-6">
            <div className="rounded-3xl bg-slate-50 border border-slate-100 p-6">
              <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 mb-3">
                Sentence {readingIndex + 1}/{currentUnit.sentences.length}
              </div>
              <div className="text-2xl font-black text-slate-800 leading-relaxed">{currentReadingSentence.text}</div>
              <div className="text-sm text-slate-500 mt-3">{currentReadingSentence.translation}</div>
              <div className="flex flex-wrap gap-3 mt-6">
                <button
                  onClick={() => playWordAudio(currentReadingSentence.text, 'US')}
                  className="px-4 py-3 rounded-2xl bg-white border border-slate-100 text-blue-500 text-sm font-bold"
                >
                  播放本句
                </button>
                <button
                  onClick={handleToggleSentenceRecording}
                  className={cn(
                    "px-4 py-3 rounded-2xl text-sm font-bold",
                    isRecordingSentence
                      ? "bg-red-500 text-white"
                      : "bg-purple-500 text-white"
                  )}
                >
                  {isRecordingSentence ? '停止录音并评测' : '开始录音跟读'}
                </button>
                <button
                  onClick={() => {
                    onToggleSentenceFollowed(currentReadingSentence.id);
                    if (readingIndex < currentUnit.sentences.length - 1) {
                      setReadingIndex((prev) => prev + 1);
                    }
                  }}
                  className="px-4 py-3 rounded-2xl bg-emerald-500 text-white text-sm font-bold"
                >
                  完成并进入下一句
                </button>
                <button
                  onClick={() => {
                    onAddMistake({
                      unitId: currentUnit.id,
                      category: 'speaking',
                      stage: 'reading',
                      prompt: currentReadingSentence.text,
                      expected: '朗读需更流畅、完整',
                      answer: '朗读卡顿/未完成',
                      translation: currentReadingSentence.translation,
                      reason: 'fluency',
                      hint: '建议先分短意群停顿，再完整朗读一遍。',
                    });
                  }}
                  className="px-4 py-3 rounded-2xl bg-white border border-amber-200 text-amber-600 text-sm font-bold"
                >
                  这句读不顺
                </button>
              </div>

              {(recordedSentenceUrl || recognizedSentenceText || recordingError) && (
                <div className="mt-6 rounded-2xl bg-white border border-slate-100 p-4 space-y-3">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                    <div>
                      <div className="text-xs font-bold text-slate-400">跟读对比结果</div>
                      <div className="text-sm text-slate-600 mt-1">先听原句，再回放自己的录音，对照识别内容和相似度。</div>
                    </div>
                    {pronunciationScore !== null && (
                      <div className={cn(
                        "px-3 py-2 rounded-xl text-sm font-bold",
                        pronunciationScore >= 80 ? "bg-emerald-50 text-emerald-600" : pronunciationScore >= 60 ? "bg-amber-50 text-amber-600" : "bg-rose-50 text-rose-600"
                      )}>
                        发音相似度 {pronunciationScore}%
                      </div>
                    )}
                  </div>

                  {recordedSentenceUrl && (
                    <div>
                      <div className="text-xs font-bold text-slate-400 mb-2">我的录音</div>
                      <audio controls src={recordedSentenceUrl} className="w-full" />
                    </div>
                  )}

                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
                    <div className="rounded-2xl bg-slate-50 border border-slate-100 p-4">
                      <div className="text-xs font-bold text-slate-400 mb-2">目标句子</div>
                      <div className="text-sm font-bold text-slate-800">{currentReadingSentence.text}</div>
                    </div>
                    <div className="rounded-2xl bg-slate-50 border border-slate-100 p-4">
                      <div className="text-xs font-bold text-slate-400 mb-2">识别结果</div>
                      <div className="text-sm font-bold text-slate-800">{recognizedSentenceText || '等待识别结果'}</div>
                    </div>
                  </div>

                  {pronunciationScore !== null && (
                    <div className="rounded-2xl bg-blue-50 border border-blue-100 p-4 text-sm text-blue-700">
                      {getPronunciationHint(pronunciationScore)}
                    </div>
                  )}

                  {recordingError && (
                    <div className="rounded-2xl bg-amber-50 border border-amber-100 p-4 text-sm text-amber-700">
                      {recordingError}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="space-y-3 max-h-[360px] overflow-y-auto pr-1 custom-scrollbar">
              {currentUnit.sentences.map((sentence, index) => {
                const done = studyState.followedSentenceIds.includes(sentence.id);
                const active = currentReadingSentence.id === sentence.id;
                return (
                  <button
                    key={sentence.id}
                    onClick={() => setReadingIndex(index)}
                    className={cn(
                      "w-full rounded-2xl border p-4 text-left transition-all",
                      active ? "border-blue-200 bg-blue-50" : "border-slate-100 bg-slate-50 hover:border-slate-200"
                    )}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-bold text-slate-800">{sentence.text}</span>
                      {done && <Check size={16} className="text-emerald-500 shrink-0" />}
                    </div>
                    <div className="text-xs text-slate-500 mt-2">{sentence.translation}</div>
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="rounded-2xl bg-slate-50 border border-slate-100 p-5 text-sm text-slate-500">
            当前单元还没有可用的朗读句子。
          </div>
        )}
      </div>

      <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
        <h3 className="font-bold text-slate-800 mb-4">课时3-4 巩固与输出闭环</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="rounded-2xl bg-slate-50 p-5 border border-slate-100">
            <div className="text-xs font-bold text-purple-500 uppercase tracking-[0.2em] mb-2">Step 3</div>
            <div className="font-bold text-slate-800 mb-2">进入听写巩固</div>
            <p className="text-sm text-slate-500 mb-4">围绕本单元词汇和重点句做听写，系统会自动把错误收进错题本。</p>
            <button onClick={() => onOpenStage('dictation')} className="px-4 py-2 rounded-xl bg-slate-900 text-white text-sm font-bold">
              开始听写
            </button>
          </div>
          <div className="rounded-2xl bg-slate-50 p-5 border border-slate-100">
            <div className="text-xs font-bold text-blue-500 uppercase tracking-[0.2em] mb-2">Step 4</div>
            <div className="font-bold text-slate-800 mb-2">进入口语表达</div>
            <p className="text-sm text-slate-500 mb-4">围绕本单元话题和重点句做 AI 问答，把输入转化成真实输出。</p>
            <button onClick={() => onOpenStage('speaking')} className="px-4 py-2 rounded-xl blue-gradient text-white text-sm font-bold">
              开始口语任务
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const DictationModule = ({
  currentUnit,
  onCompleteStage,
  onAddMistake,
}: {
  currentUnit: UnitBundle | null;
  onCompleteStage: (stage: LessonStageKey) => void;
  onAddMistake: (record: Omit<MistakeRecord, 'id' | 'createdAt'>) => void;
}) => {
  const [mode, setMode] = useState<'word' | 'sentence'>('word');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userInput, setUserInput] = useState('');
  const [showResult, setShowResult] = useState<'none' | 'correct' | 'wrong'>('none');
  const [score, setScore] = useState({ correct: 0, total: 0 });
  const [feedbackHint, setFeedbackHint] = useState('');
  const [feedbackReason, setFeedbackReason] = useState<MistakeReason | null>(null);

  const currentData = currentUnit
    ? mode === 'word'
      ? currentUnit.vocab
      : currentUnit.sentences
    : [];

  const currentItem = currentData[currentIndex];

  const [isSpeaking, setIsSpeaking] = useState(false);

  const handleSpeak = async () => {
    if (!currentItem || isSpeaking) return;
    setIsSpeaking(true);

    const text = mode === 'word' ? (currentItem as any).word : (currentItem as any).text;

    try {
      // 1. Try high-quality dictation audio (Dictionary API / Google TTS)
      let success = await playWordAudio(text, 'US').then(() => true).catch(() => false);
      
      // 2. Fallback to AI TTS if configured
      if (!success) {
        success = await generateTTS(text, 'US');
      }
      
      // 3. Fallback to improved Browser TTS
      if (!success) {
        await playBrowserTTS(text, 'US', 0.9); // slightly slower for dictation
      }
    } catch (error) {
      await playBrowserTTS(text, 'US', 0.9);
    } finally {
      setIsSpeaking(false);
    }
  };

  const checkAnswer = () => {
    if (!currentItem) return;
    const target = mode === 'word' ? (currentItem as any).word : (currentItem as any).text;
    
    // Simple normalization: trim and lower case for comparison
    const normalizedInput = userInput.trim().toLowerCase().replace(/[.,!?;:]/g, '');
    const normalizedTarget = target.trim().toLowerCase().replace(/[.,!?;:]/g, '');

    if (normalizedInput === normalizedTarget) {
      setShowResult('correct');
      setFeedbackHint('这题正确，可以继续下一题。');
      setFeedbackReason(null);
      setScore(prev => ({ ...prev, correct: prev.correct + 1, total: prev.total + 1 }));
      if (currentIndex === currentData.length - 1) {
        onCompleteStage('dictation');
      }
    } else {
      const issue = classifyDictationIssue(userInput, target);
      setShowResult('wrong');
      setFeedbackHint(issue.hint);
      setFeedbackReason(issue.reason);
      setScore(prev => ({ ...prev, total: prev.total + 1 }));
      if (currentUnit) {
        onAddMistake({
          unitId: currentUnit.id,
          category: 'dictation',
          stage: 'dictation',
          prompt: mode === 'word' ? `单词听写：${(currentItem as any).word}` : `句子听写：${(currentItem as any).text}`,
          expected: target,
          answer: userInput.trim(),
          translation: mode === 'sentence' ? (currentItem as any).translation : undefined,
          reason: issue.reason,
          hint: issue.hint,
        });
      }
    }
  };

  const nextItem = () => {
    setUserInput('');
    setShowResult('none');
    setFeedbackHint('');
    setFeedbackReason(null);
    setCurrentIndex(prev => (prev + 1) % currentData.length);
  };

  const reset = () => {
    setCurrentIndex(0);
    setUserInput('');
    setShowResult('none');
    setFeedbackHint('');
    setFeedbackReason(null);
    setScore({ correct: 0, total: 0 });
  };

  useEffect(() => {
    reset();
  }, [currentUnit?.id, mode]);

  return (
    <div className="h-full flex flex-col pb-20">
      <div className="flex flex-col mb-6 gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-800">听写训练</h2>
            <p className="text-sm text-slate-500">
              {currentUnit ? `${currentUnit.grade} ${currentUnit.semester} · ${currentUnit.unit} · ${currentUnit.title}` : '暂无可用教材单元'}
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 mb-6">
        <div className="flex gap-2 mb-6">
          <button 
            onClick={() => { setMode('word'); reset(); }}
            className={cn(
              "flex-1 py-3 rounded-2xl font-bold text-sm transition-all flex items-center justify-center gap-2",
              mode === 'word' ? "bg-blue-500 text-white shadow-lg shadow-blue-100" : "bg-slate-50 text-slate-500"
            )}
          >
            <BookOpen size={18} />
            单词听写
          </button>
          <button 
            onClick={() => { setMode('sentence'); reset(); }}
            className={cn(
              "flex-1 py-3 rounded-2xl font-bold text-sm transition-all flex items-center justify-center gap-2",
              mode === 'sentence' ? "bg-purple-500 text-white shadow-lg shadow-purple-100" : "bg-slate-50 text-slate-500"
            )}
          >
            <PencilLine size={18} />
            句子听写
          </button>
        </div>

        {currentData.length > 0 ? (
          <div className="space-y-8 py-4">
            <div className="flex flex-col items-center gap-6">
              <button 
                onClick={handleSpeak}
                disabled={isSpeaking}
                className={cn(
                  "w-24 h-24 rounded-full flex items-center justify-center hover:scale-110 active:scale-95 transition-all shadow-inner",
                  isSpeaking ? "bg-blue-100 text-blue-500 animate-pulse" : "bg-blue-50 text-blue-500"
                )}
              >
                {isSpeaking ? <RotateCw size={48} className="animate-spin" /> : <Volume2 size={48} />}
              </button>
              <div className="text-center">
                <p className="text-slate-400 text-xs mb-1 uppercase tracking-widest font-bold">点击图标播放音频</p>
                <p className="text-slate-800 font-bold">{mode === 'word' ? '拼写该单词' : '写下你听到的句子'}</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="relative">
                <textarea 
                  value={userInput}
                  onChange={e => setUserInput(e.target.value)}
                  disabled={showResult !== 'none'}
                  className={cn(
                    "w-full bg-slate-50 border rounded-2xl p-6 text-center text-lg font-bold outline-none transition-all resize-none h-32",
                    showResult === 'correct' ? "border-emerald-500 bg-emerald-50 text-emerald-700" :
                    showResult === 'wrong' ? "border-red-500 bg-red-50 text-red-700" :
                    "border-slate-100 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/5"
                  )}
                  placeholder={mode === 'word' ? "Type the word here..." : "Type the sentence here..."}
                />
                <AnimatePresence>
                  {showResult !== 'none' && (
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.5 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="absolute -top-4 -right-4 w-12 h-12 rounded-full flex items-center justify-center shadow-lg"
                    >
                      {showResult === 'correct' ? (
                        <div className="bg-emerald-500 text-white w-full h-full rounded-full flex items-center justify-center"><Check size={24} /></div>
                      ) : (
                        <div className="bg-red-500 text-white w-full h-full rounded-full flex items-center justify-center"><X size={24} /></div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {showResult === 'wrong' && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-4 bg-red-50 rounded-2xl border border-red-100 flex items-start gap-3"
                >
                  <AlertCircle className="text-red-500 shrink-0" size={18} />
                  <div>
                    <p className="text-xs font-bold text-red-800 mb-1">正确答案：</p>
                    <p className="text-sm text-red-700 font-mono">{mode === 'word' ? (currentItem as any).word : (currentItem as any).text}</p>
                    {mode === 'sentence' && <p className="text-[10px] text-red-500 mt-1">{(currentItem as any).translation}</p>}
                    {feedbackReason && <p className="text-[10px] text-amber-600 mt-2">错误类型：{MISTAKE_REASON_LABELS[feedbackReason]}</p>}
                    {feedbackHint && <p className="text-[10px] text-slate-500 mt-1">复习建议：{feedbackHint}</p>}
                  </div>
                </motion.div>
              )}

              {showResult === 'correct' && feedbackHint && (
                <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100 text-sm text-emerald-700">
                  {feedbackHint}
                </div>
              )}

              {showResult === 'none' ? (
                <button 
                  onClick={checkAnswer}
                  disabled={!userInput.trim()}
                  className="w-full blue-gradient py-4 rounded-2xl text-white font-bold shadow-xl shadow-blue-200 active:scale-95 transition-all disabled:opacity-50 disabled:grayscale"
                >
                  检查答案
                </button>
              ) : (
                <button 
                  onClick={nextItem}
                  className="w-full bg-slate-800 py-4 rounded-2xl text-white font-bold shadow-xl shadow-slate-200 active:scale-95 transition-all flex items-center justify-center gap-2"
                >
                  下一题
                  <ChevronRight size={18} />
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="py-20 text-center text-slate-300">
            <BookOpen size={48} className="mx-auto mb-4 opacity-20" />
            <p>当前单元暂无{mode === 'word' ? '单词' : '句子'}听写数据</p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-100 flex items-center justify-between">
          <div className="text-xs text-slate-400">当前进度</div>
          <div className="font-bold text-slate-700">{currentData.length > 0 ? currentIndex + 1 : 0} / {currentData.length}</div>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-100 flex items-center justify-between">
          <div className="text-xs text-slate-400">正确率</div>
          <div className="font-bold text-emerald-500">{score.total > 0 ? Math.round((score.correct / score.total) * 100) : 0}%</div>
        </div>
      </div>
    </div>
  );
};

const ChallengeModule = ({
  currentUnit,
  studyState,
  onBack,
  onCompleteChallenge,
}: {
  currentUnit: UnitBundle | null;
  studyState: StudyState;
  onBack: () => void;
  onCompleteChallenge: (score: number, total: number) => void;
}) => {
  const questions = buildChallengeQuestions(currentUnit);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const challengeStatus = getUnitChallengeStatus(currentUnit, studyState);
  const history = currentUnit ? getChallengeHistoryForUnit(studyState, currentUnit.id) : [];
  const latestAttempt = history[0] || null;

  useEffect(() => {
    setAnswers({});
    setSubmitted(false);
  }, [currentUnit?.id]);

  const handleSubmit = () => {
    const score = questions.reduce((sum, question) => {
      const answer = (answers[question.id] || '').trim();
      return sum + (answer ? 1 : 0);
    }, 0);
    setSubmitted(true);
    onCompleteChallenge(score, questions.length);
  };

  if (!currentUnit) {
    return (
      <div className="bg-white rounded-3xl p-8 shadow-sm border border-slate-100 text-center text-slate-500">
        暂无可用单元，暂时无法开始闯关。
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20">
      <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <p className="text-xs font-bold text-emerald-500 uppercase tracking-[0.3em]">Unit Challenge</p>
            <h2 className="text-2xl font-black text-slate-800 mt-2">{currentUnit.unit} 单元闯关</h2>
            <p className="text-sm text-slate-500 mt-1">{currentUnit.title} · 词汇回忆 + 句子理解 + 口语输出</p>
          </div>
          <button onClick={onBack} className="px-4 py-3 rounded-2xl bg-slate-100 text-slate-600 font-bold">
            返回学习中心
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
          <div className="rounded-2xl bg-slate-50 border border-slate-100 p-4">
            <div className="text-[10px] text-slate-400 mb-1">闯关准备度</div>
            <div className="text-xl font-bold text-emerald-600">{challengeStatus.progress}%</div>
          </div>
          <div className="rounded-2xl bg-slate-50 border border-slate-100 p-4">
            <div className="text-[10px] text-slate-400 mb-1">题目数</div>
            <div className="text-xl font-bold text-slate-800">{questions.length}</div>
          </div>
          <div className="rounded-2xl bg-slate-50 border border-slate-100 p-4">
            <div className="text-[10px] text-slate-400 mb-1">最近成绩</div>
            <div className="text-xl font-bold text-blue-600">
              {latestAttempt ? `${Math.round((latestAttempt.score / latestAttempt.total) * 100)}%` : '--'}
            </div>
          </div>
        </div>
      </div>

      {!challengeStatus.ready && (
        <div className="rounded-3xl border border-amber-100 bg-amber-50 p-5 text-sm text-amber-700">
          当前单元还没完全准备好，建议先完成首页推荐任务后再正式闯关。你现在也可以先试做，系统会照常记录成绩。
        </div>
      )}

      <div className="space-y-4">
        {questions.map((question, index) => (
          <div key={question.id} className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
            <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 mb-2">
              Task {index + 1} · {question.kind}
            </div>
            <div className="font-bold text-slate-800 text-lg">{question.prompt}</div>
            <textarea
              value={answers[question.id] || ''}
              onChange={(e) => setAnswers((prev) => ({ ...prev, [question.id]: e.target.value }))}
              className="w-full mt-4 bg-slate-50 border border-slate-100 rounded-2xl p-4 text-sm outline-none focus:border-emerald-500 min-h-28"
              placeholder="请输入你的答案、解释或口语表达要点"
            />
            {submitted && (
              <div className="mt-3 rounded-2xl bg-emerald-50 border border-emerald-100 p-4">
                <div className="text-xs font-bold text-emerald-700 mb-1">参考要点</div>
                <div className="text-sm text-emerald-800">{question.expected}</div>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 className="font-bold text-slate-800">提交本次闯关</h3>
            <p className="text-sm text-slate-500 mt-1">当前按是否完成作答给出阶段成绩，适合小规模教学快速落地。</p>
          </div>
          <button onClick={handleSubmit} className="px-5 py-3 rounded-2xl bg-emerald-500 text-white font-bold">
            提交并记录成绩
          </button>
        </div>
      </div>
    </div>
  );
};

const ManagementModule = ({
  textbooks,
  onTextbooksChanged,
}: {
  textbooks: TextbookSummary[];
  onTextbooksChanged: () => Promise<void>;
}) => {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [gradeFilter, setGradeFilter] = useState('all');
  const [semesterFilter, setSemesterFilter] = useState('all');
  const [unitFilter, setUnitFilter] = useState('all');
  const [sampleCatalog, setSampleCatalog] = useState<Array<{
    id: string;
    title: string;
    stage: string;
    grade: string;
    semester: string;
    unitCount: number;
    description: string;
  }>>([]);
  const [importStatus, setImportStatus] = useState<'idle' | 'importing' | 'success'>('idle');
  const [textbookError, setTextbookError] = useState('');
  const [textbookContents, setTextbookContents] = useState<Record<string, TextbookContent>>({});

  const [aiConfig, setAiConfig] = useState<AIConfig>(() => {
    const saved = localStorage.getItem(AI_CONFIG_STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return {
          ...DEFAULT_AI_CONFIG,
          model: typeof parsed.model === 'string' && parsed.model.trim() ? parsed.model : DEFAULT_AI_CONFIG.model,
          apiKey: typeof parsed.apiKey === 'string' ? parsed.apiKey : DEFAULT_AI_CONFIG.apiKey,
          baseURL: typeof parsed.baseURL === 'string' && parsed.baseURL.trim() ? parsed.baseURL : DEFAULT_AI_CONFIG.baseURL,
        };
      } catch (e) {}
    }
    return DEFAULT_AI_CONFIG;
  });

  const [newUser, setNewUser] = useState({
    username: '',
    password: '',
    grade: '7年级',
    semester: '上学期',
    school: ''
  });

  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success'>('idle');
  const [userError, setUserError] = useState('');
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);
  const classSnapshots = users.map((user) => {
    const matchedTextbook = textbooks.find((item) => item.grade === user.grade && item.semester === user.semester) || textbooks[0];
    const textbookContent = matchedTextbook ? textbookContents[matchedTextbook.id] : undefined;
    const units = buildUnitBundlesFromTextbook(textbookContent || null);
    const state = matchedTextbook ? loadStudyStateForUser(user.username, matchedTextbook.id, units) : createInitialStudyState(units);
    const currentUnit = units.find((unit) => unit.id === state.currentUnitId) || units[0] || null;
    const challenge = getUnitChallengeStatus(currentUnit, state);
    return {
      user,
      state,
      textbookTitle: matchedTextbook?.title || '未导入教材',
      currentUnit,
      challenge,
      completedTasks: state.completedTaskIds.length,
      mistakes: state.mistakes.length,
      streak: getCheckinStreak(state.dailyCheckins),
      trend: buildSevenDayTrend(state.dailyCheckins),
    };
  });
  const filteredSnapshots = classSnapshots.filter((snapshot) => {
    if (gradeFilter !== 'all' && snapshot.user.grade !== gradeFilter) return false;
    if (semesterFilter !== 'all' && snapshot.user.semester !== semesterFilter) return false;
    if (unitFilter !== 'all' && snapshot.currentUnit?.unit !== unitFilter) return false;
    return true;
  });
  const classTrend = buildSevenDayTrend(
    filteredSnapshots.flatMap((snapshot) => snapshot.state.dailyCheckins)
  ).map((item) => ({
    ...item,
    progress: filteredSnapshots.length > 0 ? Math.round(item.progress / filteredSnapshots.length) : 0,
    checkedIn: filteredSnapshots.reduce((sum, snapshot) => {
      const record = snapshot.state.dailyCheckins.find((entry) => entry.date === item.date);
      return sum + (record?.checkedIn ? 1 : 0);
    }, 0),
  }));
  const classSummary = {
    totalStudents: filteredSnapshots.length,
    activeStudents: filteredSnapshots.filter((item) => item.completedTasks > 0 || item.mistakes > 0).length,
    averageProgress: filteredSnapshots.length > 0
      ? Math.round(filteredSnapshots.reduce((sum, item) => sum + item.challenge.progress, 0) / filteredSnapshots.length)
      : 0,
    riskStudents: filteredSnapshots.filter((item) => item.mistakes >= 3).length,
  };
  const unitFilterOptions = Array.from(new Set(classSnapshots.map((item) => item.currentUnit?.unit).filter(Boolean))) as string[];

  const loadUsers = useCallback(async () => {
    setIsLoadingUsers(true);
    try {
      const data = await apiFetch<{ users: AppUser[] }>('/api/users');
      setUsers(data.users);
      setUserError('');
    } catch (error) {
      setUserError(error instanceof Error ? error.message : '加载用户失败');
    } finally {
      setIsLoadingUsers(false);
    }
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const loadSampleCatalog = useCallback(async () => {
    try {
      const data = await apiFetch<{ samples: Array<{
        id: string;
        title: string;
        stage: string;
        grade: string;
        semester: string;
        unitCount: number;
        description: string;
      }> }>('/api/admin/textbook-samples');
      setSampleCatalog(data.samples);
      setTextbookError('');
    } catch (error) {
      setTextbookError(error instanceof Error ? error.message : '加载教材样板失败');
    }
  }, []);

  useEffect(() => {
    loadSampleCatalog();
  }, [loadSampleCatalog]);

  useEffect(() => {
    let cancelled = false;

    const loadContents = async () => {
      if (textbooks.length === 0) {
        setTextbookContents({});
        return;
      }

      try {
        const entries = await Promise.all(
          textbooks.map(async (item) => {
            const data = await apiFetch<{ textbook: TextbookContent }>(`/api/textbooks/${item.id}`);
            return [item.id, data.textbook] as const;
          })
        );

        if (!cancelled) {
          setTextbookContents(Object.fromEntries(entries));
        }
      } catch (error) {
        if (!cancelled) {
          setTextbookError(error instanceof Error ? error.message : '加载教材内容失败');
        }
      }
    };

    loadContents();

    return () => {
      cancelled = true;
    };
  }, [textbooks]);

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedUsername = newUser.username.trim();
    const trimmedPassword = newUser.password.trim();

    if (!trimmedUsername || !trimmedPassword) return;

    try {
      const data = await apiFetch<{ user: AppUser }>('/api/users', {
        method: 'POST',
        body: JSON.stringify({
          username: trimmedUsername,
          password: trimmedPassword,
          grade: newUser.grade,
          semester: newUser.semester,
          school: newUser.school.trim(),
        }),
      });

      setUsers((prev) => [data.user, ...prev]);
      setNewUser({ username: '', password: '', grade: '7年级', semester: '上学期', school: '' });
      setUserError('');
    } catch (error) {
      setUserError(error instanceof Error ? error.message : '创建用户失败');
    }
  };

  const handleDeleteUser = async (id: string) => {
    try {
      await apiFetch<{ ok: true }>(`/api/users/${id}`, {
        method: 'DELETE',
      });
      setUsers((prev) => prev.filter((user) => user.id !== id));
    } catch (error) {
      setUserError(error instanceof Error ? error.message : '删除用户失败');
    }
  };

  const handleSaveAIConfig = () => {
    setSaveStatus('saving');
    localStorage.setItem(AI_CONFIG_STORAGE_KEY, JSON.stringify(aiConfig));
    setTimeout(() => {
      setSaveStatus('success');
      setTimeout(() => setSaveStatus('idle'), 2000);
    }, 500);
  };

  const handleImportSample = async (sampleId: string) => {
    setImportStatus('importing');
    try {
      await apiFetch<{ textbook: TextbookSummary }>('/api/admin/textbooks/import-sample', {
        method: 'POST',
        body: JSON.stringify({ sampleId }),
      });
      await onTextbooksChanged();
      setTextbookError('');
      setImportStatus('success');
      setTimeout(() => setImportStatus('idle'), 2000);
    } catch (error) {
      setTextbookError(error instanceof Error ? error.message : '导入教材失败');
      setImportStatus('idle');
    }
  };

  const handleImportAllSamples = async () => {
    setImportStatus('importing');
    try {
      await apiFetch<{ textbooks: TextbookSummary[] }>('/api/admin/textbooks/import-all-samples', {
        method: 'POST',
      });
      await onTextbooksChanged();
      setTextbookError('');
      setImportStatus('success');
      setTimeout(() => setImportStatus('idle'), 2000);
    } catch (error) {
      setTextbookError(error instanceof Error ? error.message : '批量导入教材失败');
      setImportStatus('idle');
    }
  };

  return (
    <div className="space-y-8 pb-20">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 rounded-xl bg-blue-500 text-white flex items-center justify-center shadow-lg shadow-blue-100">
          <ShieldCheck size={24} />
        </div>
        <div>
          <h2 className="text-xl font-bold text-slate-800">系统管理</h2>
          <p className="text-sm text-slate-500">管理用户账号与 AI 配置</p>
        </div>
      </div>

      <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="font-bold text-slate-800">班级学习看板</h3>
            <p className="text-sm text-slate-500 mt-1">面向小规模班级的学习推进与风险观察</p>
          </div>
          <span className="text-xs text-slate-400">当前设备本地数据</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-5">
          <select value={gradeFilter} onChange={(e) => setGradeFilter(e.target.value)} className="bg-slate-50 border border-slate-100 rounded-xl px-3 py-2 text-xs outline-none">
            <option value="all">全部年级</option>
            {GRADES.map((grade) => <option key={grade} value={grade}>{grade}</option>)}
          </select>
          <select value={semesterFilter} onChange={(e) => setSemesterFilter(e.target.value)} className="bg-slate-50 border border-slate-100 rounded-xl px-3 py-2 text-xs outline-none">
            <option value="all">全部学期</option>
            {SEMESTERS.map((semester) => <option key={semester} value={semester}>{semester}</option>)}
          </select>
          <select value={unitFilter} onChange={(e) => setUnitFilter(e.target.value)} className="bg-slate-50 border border-slate-100 rounded-xl px-3 py-2 text-xs outline-none">
            <option value="all">全部单元</option>
            {unitFilterOptions.map((unit) => <option key={unit} value={unit}>{unit}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="rounded-2xl bg-slate-50 border border-slate-100 p-4">
            <div className="text-[10px] text-slate-400 mb-1">学生人数</div>
            <div className="text-xl font-bold text-slate-800">{classSummary.totalStudents}</div>
          </div>
          <div className="rounded-2xl bg-slate-50 border border-slate-100 p-4">
            <div className="text-[10px] text-slate-400 mb-1">有学习记录</div>
            <div className="text-xl font-bold text-blue-600">{classSummary.activeStudents}</div>
          </div>
          <div className="rounded-2xl bg-slate-50 border border-slate-100 p-4">
            <div className="text-[10px] text-slate-400 mb-1">平均闯关准备度</div>
            <div className="text-xl font-bold text-emerald-600">{classSummary.averageProgress}%</div>
          </div>
          <div className="rounded-2xl bg-slate-50 border border-slate-100 p-4">
            <div className="text-[10px] text-slate-400 mb-1">需重点关注</div>
            <div className="text-xl font-bold text-rose-500">{classSummary.riskStudents}</div>
          </div>
        </div>

        <div className="bg-slate-50 rounded-3xl border border-slate-100 p-4 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h4 className="font-bold text-slate-800">最近 7 天学习趋势</h4>
              <p className="text-xs text-slate-500 mt-1">观察班级日推进强度和打卡人数变化</p>
            </div>
            <span className="text-xs text-slate-400">筛选后实时统计</span>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={classTrend}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} allowDecimals={false} />
                <Tooltip />
                <Line type="monotone" dataKey="progress" stroke="#3b82f6" strokeWidth={3} name="平均推进动作" />
                <Line type="monotone" dataKey="checkedIn" stroke="#10b981" strokeWidth={3} name="打卡人数" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="space-y-3">
          {filteredSnapshots.length === 0 ? (
            <div className="rounded-2xl bg-slate-50 border border-slate-100 p-4 text-sm text-slate-500">
              当前筛选条件下没有学生数据，可以切换筛选或先创建学生账号。
            </div>
          ) : (
            filteredSnapshots.map((snapshot) => (
              <div key={snapshot.user.id} className="rounded-2xl bg-slate-50 border border-slate-100 p-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div>
                    <div className="font-bold text-slate-800">{snapshot.user.username}</div>
                    <div className="text-xs text-slate-500 mt-1">
                      {snapshot.user.grade} · {snapshot.user.semester} · 当前单元 {snapshot.currentUnit?.unit || '--'}
                    </div>
                    <div className="text-[10px] text-slate-400 mt-1">教材：{snapshot.textbookTitle}</div>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs">
                    <span className="px-3 py-1 rounded-full bg-white border border-slate-100 text-slate-600">已完成任务 {snapshot.completedTasks}</span>
                    <span className="px-3 py-1 rounded-full bg-white border border-slate-100 text-slate-600">错题 {snapshot.mistakes}</span>
                    <span className="px-3 py-1 rounded-full bg-white border border-slate-100 text-slate-600">连续打卡 {snapshot.streak} 天</span>
                    <span className={cn(
                      "px-3 py-1 rounded-full",
                      snapshot.challenge.ready ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                    )}>
                      闯关准备度 {snapshot.challenge.progress}%
                    </span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 2xl:grid-cols-2 gap-8">
        {/* User Management */}
        <div className="space-y-6">
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
            <h3 className="font-bold text-slate-800 mb-6 flex items-center gap-2">
              <Plus size={18} className="text-blue-500" />
              新增用户
            </h3>
            <form onSubmit={handleAddUser} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 ml-2 uppercase">用户名</label>
                  <input 
                    type="text" 
                    value={newUser.username}
                    onChange={e => setNewUser({...newUser, username: e.target.value})}
                    className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-2 text-sm outline-none focus:border-blue-500 transition-all"
                    placeholder="请输入用户名"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 ml-2 uppercase">密码</label>
                  <input 
                    type="password" 
                    value={newUser.password}
                    onChange={e => setNewUser({...newUser, password: e.target.value})}
                    className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-2 text-sm outline-none focus:border-blue-500 transition-all"
                    placeholder="设置初始密码"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 ml-2 uppercase">年级</label>
                  <select 
                    value={newUser.grade}
                    onChange={e => setNewUser({...newUser, grade: e.target.value})}
                    className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-2 text-sm outline-none focus:border-blue-500 transition-all"
                  >
                    {GRADES.map(g => <option key={g} value={g}>{g}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 ml-2 uppercase">学期</label>
                  <select 
                    value={newUser.semester}
                    onChange={e => setNewUser({...newUser, semester: e.target.value})}
                    className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-2 text-sm outline-none focus:border-blue-500 transition-all"
                  >
                    {SEMESTERS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 ml-2 uppercase">学校</label>
                  <input 
                    type="text" 
                    value={newUser.school}
                    onChange={e => setNewUser({...newUser, school: e.target.value})}
                    className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-2 text-sm outline-none focus:border-blue-500 transition-all"
                    placeholder="请输入学校名称"
                  />
                </div>
              </div>
              <button 
                type="submit"
                className="w-full bg-blue-500 text-white py-3 rounded-xl font-bold shadow-lg shadow-blue-100 hover:scale-[1.02] active:scale-95 transition-all"
              >
                添加新用户
              </button>
              {userError && (
                <p className="text-xs font-bold text-red-500 text-center">{userError}</p>
              )}
            </form>
          </div>

          <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
            <h3 className="font-bold text-slate-800 mb-6 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <User size={18} className="text-blue-500" />
                用户列表
              </span>
              <span className="text-xs text-slate-400 font-normal">共 {users.length} 名用户</span>
            </h3>
            <div className="space-y-3 max-h-[400px] overflow-y-auto custom-scrollbar pr-2">
              {isLoadingUsers ? (
                <div className="text-center py-10 text-slate-300 italic text-sm">正在加载用户...</div>
              ) : users.length === 0 ? (
                <div className="text-center py-10 text-slate-300 italic text-sm">暂无普通用户</div>
              ) : (
                users.map(user => (
                  <div key={user.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-100 group">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-blue-500 shadow-sm">
                        <User size={20} />
                      </div>
                      <div className="min-w-0">
                        <div className="font-bold text-slate-800 text-sm truncate">{user.username}</div>
                        <div className="flex flex-wrap items-center gap-2 text-[10px] text-slate-400">
                          <span className="flex items-center gap-0.5"><GraduationCap size={10} /> {user.grade} · {user.semester}</span>
                          <span className="flex items-center gap-0.5"><School size={10} /> {user.school}</span>
                        </div>
                      </div>
                    </div>
                    <button 
                      onClick={() => handleDeleteUser(user.id)}
                      className="self-end sm:self-auto p-2 text-slate-300 hover:text-red-500 transition-all opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* AI Configuration */}
        <div className="space-y-6">
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
            <h3 className="font-bold text-slate-800 mb-6 flex items-center gap-2">
              <BookOpen size={18} className="text-emerald-500" />
              教材导入后台
            </h3>
            <div className="space-y-4">
              <div className="rounded-2xl bg-slate-50 border border-slate-100 p-4 text-sm text-slate-600">
                当前已导入 {textbooks.length} 套教材。现在可导入现有样板，并继续扩展为 PDF / Excel / OCR 导入。
              </div>
              <div className="flex justify-end">
                <button
                  onClick={handleImportAllSamples}
                  disabled={importStatus === 'importing'}
                  className="px-4 py-2 rounded-xl bg-slate-900 text-white text-sm font-bold"
                >
                  {importStatus === 'importing' ? '批量导入中...' : '导入全部现有样板'}
                </button>
              </div>
              <div className="space-y-3">
                {sampleCatalog.map((sample) => {
                  const imported = textbooks.some((item) => item.id === sample.id);
                  return (
                    <div key={sample.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                        <div>
                          <div className="font-bold text-slate-800">{sample.title}</div>
                          <div className="text-xs text-slate-500 mt-1">
                            {sample.stage} · {sample.grade} · {sample.semester} · {sample.unitCount} 个单元
                          </div>
                          <div className="text-xs text-slate-400 mt-2">{sample.description}</div>
                        </div>
                        <button
                          onClick={() => handleImportSample(sample.id)}
                          disabled={importStatus === 'importing'}
                          className={cn(
                            "px-4 py-2 rounded-xl text-sm font-bold",
                            imported ? "bg-emerald-100 text-emerald-700" : "bg-emerald-500 text-white"
                          )}
                        >
                          {imported ? '重新导入样板' : importStatus === 'importing' ? '导入中...' : '导入教材'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
              {textbookError && <p className="text-xs font-bold text-red-500">{textbookError}</p>}
              {importStatus === 'success' && <p className="text-xs font-bold text-emerald-600">教材样板导入完成，前台教材选择器已可使用。</p>}
            </div>
          </div>

          <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
            <h3 className="font-bold text-slate-800 mb-6 flex items-center gap-2">
              <Zap size={18} className="text-purple-500" />
              AI 模型配置
            </h3>
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 ml-2">统一 AI 接口</label>
                <div className="rounded-2xl bg-slate-50 border border-slate-100 p-4 text-sm text-slate-600">
                  使用 OpenAI 兼容协议配置聊天模型与语音接口。你可以接 OpenAI，也可以接其他兼容 `/chat/completions` 和 `/audio/speech` 的服务。
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 ml-2">Base URL</label>
                <input 
                  type="text" 
                  value={aiConfig.baseURL || ''}
                  onChange={e => setAiConfig({...aiConfig, baseURL: e.target.value})}
                  className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm outline-none focus:border-purple-500 transition-all"
                  placeholder="例如: https://api.openai.com/v1"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 ml-2">选择模型</label>
                <div className="grid grid-cols-1 gap-3">
                  {[
                    { id: 'gpt-4o-mini', name: 'GPT-4o Mini (推荐)', desc: '性价比高，响应快速' },
                    { id: 'gpt-4o', name: 'GPT-4o', desc: '更强的理解和生成能力' },
                    { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', desc: '经济实惠' },
                    { id: 'deepseek-chat', name: 'DeepSeek Chat', desc: '国产模型，中文友好' },
                    { id: 'claude-3-sonnet', name: 'Claude 3 Sonnet', desc: 'Anthropic 模型' },
                    { id: 'custom', name: '自定义模型', desc: '手动输入模型名称' }
                  ].map(model => (
                    <button
                      key={model.id}
                      onClick={() => setAiConfig({...aiConfig, model: model.id === 'custom' ? '' : model.id})}
                      className={cn(
                        "flex items-center justify-between p-4 rounded-2xl border transition-all text-left",
                        aiConfig.model === model.id || (model.id === 'custom' && !['gpt-4o-mini', 'gpt-4o', 'gpt-3.5-turbo', 'deepseek-chat', 'claude-3-sonnet'].includes(aiConfig.model))
                          ? "bg-purple-50 border-purple-200 ring-4 ring-purple-500/5" 
                          : "bg-slate-50 border-slate-100 hover:border-slate-200"
                      )}
                    >
                      <div>
                        <div className={cn("font-bold text-sm", aiConfig.model === model.id ? "text-purple-700" : "text-slate-700")}>
                          {model.name}
                        </div>
                        <div className="text-[10px] text-slate-400">{model.desc}</div>
                      </div>
                      {aiConfig.model === model.id && <Check size={18} className="text-purple-500" />}
                    </button>
                  ))}
                </div>
                {/* 自定义模型输入框 */}
                {(!['gpt-4o-mini', 'gpt-4o', 'gpt-3.5-turbo', 'deepseek-chat', 'claude-3-sonnet'].includes(aiConfig.model)) && (
                  <div className="mt-3">
                    <input 
                      type="text" 
                      value={aiConfig.model}
                      onChange={e => setAiConfig({...aiConfig, model: e.target.value})}
                      className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm outline-none focus:border-purple-500 transition-all"
                      placeholder="输入自定义模型名称，例如: qwen-turbo, llama2-70b 等"
                    />
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 ml-2">API Key</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                  <input 
                    type="password" 
                    value={aiConfig.apiKey}
                    onChange={e => setAiConfig({...aiConfig, apiKey: e.target.value})}
                    className="w-full bg-slate-50 border border-slate-100 rounded-xl py-3 pl-12 pr-4 text-sm outline-none focus:border-purple-500 transition-all"
                    placeholder="请输入您的 API Key"
                  />
                </div>
                <p className="text-[10px] text-slate-400 ml-2">
                  * API Key 将仅保存在本地浏览器中
                </p>
              </div>

              <button 
                onClick={handleSaveAIConfig}
                disabled={saveStatus !== 'idle'}
                className={cn(
                  "w-full py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all",
                  saveStatus === 'success' 
                    ? "bg-emerald-500 text-white" 
                    : "bg-purple-600 text-white shadow-lg shadow-purple-100 hover:scale-[1.02] active:scale-95"
                )}
              >
                {saveStatus === 'saving' ? (
                  <RotateCw size={18} className="animate-spin" />
                ) : saveStatus === 'success' ? (
                  <>
                    <Check size={18} />
                    配置已保存
                  </>
                ) : (
                  <>
                    <Save size={18} />
                    保存 AI 配置
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="bg-orange-50 rounded-3xl p-6 border border-orange-100">
            <h4 className="text-orange-800 font-bold text-sm mb-2 flex items-center gap-2">
              <Bell size={16} />
              管理提示
            </h4>
            <ul className="text-xs text-orange-700 space-y-2 opacity-80">
              <li>• 新增用户后，他们可以使用设置的密码登录。</li>
              <li>• AI 模型配置将影响全站的对话与辅导功能。</li>
              <li>• 默认管理员账号 (admin) 无法在此处删除。</li>
            </ul>
          </div>
        </div>
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
  const [activeTab, setActiveTab] = useState('dashboard');
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

  const handleOpenStage = (stage: LessonStageKey) => {
    handleSelectStage(stage);
    setActiveTab(stage === 'dictation' ? 'dictation' : stage === 'speaking' ? 'tutor' : 'vocab');
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
    setActiveTab(mistake.stage === 'dictation' ? 'dictation' : mistake.stage === 'speaking' ? 'tutor' : 'vocab');
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

  const navItems = [
    { id: 'dashboard', label: '首页', icon: LayoutDashboard },
    { id: 'vocab', label: '教材', icon: BookOpen },
    { id: 'dictation', label: '听写', icon: PencilLine },
    { id: 'tutor', label: 'AI外教', icon: Mic2, primary: true },
    { id: 'stats', label: '统计', icon: BarChart3 },
    { id: 'profile', label: '我的', icon: Settings },
  ];

  // Add management tab for admin
  const displayNavItems = currentUser?.role === 'admin' 
    ? [...navItems, { id: 'manage', label: '管理', icon: ShieldCheck }]
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
              {activeTab === 'vocab' && (
                <VocabularyModule
                  units={availableUnits}
                  currentUnit={currentUnit}
                  studyState={studyState}
                  onSelectUnit={handleSelectUnit}
                  onSelectStage={handleSelectStage}
                  onOpenStage={handleOpenStage}
                  onMarkWord={handleMarkWord}
                  onToggleSentenceFollowed={handleToggleSentenceFollowed}
                  onCompleteStage={handleCompleteStage}
                  onAddMistake={handleAddMistake}
                />
              )}
              {activeTab === 'dictation' && (
                <DictationModule
                  currentUnit={currentUnit}
                  onCompleteStage={handleCompleteStage}
                  onAddMistake={handleAddMistake}
                />
              )}
              {activeTab === 'tutor' && (
                <AITutor
                  currentUnit={currentUnit}
                  onCompleteStage={handleCompleteStage}
                  onAddMistake={handleAddMistake}
                />
              )}
              {activeTab === 'stats' && (
                <Statistics
                  studyState={studyState}
                  currentUnit={currentUnit}
                  onRetryMistake={handleRetryMistake}
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
                />
              )}
              {activeTab === 'manage' && (
                <ManagementModule
                  textbooks={textbooks}
                  onTextbooksChanged={loadTextbooks}
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
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-lg border-t border-slate-100 px-3 py-3 flex justify-between items-center z-50">
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
      </nav>
    </div>
  );
}
