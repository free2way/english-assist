import {
  addDays,
  calculateTextSimilarity,
  createTaskId,
  getLessonOutcomeLabel,
  getPronunciationHint,
  getStageLabel,
  normalizeGrammarAnswer,
  toLocalDateKey,
} from '../components/textbook/helpers';

export interface AppUser {
  id: string;
  username: string;
  grade: string;
  semester: string;
  school: string;
  role: 'admin' | 'user';
  selectedTextbookId?: string;
}

export interface AIConfig {
  model: string;
  apiKey: string;
  baseURL?: string;
}

export const DEFAULT_AI_CONFIG: AIConfig = {
  model: 'gemini-2.5-flash',
  apiKey: '',
  baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai'
};

export const AI_CONFIG_STORAGE_KEY = 'ace_ai_config';
export const AUTH_TOKEN_STORAGE_KEY = 'ace_auth_token';
export const AUTH_SESSION_HOURS_STORAGE_KEY = 'ace_auth_session_hours';
export const SESSION_DURATION_OPTIONS = [
  { value: 12, label: '12小时', description: '适合临时设备' },
  { value: 24 * 7, label: '7天', description: '推荐' },
  { value: 24 * 30, label: '30天', description: '记住登录' },
];

export const getAuthToken = () => localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);

export const setAuthToken = (token: string | null) => {
  if (token) {
    localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, token);
    return;
  }
  localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
};

export const getSavedSessionHours = () => {
  const rawValue = localStorage.getItem(AUTH_SESSION_HOURS_STORAGE_KEY);
  const parsed = rawValue ? Number(rawValue) : NaN;
  if (SESSION_DURATION_OPTIONS.some((option) => option.value === parsed)) {
    return parsed;
  }
  return 24 * 7;
};

export const setSavedSessionHours = (hours: number) => {
  localStorage.setItem(AUTH_SESSION_HOURS_STORAGE_KEY, String(hours));
};

export const apiFetch = async <T,>(path: string, init: RequestInit = {}): Promise<T> => {
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

export interface VocabItem {
  id: string;
  word: string;
  phonetic: string;
  definition: string;
  example: string;
}

export interface SentenceItem {
  id: string;
  text: string;
  translation: string;
}

export interface SpeechTokenResponse {
  token: string;
  region: string;
  expiresInSeconds: number;
}

export interface AzurePronunciationWord {
  word: string;
  accuracyScore: number;
  errorType: string;
}

export interface AzurePronunciationResult {
  pronunciationScore: number;
  accuracyScore: number;
  fluencyScore: number;
  completenessScore: number;
  words: AzurePronunciationWord[];
  feedback: string[];
}

export type LessonStageKey = 'preview' | 'reading' | 'dictation' | 'speaking';
export type TextbookPageKey = 'overview' | 'preview' | 'sentences' | 'grammar' | 'reading-practice' | 'practice' | 'challenge';
export type AppTabKey =
  | 'dashboard'
  | 'study'
  | 'textbook-overview'
  | 'textbook-preview'
  | 'textbook-sentences'
  | 'textbook-grammar'
  | 'textbook-reading'
  | 'dictation'
  | 'listening'
  | 'tutor'
  | 'stats'
  | 'profile'
  | 'challenge'
  | 'manage'
  | 'exam';
export type MistakeCategory = 'vocab' | 'dictation' | 'speaking' | 'grammar';
export type MistakeReason =
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

export interface LessonStage {
  key: LessonStageKey;
  title: string;
  description: string;
  estimatedMinutes: number;
}

export interface GrammarExample {
  text: string;
  translation: string;
}

export interface GrammarExercise {
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

export interface GrammarModule {
  id: string;
  title: string;
  focus: string;
  summary: string;
  tips: string[];
  examples: GrammarExample[];
  exercises: GrammarExercise[];
  sourceType?: 'configured' | 'generated';
}

export interface UnitBundle {
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

export interface TextbookSummary {
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

export interface TextbookContent extends TextbookSummary {
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

export interface MistakeRecord {
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
  /** Set when the mistake has been re-practised successfully (or cleared by hand). */
  resolved?: boolean;
  retryCount?: number;
  /** yyyy-mm-dd; the review pack orders by this so old mistakes surface first. */
  dueAt?: string;
  lastRetriedAt?: string;
}

export interface DailyCheckinRecord {
  date: string;
  completedTaskIds: string[];
  recommendationIds: string[];
  challengeCompleted: boolean;
  checkedIn: boolean;
}

export interface ChallengeAttempt {
  id: string;
  unitId: string;
  score: number;
  total: number;
  completedAt: string;
  details?: Array<{ id: string; kind: string; prompt: string; answer: string; expected?: string; correct: boolean }>;
}

export interface DictationAttempt {
  id: string;
  unitId: string;
  mode: 'word' | 'sentence' | 'listening';
  correct: number;
  total: number;
  completedAt: string;
}

export interface PronunciationAssessmentRecord {
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

export type AgentRoleKey = 'orchestrator' | 'speakingCoach' | 'assessment' | 'teacherInsight';
export type AgentSignalType = 'diagnosis' | 'plan' | 'practice' | 'assessment' | 'feedback' | 'teacher-insight';

export interface AgentEventRecord {
  id: string;
  agent: AgentRoleKey;
  type: AgentSignalType;
  title: string;
  detail: string;
  unitId?: string;
  stage?: LessonStageKey;
  createdAt: string;
}

export interface AgentPlanItem {
  id: string;
  agent: AgentRoleKey;
  title: string;
  rationale: string;
  nextAction: string;
  stage: LessonStageKey;
  priority: 'high' | 'medium' | 'low';
}

export interface AgentOrchestration {
  roles: Array<{
    id: AgentRoleKey;
    name: string;
    responsibility: string;
    input: string;
    output: string;
  }>;
  flow: Array<{
    agent: AgentRoleKey;
    label: string;
    status: 'done' | 'active' | 'waiting';
  }>;
  plan: AgentPlanItem[];
  assessmentSummary: string;
  teacherInsight: {
    riskLevel: 'stable' | 'watch' | 'intervene';
    summary: string;
    triggers: string[];
    actions: string[];
  };
  trace: AgentEventRecord[];
}

export interface StudyState {
  currentUnitId: string;
  currentStage: LessonStageKey;
  completedTaskIds: string[];
  masteredWordIds: string[];
  followedSentenceIds: string[];
  completedGrammarQuestionIds: string[];
  mistakes: MistakeRecord[];
  dailyCheckins: DailyCheckinRecord[];
  challengeAttempts: ChallengeAttempt[];
  dictationAttempts: DictationAttempt[];
  pronunciationAssessments: PronunciationAssessmentRecord[];
  agentEvents: AgentEventRecord[];
}

export interface RecommendationItem {
  id: string;
  title: string;
  description: string;
  stage: LessonStageKey;
  priority: 'high' | 'medium' | 'low';
  rationale?: string;
  sourceAgent?: AgentRoleKey;
  targetAgent?: AgentRoleKey;
}

export interface ReviewPackItem {
  id: string;
  title: string;
  summary: string;
  reasonLabel: string;
  stage: LessonStageKey;
  mistake: MistakeRecord;
}

export const STUDY_STATE_STORAGE_PREFIX = 'ace_study_state';
export const STAGE_META: LessonStage[] = [
  { key: 'preview', title: '课时1 词汇预习', description: '先认词义和发音，完成单词预热。', estimatedMinutes: 10 },
  { key: 'reading', title: '课时2 重点句跟读', description: '围绕重点句做跟读和朗读模仿。', estimatedMinutes: 12 },
  { key: 'dictation', title: '课时3 听写巩固', description: '通过单词和句子听写查漏补缺。', estimatedMinutes: 10 },
  { key: 'speaking', title: '课时4 口语表达', description: '围绕本单元话题做输出和问答。', estimatedMinutes: 8 },
];
export const UNIT_TITLE_MAP: Record<string, string> = {
  '7年级-上学期-Unit 1': 'My classmates',
  '7年级-上学期-Unit 2': 'My family',
  '7年级-上学期-Unit 3': 'My school',
  '7年级-上学期-Unit 4': 'Healthy food',
  '7年级-上学期-Unit 5': 'My school day',
  '7年级-上学期-Unit 6': 'A trip to the zoo',
  '7年级-下学期-Unit 1': 'Lost and found',
  '7年级-下学期-Unit 2': 'What can you do?',
};

export const getStudyStorageKey = (username: string, textbookId: string) => `${STUDY_STATE_STORAGE_PREFIX}:${username}:${textbookId}`;
export const getStudyUpdatedAtKey = (username: string, textbookId: string) => `ace_study_state_updated_at:${username}:${textbookId}`;

/** A snapshot with no learning data at all - never let it win over the server. */
export const isStudyStateEmpty = (state: StudyState) =>
  state.completedTaskIds.length === 0
  && state.masteredWordIds.length === 0
  && state.followedSentenceIds.length === 0
  && state.completedGrammarQuestionIds.length === 0
  && state.mistakes.length === 0
  && state.pronunciationAssessments.length === 0
  && state.dictationAttempts.length === 0
  && state.challengeAttempts.length === 0;
export const getSelectedTextbookStorageKey = (username: string) => `ace_selected_textbook:${username}`;

export const buildGrammarExamples = (
  patterns: Array<{ text: string; translation: string }> | undefined,
  sentences: SentenceItem[]
): GrammarExample[] => {
  const sources = (patterns && patterns.length > 0 ? patterns : sentences).slice(0, 2);
  return sources.map((item) => ({
    text: item.text,
    translation: item.translation,
  }));
};

export const buildBrokenSentence = (sentence: string) => {
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

export const scrambleTokens = (sentence: string) => {
  const tokens = sentence
    .replace(/[.,!?]/g, '')
    .split(/\s+/)
    .filter(Boolean);
  if (tokens.length < 4) return tokens.slice().reverse();
  return [...tokens.slice(2), ...tokens.slice(0, 2)];
};

export const buildExtendedGrammarExercises = (
  unitId: string,
  examples: GrammarExample[],
  startIndex: number
): GrammarExercise[] => {
  const firstExample = examples[0]?.text || 'I am from China.';
  const secondExample = examples[1]?.text || firstExample;
  const broken = buildBrokenSentence(firstExample);
  const unitHash = unitId.split('').reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
  const judgeIsCorrectSentence = unitHash % 2 === 1;
  const judgeSentence = judgeIsCorrectSentence ? secondExample : broken;

  return [
    {
      id: `${unitId}:grammar:${startIndex}`,
      type: 'judge',
      prompt: '判断正误',
      question: `判断下面句子是否正确：${judgeSentence}`,
      answer: judgeIsCorrectSentence ? '正确' : '错误',
      options: ['正确', '错误'],
      explanation: judgeIsCorrectSentence
        ? `原句 “${secondExample}” 语法和词序都正确，可以直接用于表达。`
        : `这句有语法错误，正确写法应为：${firstExample}`,
    },
    {
      id: `${unitId}:grammar:${startIndex + 1}`,
      type: 'correction',
      prompt: '病句改错',
      question: broken,
      answer: firstExample,
      clue: '直接在下方原句上修改出错的词即可。',
      explanation: `正确句子为：${firstExample}`,
    },
    {
      id: `${unitId}:grammar:${startIndex + 2}`,
      type: 'reorder',
      prompt: '连词成句',
      question: examples[1]?.translation
        ? `请点击下方词块组成正确句子（句意：${examples[1].translation}）`
        : '请点击下方词块组成一个正确句子。',
      answer: secondExample,
      tokens: scrambleTokens(secondExample),
      clue: '先找主语和动词，再点击其余词块拼接。',
      explanation: `正确语序为：${secondExample}`,
    },
  ];
};

export const buildKeyPatternExercises = (unit: {
  id: string;
  title: string;
  patterns?: Array<{ text: string; translation: string }>;
  sentences: SentenceItem[];
}): GrammarExercise[] => {
  const pool = [...(unit.patterns || []), ...unit.sentences].filter((item) => item?.text?.trim());
  const first = pool[0];
  const second = pool[1] || first;
  const third = pool[2] || second;
  const fourth = pool[3] || first;

  const uniqueEnglishOptions = Array.from(
    new Set([first?.text, second?.text, third?.text, fourth?.text, 'I like studying English every day.', 'How do you usually spend your weekend?'].filter(Boolean) as string[]),
  ).slice(0, 4);

  const words = (first?.text || '').split(/\s+/).filter(Boolean);
  const blankCandidate = words.find((w) => w.replace(/[^A-Za-z']/g, '').length >= 4) || words[Math.min(1, words.length - 1)] || words[0] || '';
  const cleanBlankAnswer = blankCandidate.replace(/[.,!?;:]+$/g, '');
  const blankedQuestion = cleanBlankAnswer
    ? (first?.text || '').replace(cleanBlankAnswer, '_____')
    : (first?.text || '');

  const meaningOptions = Array.from(
    new Set([second?.translation, first?.translation, third?.translation, '我每天都练习说英语。'].filter(Boolean) as string[]),
  ).slice(0, 4);

  return [
    {
      id: `${unit.id}:grammar:1`,
      type: 'choice',
      prompt: '看中文选英文句型',
      question: first?.translation ? `哪一句英文表达的是“${first.translation}”？` : '下面哪一句是本单元的重点句型？',
      answer: first?.text || '',
      options: uniqueEnglishOptions,
      explanation: `对应重点句型是：${first?.text || ''}（${first?.translation || ''}）。`,
    },
    {
      id: `${unit.id}:grammar:2`,
      type: 'fill',
      prompt: '补全重点句空缺词',
      question: blankedQuestion,
      answer: cleanBlankAnswer,
      clue: first?.translation ? `句意：${first.translation}（首字母提示：${cleanBlankAnswer.slice(0, 1)}...）` : '补全横线处缺少的英文单词。',
      explanation: `完整句子为：${first?.text || ''}，空缺处应填 ${cleanBlankAnswer}。`,
    },
    {
      id: `${unit.id}:grammar:3`,
      type: 'choice',
      prompt: '句型句意理解',
      question: `重点句 “${second?.text || ''}” 的正确意思是？`,
      answer: second?.translation || '',
      options: meaningOptions,
      explanation: `“${second?.text || ''}” 的意思是：${second?.translation || ''}。`,
    },
  ];
};

export const buildGrammarModule = (unit: {
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

export const buildUnitBundlesFromTextbook = (textbook: TextbookContent | null): UnitBundle[] => {
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

export const createInitialStudyState = (units: UnitBundle[]): StudyState => ({
  currentUnitId: units[0]?.id || '',
  currentStage: 'preview',
  completedTaskIds: [],
  masteredWordIds: [],
  followedSentenceIds: [],
  completedGrammarQuestionIds: [],
  mistakes: [],
  dailyCheckins: [],
  challengeAttempts: [],
  dictationAttempts: [],
  pronunciationAssessments: [],
  agentEvents: [],
});

export const normalizeStudyState = (raw: Partial<StudyState> | null, units: UnitBundle[]): StudyState => {
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
    dictationAttempts: Array.isArray(raw.dictationAttempts) ? raw.dictationAttempts.slice(0, 40) : [],
    pronunciationAssessments: Array.isArray(raw.pronunciationAssessments) ? raw.pronunciationAssessments.slice(0, 30) : [],
    agentEvents: Array.isArray(raw.agentEvents) ? raw.agentEvents.slice(0, 40) : [],
  };
};

export const getTodayKey = () => toLocalDateKey();

export const getOrCreateDailyCheckin = (studyState: StudyState, date: string): DailyCheckinRecord => {
  return studyState.dailyCheckins.find((item) => item.date === date) || {
    date,
    completedTaskIds: [],
    recommendationIds: [],
    challengeCompleted: false,
    checkedIn: false,
  };
};

export const calculateCheckinStatus = (record: DailyCheckinRecord) => {
  const progressCount = record.completedTaskIds.length + record.recommendationIds.length + (record.challengeCompleted ? 1 : 0);
  return {
    progressCount,
    ready: progressCount >= 3,
  };
};

/**
 * Check-in used to be gated on three clicks, one of which was the unchecked
 * "mark as done" shortcut. It now needs one completed lesson task plus one
 * timestamped practice (dictation, pronunciation, challenge or mistake retry).
 */
export const getTodayLearningSignals = (state: StudyState) => {
  const today = getTodayKey();
  const record = state.dailyCheckins.find((item) => item.date === today);
  const tasks = record?.completedTaskIds.length || 0;
  const tasksInRange = (value: string | undefined) => Boolean(value) && toLocalDateKey(new Date(value)) === today;
  const practices =
    state.dictationAttempts.filter((item) => tasksInRange(item.completedAt)).length
    + state.pronunciationAssessments.filter((item) => tasksInRange(item.createdAt)).length
    + state.challengeAttempts.filter((item) => tasksInRange(item.completedAt)).length
    + state.mistakes.filter((item) => tasksInRange(item.lastRetriedAt)).length;
  return { tasks, practices, ready: tasks >= 1 && practices >= 1 };
};

export const getCheckinStreak = (dailyCheckins: DailyCheckinRecord[]) => {
  const checkedDates = new Set(dailyCheckins.filter((item) => item.checkedIn).map((item) => item.date));
  let streak = 0;
  const cursor = new Date();

  // A streak stays alive until midnight: if today is not checked in yet, start
  // counting from yesterday so an evening view does not show "0 天".
  if (!checkedDates.has(toLocalDateKey(cursor))) {
    cursor.setDate(cursor.getDate() - 1);
  }

  while (true) {
    const date = toLocalDateKey(cursor);
    if (!checkedDates.has(date)) break;
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  return streak;
};

export const MISTAKE_REASON_LABELS: Record<MistakeReason, string> = {
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

export const classifyDictationIssue = (input: string, target: string) => {
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

export const buildSpeakingFeedback = (userText: string, unit: UnitBundle | null) => {
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

export const buildReviewPack = (studyState: StudyState): ReviewPackItem[] => {
  const seen = new Set<string>();
  return studyState.mistakes
    .filter((item) => !item.resolved)
    .filter((item) => {
      const key = `${item.stage}:${item.prompt}:${item.reason || 'none'}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => (a.dueAt || a.createdAt).localeCompare(b.dueAt || b.createdAt))
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

export const normalizeEnglishText = (text: string) =>
  text
    .toLowerCase()
    .replace(/[.,!?;:'"]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

export const getWeaknessSummary = (studyState: StudyState) => {
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

export const AGENT_ROLES: AgentOrchestration['roles'] = [
  {
    id: 'orchestrator',
    name: '学习编排 Agent',
    responsibility: '诊断进度并决定下一步任务',
    input: '教材进度、错题、发音记录、打卡状态',
    output: '今日计划与任务优先级',
  },
  {
    id: 'speakingCoach',
    name: '口语陪练 Agent',
    responsibility: '围绕教材话题做目标导向对练',
    input: '当前单元、重点句、编排目标',
    output: '对话练习、表达纠错、口语任务完成信号',
  },
  {
    id: 'assessment',
    name: '评测反馈 Agent',
    responsibility: '归因听写与口语评测结果',
    input: '错题、发音分、弱读词、听写答案',
    output: '复习包、薄弱项、下一轮训练建议',
  },
  {
    id: 'teacherInsight',
    name: '教师洞察 Agent',
    responsibility: '把学生信号转成教师可行动建议',
    input: '学习记录、风险触发条件、班级趋势',
    output: '风险等级、干预建议、周报素材',
  },
];

export const AGENT_LABELS: Record<AgentRoleKey, string> = {
  orchestrator: '学习编排 Agent',
  speakingCoach: '口语陪练 Agent',
  assessment: '评测反馈 Agent',
  teacherInsight: '教师洞察 Agent',
};

export const createAgentEvent = (
  input: Omit<AgentEventRecord, 'id' | 'createdAt'>
): AgentEventRecord => ({
  ...input,
  id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
  createdAt: new Date().toISOString(),
});

export const appendAgentEvent = (events: AgentEventRecord[], event: Omit<AgentEventRecord, 'id' | 'createdAt'>) => [
  createAgentEvent(event),
  ...events,
].slice(0, 40);

export const buildTeacherInsight = (unit: UnitBundle | null, studyState: StudyState): AgentOrchestration['teacherInsight'] => {
  const mistakes = studyState.mistakes.filter((item) => !unit || item.unitId === unit.id);
  const speakingMistakes = mistakes.filter((item) => item.category === 'speaking');
  const dictationMistakes = mistakes.filter((item) => item.category === 'dictation');
  const pronunciationRecords = studyState.pronunciationAssessments.filter((item) => !unit || item.unitId === unit.id);
  const lowPronunciation = pronunciationRecords.filter((item) => item.pronunciationScore < 75);
  const challengeStatus = getUnitChallengeStatus(unit, studyState);
  const triggers: string[] = [];
  const actions: string[] = [];

  if (mistakes.length >= 4) {
    triggers.push(`累计 ${mistakes.length} 条错题`);
    actions.push('安排 10 分钟错题复盘，优先处理重复问题');
  }
  if (speakingMistakes.length >= 2 || lowPronunciation.length > 0) {
    triggers.push('口语或发音信号偏弱');
    actions.push('让学生先跟读重点句，再进行一次短口语输出');
  }
  if (dictationMistakes.length >= 2) {
    triggers.push('听写漏词或句型错误偏多');
    actions.push('布置 3 条重点句听写，检查主谓和关键词');
  }
  if (challengeStatus.progress < 50) {
    triggers.push(`闯关准备度 ${challengeStatus.progress}%`);
    actions.push('先完成编排 Agent 推荐的高优先任务，不急于闯关');
  }

  if (triggers.length === 0) {
    triggers.push('当前没有明显风险触发');
    actions.push('保持当前学习节奏，下一步可进入口语拓展');
  }

  const riskLevel = triggers.length >= 3
    ? 'intervene'
    : triggers.length >= 2 || mistakes.length >= 2
      ? 'watch'
      : 'stable';

  return {
    riskLevel,
    summary: riskLevel === 'intervene'
      ? '建议教师本周主动干预，先清理错题和发音弱项。'
      : riskLevel === 'watch'
        ? '建议持续观察，完成一次复盘后再推进新任务。'
        : '学习状态稳定，可继续按计划推进。',
    triggers,
    actions,
  };
};

export const buildAgentOrchestration = (unit: UnitBundle | null, studyState: StudyState): AgentOrchestration => {
  const recommendations = generateDailyRecommendations(unit, studyState);
  const reviewPack = buildReviewPack(studyState);
  const pronunciationRecords = unit
    ? studyState.pronunciationAssessments.filter((item) => item.unitId === unit.id)
    : studyState.pronunciationAssessments;
  const latestPronunciation = pronunciationRecords[0];
  const teacherInsight = buildTeacherInsight(unit, studyState);
  const hasCurrentTask = unit
    ? !studyState.completedTaskIds.includes(createTaskId(unit.id, studyState.currentStage))
    : false;

  const plan: AgentPlanItem[] = recommendations.slice(0, 3).map((item) => ({
    id: `agent-plan-${item.id}`,
    agent: item.sourceAgent || 'orchestrator',
    title: item.title,
    rationale: item.rationale || item.description,
    nextAction: `打开${getStageLabel(item.stage)}并完成任务`,
    stage: item.stage,
    priority: item.priority,
  }));

  const flow: AgentOrchestration['flow'] = [
    {
      agent: 'orchestrator',
      label: unit ? `已读取 ${unit.unit} 的进度与错题` : '等待教材数据',
      status: unit ? 'done' : 'waiting',
    },
    {
      agent: 'speakingCoach',
      label: studyState.currentStage === 'speaking' ? '正在驱动口语陪练' : '等待编排任务触发',
      status: studyState.currentStage === 'speaking' ? 'active' : hasCurrentTask ? 'waiting' : 'done',
    },
    {
      agent: 'assessment',
      label: reviewPack.length > 0 || latestPronunciation ? '已形成复盘信号' : '等待练习结果回流',
      status: reviewPack.length > 0 || latestPronunciation ? 'active' : 'waiting',
    },
    {
      agent: 'teacherInsight',
      label: `${teacherInsight.riskLevel === 'stable' ? '稳定' : teacherInsight.riskLevel === 'watch' ? '观察' : '需干预'}：${teacherInsight.triggers[0]}`,
      status: studyState.agentEvents.some((event) => event.agent === 'teacherInsight') ? 'done' : 'active',
    },
  ];

  return {
    roles: AGENT_ROLES,
    flow,
    plan,
    assessmentSummary: latestPronunciation
      ? `最近一次发音 ${latestPronunciation.pronunciationScore} 分，弱词：${latestPronunciation.weakWords.slice(0, 3).join('、') || '暂无'}`
      : reviewPack[0]
        ? `优先复盘：${reviewPack[0].reasonLabel}，${reviewPack[0].summary}`
        : '暂无明显薄弱项，建议继续推进当前课时。',
    teacherInsight,
    trace: studyState.agentEvents.slice(0, 6),
  };
};

export const loadStudyStateForUser = (username: string, textbookId: string, units: UnitBundle[]) => {
  const raw = localStorage.getItem(getStudyStorageKey(username, textbookId));
  if (!raw) return createInitialStudyState(units);
  try {
    return normalizeStudyState(JSON.parse(raw) as Partial<StudyState>, units);
  } catch (error) {
    return createInitialStudyState(units);
  }
};

export const getUnitChallengeStatus = (unit: UnitBundle | null, studyState: StudyState) => {
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

export const generateDailyRecommendations = (unit: UnitBundle | null, studyState: StudyState): RecommendationItem[] => {
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
      rationale: `评测反馈 Agent 发现最新错点属于「${reviewPack[0].reasonLabel}」，需要先回流给学习编排 Agent 调整路径。`,
      sourceAgent: 'assessment',
      targetAgent: 'orchestrator',
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
      rationale: `学习编排 Agent 判断当前课时尚未完成，需要先保持主线连续。`,
      sourceAgent: 'orchestrator',
      targetAgent: currentStageMeta.key === 'speaking' ? 'speakingCoach' : 'assessment',
    });
  }

  if (unit.vocab.some((word) => !studyState.masteredWordIds.includes(word.id))) {
    recommendations.push({
      id: 'preview-refresh',
      title: '补齐本单元未掌握词汇',
      description: '先把词义和发音补稳，再进入听写和口语输出会更顺。',
      stage: 'preview',
      priority: 'medium',
      rationale: '学习编排 Agent 检测到仍有未掌握词汇，先补输入再做输出。',
      sourceAgent: 'orchestrator',
      targetAgent: 'assessment',
    });
  }

  if (unit.sentences.some((sentence) => !studyState.followedSentenceIds.includes(sentence.id))) {
    recommendations.push({
      id: 'reading-refresh',
      title: '完成重点句跟读',
      description: '逐句跟读重点句，帮助后面的听写和表达更顺。',
      stage: 'reading',
      priority: 'medium',
      rationale: '学习编排 Agent 检测到重点句跟读未完成，先补句型语料。',
      sourceAgent: 'orchestrator',
      targetAgent: 'assessment',
    });
  }

  if (unit.grammar.exercises.some((exercise) => !studyState.completedGrammarQuestionIds.includes(exercise.id))) {
    recommendations.push({
      id: 'grammar-refresh',
      title: '完成本单元语法模块',
      description: `先完成 ${unit.grammar.title}，再做听写和口语会更稳。`,
      stage: 'reading',
      priority: 'medium',
      rationale: '评测反馈 Agent 将语法练习作为后续听写和口语输出的支撑任务。',
      sourceAgent: 'assessment',
      targetAgent: 'orchestrator',
    });
  }

  if (!recommendations.some((item) => item.stage === 'speaking')) {
    recommendations.push({
      id: 'speaking-boost',
      title: '做一次单元口语输出',
      description: '围绕本单元主题回答 2-3 个问题，把输入真正转成输出。',
      stage: 'speaking',
      priority: 'low',
      rationale: '学习编排 Agent 判断输入任务已有基础，可以交给口语陪练 Agent 做输出训练。',
      sourceAgent: 'orchestrator',
      targetAgent: 'speakingCoach',
    });
  }

  return recommendations.slice(0, 4);
};

export interface ChallengeQuestionInput {
  id: string;
  prompt: string;
  expected: string;
  kind: string;
  options?: string[];
  audioText?: string;
  clue?: string;
  translation?: string;
}

export const buildChallengeQuestions = (unit: UnitBundle | null): ChallengeQuestionInput[] => {
  if (!unit) return [];

  const questions: ChallengeQuestionInput[] = [];

  // 1-2: Objective vocab meaning choice (zero false negatives)
  unit.vocab.slice(0, 2).forEach((word, index) => {
    const distractors = unit.vocab
      .filter((item) => item.id !== word.id)
      .slice(index, index + 3)
      .map((item) => item.definition);
    const options = Array.from(new Set([word.definition, ...distractors])).slice(0, 4);
    const rotated = options.length > 1
      ? [...options.slice((index + 1) % options.length), ...options.slice(0, (index + 1) % options.length)]
      : options;
    questions.push({
      id: `${unit.id}-vocab-choice-${word.id}`,
      prompt: `选出单词 “${word.word}” 的正确中文含义`,
      expected: word.definition,
      kind: 'vocab-choice',
      options: rotated,
      audioText: word.word,
      clue: word.phonetic || undefined,
    });
  });

  // 3: Listening + spelling check for a core word
  const spellWord = unit.vocab[2] || unit.vocab[0];
  if (spellWord) {
    questions.push({
      id: `${unit.id}-vocab-spell-${spellWord.id}`,
      prompt: `听读音并拼写出“${spellWord.definition}”对应的英文单词`,
      expected: spellWord.word,
      kind: 'vocab-spell',
      audioText: spellWord.word,
      clue: `首字母提示：${spellWord.word.slice(0, 1)}___（共 ${spellWord.word.length} 个字母）`,
    });
  }

  // 4: Sentence meaning choice (or reading) with audio
  const sentenceItem = unit.sentences[0];
  if (sentenceItem) {
    const distractors = unit.sentences
      .filter((item) => item.id !== sentenceItem.id)
      .slice(0, 3)
      .map((item) => item.translation);
    const options = Array.from(new Set([sentenceItem.translation, ...distractors])).slice(0, 4);
    questions.push({
      id: `${unit.id}-sentence-choice-${sentenceItem.id}`,
      prompt: `听/读句子，选出正确的中文意思：${sentenceItem.text}`,
      expected: sentenceItem.translation,
      kind: 'sentence-choice',
      options,
      audioText: sentenceItem.text,
      translation: sentenceItem.translation,
    });
  }

  // 5: Unit speaking / writing output (supports voice or text)
  questions.push({
    id: `${unit.id}-summary`,
    prompt: `围绕本单元话题 “${unit.title}”，用英文说出或写出 2 句完整表达`,
    expected: unit.sentences.slice(0, 2).map((sentence) => sentence.text).join(' / '),
    kind: 'speaking',
    clue: unit.sentences[0]?.text ? `可参考句型：${unit.sentences[0].text}` : '试着用完整英文句子表达你的想法和原因。',
  });

  return questions;
};

export const getChallengeHistoryForUnit = (studyState: StudyState, unitId: string) => {
  return studyState.challengeAttempts.filter((attempt) => attempt.unitId === unitId);
};

/**
 * Scores one challenge answer with fair, objective checks for middle schoolers.
 */
export const scoreChallengeAnswer = (
  question: ChallengeQuestionInput,
  answer: string,
  unit: UnitBundle | null,
): { correct: boolean; detail: string } => {
  const trimmed = answer.trim();
  if (!trimmed) return { correct: false, detail: '还未作答' };

  const normalizedAnswer = normalizeGrammarAnswer(trimmed);

  if (question.kind === 'vocab-choice' || question.kind === 'sentence-choice') {
    const correct = normalizedAnswer === normalizeGrammarAnswer(question.expected);
    return {
      correct,
      detail: correct ? '选择正确！' : `正确答案：${question.expected}`,
    };
  }

  if (question.kind === 'vocab-spell') {
    const correct = normalizedAnswer === normalizeGrammarAnswer(question.expected);
    return {
      correct,
      detail: correct ? `拼写准确：${question.expected}` : `正确拼写：${question.expected}，你的拼写：${trimmed}`,
    };
  }

  if (question.kind === 'vocab' || question.kind === 'meaning') {
    const segments = question.expected
      .split(/[；;、,，/／\s]+/)
      .map((segment) => segment.replace(/^[a-z]+\.\s*/i, '').trim())
      .filter(Boolean);
    const hits = segments.filter((segment) => {
      const cleanSeg = normalizeGrammarAnswer(segment);
      return cleanSeg.length > 0 && (normalizedAnswer.includes(cleanSeg) || cleanSeg.includes(normalizedAnswer));
    });
    const correct = hits.length > 0 || normalizedAnswer.includes(normalizeGrammarAnswer(question.expected));
    return {
      correct,
      detail: correct
        ? `命中要点：${hits.slice(0, 3).join('、') || question.expected}`
        : `参考释义：${question.expected}`,
    };
  }

  if (question.kind === 'sentence') {
    const similarity = calculateTextSimilarity(trimmed, question.expected);
    const cjk = /[\u4e00-\u9fa5]/.test(question.expected);
    const coverage = cjk
      ? (() => {
        const chars = Array.from(new Set(question.expected.replace(/[^\u4e00-\u9fa5]/g, '').split('')));
        if (chars.length === 0) return 0;
        return chars.filter((char) => trimmed.includes(char)).length / chars.length;
      })()
      : similarity / 100;
    const correct = coverage >= 0.45 || similarity >= 75;
    return {
      correct,
      detail: correct ? '理解准确！' : `参考译文：${question.expected}`,
    };
  }

  // Speaking output: fair rubric — at least 6 English words forming real expression
  const englishWords = trimmed.match(/[A-Za-z]+(?:'[A-Za-z]+)?/g) || [];
  if (englishWords.length >= 8) {
    return {
      correct: true,
      detail: '表达完整清晰！继续保持用完整英文句输出。',
    };
  }
  const feedback = buildSpeakingFeedback(trimmed, unit);
  return {
    correct: englishWords.length >= 6 && feedback.score >= 2,
    detail: englishWords.length >= 6
      ? '意思不错，试着再多补充一句原因或细节（8 个词以上更稳）。'
      : '表达还比较简短，试着用至少 2 句完整英文来介绍这个话题。',
  };
};
export const buildSevenDayTrend = (dailyCheckins: DailyCheckinRecord[]) => {
  return Array.from({ length: 7 }).map((_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - index));
    const dateKey = toLocalDateKey(date);
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

export const getSpeakingCoachConfig = (unit: UnitBundle | null) => {
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
