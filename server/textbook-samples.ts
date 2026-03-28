import { FLTRP_SENTENCES } from '../src/data/sentences';
import { FLTRP_VOCAB } from '../src/data/vocabulary';

export interface TextbookSampleUnit {
  unitCode: string;
  title: string;
  passage: string;
  summary: string;
  lessons: Array<{
    stageKey: 'preview' | 'reading' | 'dictation' | 'speaking';
    title: string;
    objective: string;
    sortOrder: number;
  }>;
  phrases: Array<{
    phrase: string;
    meaning: string;
    example: string;
  }>;
  patterns: Array<{
    text: string;
    translation: string;
    kind: 'sentence' | 'pattern';
  }>;
  vocab: Array<{
    id: string;
    word: string;
    phonetic: string;
    definition: string;
    example: string;
    mastered: boolean;
    grade: string;
    semester: string;
    unit: string;
  }>;
  sentences: Array<{
    id: string;
    text: string;
    translation: string;
    grade: string;
    semester: string;
    unit: string;
  }>;
}

export interface TextbookSample {
  id: string;
  publisher: string;
  series: string;
  title: string;
  stage: string;
  grade: string;
  semester: string;
  volume: string;
  description: string;
  units: TextbookSampleUnit[];
}

const stageTemplates: TextbookSampleUnit['lessons'] = [
  { stageKey: 'preview', title: '课时1 词汇预习', objective: '完成本单元核心词汇认读、辨义和发音预热。', sortOrder: 1 },
  { stageKey: 'reading', title: '课时2 课文与重点句跟读', objective: '围绕课文核心句型开展跟读与朗读训练。', sortOrder: 2 },
  { stageKey: 'dictation', title: '课时3 听写巩固', objective: '通过单词与句子听写定位拼写和语块薄弱点。', sortOrder: 3 },
  { stageKey: 'speaking', title: '课时4 口语输出', objective: '围绕单元主题完成问答、复述和情景表达。', sortOrder: 4 },
];

const junior7UpperUnitMeta = [
  {
    unitCode: 'Unit 1',
    title: 'My classmates',
    passage:
      'Hello, my name is Li Daming. I am from Beijing, China. I am in Class One, Grade Seven. My classmates come from different places, and we are happy to study English together.',
    summary: '围绕自我介绍、国籍与年龄展开基础交际。',
    phrases: [
      { phrase: 'be from', meaning: '来自', example: 'I am from China.' },
      { phrase: 'years old', meaning: '……岁', example: 'She is twelve years old.' },
      { phrase: 'Class One', meaning: '一班', example: 'He is in Class One.' },
    ],
    patterns: [
      { text: 'Where are you from?', translation: '你来自哪里？', kind: 'pattern' as const },
      { text: 'I am thirteen years old.', translation: '我十三岁了。', kind: 'sentence' as const },
    ],
  },
  {
    unitCode: 'Unit 2',
    title: 'My family',
    passage:
      'This is a photo of my family. My father is a doctor and my mother is a teacher. My grandparents live with us, and we often help each other at home.',
    summary: '学习介绍家庭成员、职业和家庭关系。',
    phrases: [
      { phrase: 'a photo of', meaning: '一张……的照片', example: 'This is a photo of my family.' },
      { phrase: 'work at', meaning: '在……工作', example: 'She works at a hospital.' },
      { phrase: 'live with', meaning: '和……一起住', example: 'I live with my parents.' },
    ],
    patterns: [
      { text: 'What does your mother do?', translation: '你的母亲是做什么的？', kind: 'pattern' as const },
      { text: 'My father is a doctor.', translation: '我的父亲是一名医生。', kind: 'sentence' as const },
    ],
  },
  {
    unitCode: 'Unit 3',
    title: 'My school',
    passage:
      'Welcome to our school. There are many classrooms, a library and a big playground. We study different subjects here and enjoy our school life every day.',
    summary: '围绕校园场所、科目与学校生活进行描述。',
    phrases: [
      { phrase: 'there is / there are', meaning: '有……', example: 'There is a big library in our school.' },
      { phrase: 'welcome to', meaning: '欢迎来到', example: 'Welcome to our school.' },
      { phrase: 'school life', meaning: '学校生活', example: 'Our school life is interesting.' },
    ],
    patterns: [
      { text: 'There are thirty classrooms in my school.', translation: '我的学校有三十间教室。', kind: 'sentence' as const },
      { text: 'What subjects do you like?', translation: '你喜欢什么科目？', kind: 'pattern' as const },
    ],
  },
  {
    unitCode: 'Unit 4',
    title: 'Healthy food',
    passage:
      'Healthy food is important for students. We have got fruit, vegetables and milk at home, but too much chocolate and cola are not good for us.',
    summary: '学习健康饮食表达以及 have got 结构。',
    phrases: [
      { phrase: 'have got', meaning: '拥有；有', example: 'We have got lots of apples.' },
      { phrase: 'too much', meaning: '太多', example: 'Too much chocolate is bad for you.' },
      { phrase: 'be good for', meaning: '对……有好处', example: 'Milk is good for you.' },
    ],
    patterns: [
      { text: 'Have we got any juice?', translation: '我们有果汁吗？', kind: 'pattern' as const },
      { text: 'Healthy food is important.', translation: '健康的食物很重要。', kind: 'sentence' as const },
    ],
  },
  {
    unitCode: 'Unit 5',
    title: 'My school day',
    passage:
      'I get up at seven o’clock and go to school at half past seven. School starts at eight, and I do my homework in the evening after dinner.',
    summary: '围绕时间表达与日常作息进行描述。',
    phrases: [
      { phrase: 'get up', meaning: '起床', example: 'I get up at seven o’clock.' },
      { phrase: 'go to school', meaning: '去上学', example: 'We go to school by bus.' },
      { phrase: 'do homework', meaning: '做作业', example: 'I do my homework in the evening.' },
    ],
    patterns: [
      { text: 'What time is it?', translation: '现在几点了？', kind: 'pattern' as const },
      { text: 'School starts at eight.', translation: '学校八点开始上课。', kind: 'sentence' as const },
    ],
  },
  {
    unitCode: 'Unit 6',
    title: 'A trip to the zoo',
    passage:
      'Let’s go to the zoo. We can see tigers, pandas, giraffes and many other animals. Different animals come from different places and eat different food.',
    summary: '围绕动物、栖息地和饮食习性展开表达。',
    phrases: [
      { phrase: 'come from', meaning: '来自', example: 'The tiger comes from Asia.' },
      { phrase: 'all over the world', meaning: '遍及世界各地', example: 'Animals live all over the world.' },
      { phrase: 'a trip to', meaning: '去……的一次旅行', example: 'We have a trip to the zoo.' },
    ],
    patterns: [
      { text: 'Does the panda eat meat?', translation: '熊猫吃肉吗？', kind: 'pattern' as const },
      { text: 'Animals are our friends.', translation: '动物是我们的朋友。', kind: 'sentence' as const },
    ],
  },
];

const junior2024_7LowerUnitMeta = [
  {
    unitCode: 'Unit 1',
    title: 'The secrets of happiness',
    passage:
      'We all want to be happy. In this unit, students explore what happiness means to different people, read “Poor in things, rich in love”, discuss how to look at things in a bright way, and write a short story about feeling happy through helping others.',
    summary: '主题是 happiness；语法点是一般过去时；单元产出是制作 ways to be happy 的书页。',
    phrases: [
      { phrase: 'the key to happiness', meaning: '幸福的关键', example: 'Love is the key to happiness.' },
      { phrase: 'look on the bright side of life', meaning: '看到生活积极的一面', example: 'It is important to look on the bright side of life.' },
      { phrase: 'grow happiness', meaning: '传递和培育幸福', example: 'It is time to grow happiness again.' },
    ],
    patterns: [
      { text: 'Love is the key to happiness.', translation: '爱是幸福的关键。', kind: 'sentence' as const },
      { text: 'How can you lead a happy life?', translation: '你怎样才能过上幸福的生活？', kind: 'pattern' as const },
      { text: 'It’s time to grow happiness again.', translation: '是时候再次培育幸福了。', kind: 'sentence' as const },
    ],
    vocab: [
      { id: 'n7b_u1_1', word: 'happiness', phonetic: '/ˈhæpinəs/', definition: '幸福；快乐', example: 'What makes you happy?', mastered: false, grade: '7年级', semester: '下学期', unit: 'Unit 1' },
      { id: 'n7b_u1_2', word: 'secret', phonetic: '/ˈsiːkrət/', definition: '秘诀；秘密', example: 'The unit explores the secrets of happiness.', mastered: false, grade: '7年级', semester: '下学期', unit: 'Unit 1' },
      { id: 'n7b_u1_3', word: 'poor', phonetic: '/pɔː(r)/', definition: '贫穷的', example: 'Charlie’s family was very poor.', mastered: false, grade: '7年级', semester: '下学期', unit: 'Unit 1' },
      { id: 'n7b_u1_4', word: 'magic', phonetic: '/ˈmædʒɪk/', definition: '魔法；神奇', example: 'The book was full of magic.', mastered: false, grade: '7年级', semester: '下学期', unit: 'Unit 1' },
      { id: 'n7b_u1_5', word: 'freezing', phonetic: '/ˈfriːzɪŋ/', definition: '冰冷的；严寒的', example: 'The freezing wind swept across the floor.', mastered: false, grade: '7年级', semester: '下学期', unit: 'Unit 1' },
      { id: 'n7b_u1_6', word: 'bright', phonetic: '/braɪt/', definition: '明亮的；积极的', example: 'Look on the bright side of life.', mastered: false, grade: '7年级', semester: '下学期', unit: 'Unit 1' },
      { id: 'n7b_u1_7', word: 'positive', phonetic: '/ˈpɒzətɪv/', definition: '积极的', example: 'How to lead a positive life.', mastered: false, grade: '7年级', semester: '下学期', unit: 'Unit 1' },
      { id: 'n7b_u1_8', word: 'grow', phonetic: '/ɡrəʊ/', definition: '成长；培育', example: 'It’s time to grow happiness again.', mastered: false, grade: '7年级', semester: '下学期', unit: 'Unit 1' },
    ],
    sentences: [
      { id: 'n7b_s1_1', text: 'What makes you happy?', translation: '什么让你感到快乐？', grade: '7年级', semester: '下学期', unit: 'Unit 1' },
      { id: 'n7b_s1_2', text: 'How can you lead a happy life?', translation: '你怎样才能过上幸福的生活？', grade: '7年级', semester: '下学期', unit: 'Unit 1' },
      { id: 'n7b_s1_3', text: 'Love is the key to happiness.', translation: '爱是幸福的关键。', grade: '7年级', semester: '下学期', unit: 'Unit 1' },
      { id: 'n7b_s1_4', text: 'The family were happy together.', translation: '这一家人快乐地在一起。', grade: '7年级', semester: '下学期', unit: 'Unit 1' },
      { id: 'n7b_s1_5', text: 'It’s time to grow happiness again.', translation: '是时候再次培育幸福了。', grade: '7年级', semester: '下学期', unit: 'Unit 1' },
    ],
  },
  {
    unitCode: 'Unit 2',
    title: 'Go for it!',
    passage:
      'The unit centres on sport and effort. According to the scope and sequence page, students read “Last but not least”, learn indefinite pronouns, listen to “A good swimmer”, and write a short paragraph about a sports team.',
    summary: '主题是 sports and effort；语法点是 indefinite pronouns；单元产出是 sports moment poster。',
    phrases: [
      { phrase: 'go for it', meaning: '放手去做；加油', example: 'When you meet a challenge, just go for it.' },
      { phrase: 'last but not least', meaning: '最后但同样重要的是', example: 'Last but not least, teamwork matters.' },
      { phrase: 'sports moment', meaning: '体育瞬间', example: 'We made a poster of a sports moment.' },
    ],
    patterns: [
      { text: 'Last but not least', translation: '最后但同样重要的是', kind: 'pattern' as const },
      { text: 'Write a short paragraph about a sports team.', translation: '写一段关于某支运动队的短文。', kind: 'sentence' as const },
    ],
    vocab: [],
    sentences: [],
  },
  {
    unitCode: 'Unit 3',
    title: 'Food matters',
    passage:
      'The scope and sequence page shows that this unit focuses on food, memory and cross-cultural understanding. Students read “Delicious memories”, learn linking verbs, discuss “A balanced diet”, and write about food across borders.',
    summary: '主题是 food；语法点是 linking verbs；单元产出是 favourite food fact sheet。',
    phrases: [
      { phrase: 'food matters', meaning: '食物很重要', example: 'Food matters to both health and culture.' },
      { phrase: 'a balanced diet', meaning: '均衡饮食', example: 'A balanced diet helps us stay healthy.' },
      { phrase: 'food across borders', meaning: '跨越地域的食物文化', example: 'Students talk about food across borders.' },
    ],
    patterns: [
      { text: 'Food matters.', translation: '食物很重要。', kind: 'sentence' as const },
      { text: 'Write a short paragraph about food across borders.', translation: '写一段关于跨地域食物文化的短文。', kind: 'pattern' as const },
    ],
    vocab: [],
    sentences: [],
  },
  {
    unitCode: 'Unit 4',
    title: 'The art of having fun',
    passage:
      'This unit focuses on balancing work and play. Students read “All work and no play makes Jack a dull boy”, learn imperatives, and prepare a report on fun activities.',
    summary: '主题是 fun and balance；语法点是 imperatives；单元产出是 fun activities report。',
    phrases: [
      { phrase: 'have fun', meaning: '玩得开心', example: 'Students learn how to have fun in a balanced way.' },
      { phrase: 'all work and no play', meaning: '只学习不娱乐', example: 'All work and no play makes Jack a dull boy.' },
      { phrase: 'turn an interest into a career', meaning: '把兴趣发展成职业', example: 'Some people turn an interest into a career.' },
    ],
    patterns: [
      { text: 'All work and no play makes Jack a dull boy.', translation: '只工作不玩耍，聪明孩子也变傻。', kind: 'sentence' as const },
      { text: 'Write a short paragraph about having fun in a balanced way.', translation: '写一段关于平衡娱乐方式的短文。', kind: 'pattern' as const },
    ],
    vocab: [],
    sentences: [],
  },
  {
    unitCode: 'Unit 5',
    title: 'Amazing nature',
    passage:
      'This unit is about natural beauty and environmental awareness. Students read “Colours of my hometown”, learn comparatives and superlatives, and make a poster about a natural wonder.',
    summary: '主题是 nature；语法点是 comparatives and superlatives；单元产出是 natural wonder poster。',
    phrases: [
      { phrase: 'amazing nature', meaning: '神奇的大自然', example: 'Amazing nature can be found around us.' },
      { phrase: 'natural wonder', meaning: '自然奇观', example: 'Students make a poster about a natural wonder.' },
      { phrase: 'cry aloud for help', meaning: '大声呼救', example: 'Natural wonders crying aloud for help is one reading topic.' },
    ],
    patterns: [
      { text: 'Amazing nature', translation: '神奇的大自然', kind: 'sentence' as const },
      { text: 'Write a short paragraph about another natural wonder crying for help.', translation: '写一段关于另一个“在呼救”的自然奇观的短文。', kind: 'pattern' as const },
    ],
    vocab: [],
    sentences: [],
  },
  {
    unitCode: 'Unit 6',
    title: 'Hitting the road',
    passage:
      'The last unit focuses on travel and exploration. Students read “Hot and cool”, learn the structure as…as, listen to “A travel vlogger and his vlog”, and write a short introduction to another great traveller.',
    summary: '主题是 travel；语法点是 as…as；单元产出是 travel plan。',
    phrases: [
      { phrase: 'hit the road', meaning: '启程上路', example: 'It is time to hit the road.' },
      { phrase: 'travel vlogger', meaning: '旅行视频博主', example: 'A travel vlogger and his vlog is one section title.' },
      { phrase: 'explore the unexplored', meaning: '探索未知', example: 'Exploring the unexplored is part of the unit.' },
    ],
    patterns: [
      { text: 'A travel vlogger and his vlog', translation: '一位旅行视频博主和他的视频日志', kind: 'sentence' as const },
      { text: 'Write a short introduction to another great traveller.', translation: '写一段关于另一位伟大旅行者的简短介绍。', kind: 'pattern' as const },
    ],
    vocab: [],
    sentences: [],
  },
];

const createSample = (
  config: Omit<TextbookSample, 'units'> & {
    unitMeta: Array<Omit<TextbookSampleUnit, 'lessons' | 'vocab' | 'sentences'> & Partial<Pick<TextbookSampleUnit, 'vocab' | 'sentences'>>>;
  }
): TextbookSample => ({
  id: config.id,
  publisher: config.publisher,
  series: config.series,
  title: config.title,
  stage: config.stage,
  grade: config.grade,
  semester: config.semester,
  volume: config.volume,
  description: config.description,
  units: config.unitMeta.map((meta) => ({
    ...meta,
    lessons: stageTemplates,
    vocab: meta.vocab ?? FLTRP_VOCAB.filter((item) => item.grade === config.grade && item.semester === config.semester && item.unit === meta.unitCode),
    sentences: meta.sentences ?? FLTRP_SENTENCES.filter((item) => item.grade === config.grade && item.semester === config.semester && item.unit === meta.unitCode),
  })),
});

export const FLTRP_JUNIOR_7A_SAMPLE: TextbookSample = createSample({
  id: 'fltrp-junior-7a',
  publisher: '外语教学与研究出版社',
  series: '英语（新标准）',
  title: '外研版初中英语 七年级上册',
  stage: '初中',
  grade: '7年级',
  semester: '上学期',
  volume: '七年级上册',
  description: '首套导入样板，覆盖外研版初中英语七年级上册 6 个单元的词汇、重点句、固定搭配与课文摘要。',
  unitMeta: junior7UpperUnitMeta,
});

export const FLTRP_JUNIOR_7B_SAMPLE: TextbookSample = createSample({
  id: 'fltrp-junior-7b',
  publisher: '外语教学与研究出版社',
  series: '英语（新标准）',
  title: '2024版外研版初中英语 七年级下册',
  stage: '初中',
  grade: '7年级',
  semester: '下学期',
  volume: '七年级下册',
  description: '基于你提供的 2024 版七年级下册 PDF 解析而来。目录页确认了 6 个单元结构；当前 PDF 正文可完整提取 Unit 1，Units 2-6 先按目录信息导入框架。',
  unitMeta: junior2024_7LowerUnitMeta,
});

export const TEXTBOOK_SAMPLES: TextbookSample[] = [FLTRP_JUNIOR_7A_SAMPLE, FLTRP_JUNIOR_7B_SAMPLE];
