import { FLTRP_SENTENCES } from './sentences.js';
import { FLTRP_VOCAB } from './vocabulary.js';

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
      'This unit focuses on sport, perseverance and positive effort. In the reading “Last but not least”, students meet Zhang Shun, an 86-year-old runner in the 2022 Beijing Marathon. Although he had a stomachache and fell behind, he chose to run on with people cheering and finally crossed the finishing line. The unit guides students to notice key sports expressions, practise indefinite pronouns, and talk or write about inspiring sports moments and teams.',
    summary: '主题是 sports and effort；语法点是 indefinite pronouns；课文围绕北京马拉松老年跑者 Zhang Shun 坚持完赛的故事展开；单元产出是 sports moment poster。',
    phrases: [
      { phrase: 'go for it', meaning: '放手去做；加油', example: 'When you meet a challenge, just go for it.' },
      { phrase: 'last but not least', meaning: '最后但同样重要的是', example: 'Last but not least, teamwork matters.' },
      { phrase: 'fall behind', meaning: '落后', example: 'He fell behind because he had a stomachache on the way.' },
      { phrase: 'finishing line', meaning: '终点线', example: 'At last, he crossed the finishing line.' },
      { phrase: 'cheer for', meaning: '为……加油', example: 'People cheered for Zhang Shun at the race.' },
    ],
    patterns: [
      { text: 'Last but not least', translation: '最后但同样重要的是', kind: 'pattern' as const },
      { text: 'Shall I take a rest or stop?', translation: '我是该休息一下还是停下来？', kind: 'sentence' as const },
      { text: 'Running isn’t about winning - it’s about enjoying the sport itself.', translation: '跑步并不只是为了获胜，而是为了享受这项运动本身。', kind: 'sentence' as const },
      { text: 'Write a short paragraph about a sports team.', translation: '写一段关于某支运动队的短文。', kind: 'pattern' as const },
    ],
    vocab: [
      { id: 'n7b_u2_1', word: 'cheer', phonetic: '/tʃɪə(r)/', definition: '欢呼；喝彩', example: 'People cheered as the old runner moved forward.', mastered: false, grade: '7年级', semester: '下学期', unit: 'Unit 2' },
      { id: 'n7b_u2_2', word: 'finishing line', phonetic: '/ˈfɪnɪʃɪŋ laɪn/', definition: '终点线', example: 'He finally crossed the finishing line.', mastered: false, grade: '7年级', semester: '下学期', unit: 'Unit 2' },
      { id: 'n7b_u2_3', word: 'fall behind', phonetic: '/fɔːl bɪˈhaɪnd/', definition: '落后', example: 'The stomachache made him fall behind.', mastered: false, grade: '7年级', semester: '下学期', unit: 'Unit 2' },
      { id: 'n7b_u2_4', word: 'train', phonetic: '/treɪn/', definition: '训练', example: 'For years, he trained every morning in the park.', mastered: false, grade: '7年级', semester: '下学期', unit: 'Unit 2' },
      { id: 'n7b_u2_5', word: 'marathon', phonetic: '/ˈmærəθən/', definition: '马拉松', example: 'The story happened in the 2022 Beijing Marathon.', mastered: false, grade: '7年级', semester: '下学期', unit: 'Unit 2' },
      { id: 'n7b_u2_6', word: 'confident', phonetic: '/ˈkɒnfɪdənt/', definition: '自信的', example: 'Zhang felt confident before the race.', mastered: false, grade: '7年级', semester: '下学期', unit: 'Unit 2' },
      { id: 'n7b_u2_7', word: 'stomachache', phonetic: '/ˈstʌməkeɪk/', definition: '胃痛', example: 'He had a stomachache on the way.', mastered: false, grade: '7年级', semester: '下学期', unit: 'Unit 2' },
      { id: 'n7b_u2_8', word: 'runner', phonetic: '/ˈrʌnə(r)/', definition: '跑步者', example: 'He became the oldest runner to finish the marathon.', mastered: false, grade: '7年级', semester: '下学期', unit: 'Unit 2' },
    ],
    sentences: [
      { id: 'n7b_s2_1', text: 'It was the last minute of the 2022 Beijing Marathon.', translation: '那是 2022 年北京马拉松的最后时刻。', grade: '7年级', semester: '下学期', unit: 'Unit 2' },
      { id: 'n7b_s2_2', text: 'Zhang Shun was still about 100 metres from the finishing line.', translation: '张顺距离终点线大约还有 100 米。', grade: '7年级', semester: '下学期', unit: 'Unit 2' },
      { id: 'n7b_s2_3', text: 'This made him fall behind.', translation: '这让他落在了后面。', grade: '7年级', semester: '下学期', unit: 'Unit 2' },
      { id: 'n7b_s2_4', text: 'With people cheering, he finally crossed the finishing line.', translation: '在人们的欢呼声中，他终于越过了终点线。', grade: '7年级', semester: '下学期', unit: 'Unit 2' },
      { id: 'n7b_s2_5', text: 'Running isn’t about winning - it’s about enjoying the sport itself.', translation: '跑步并不只是为了获胜，而是为了享受这项运动本身。', grade: '7年级', semester: '下学期', unit: 'Unit 2' },
    ],
  },
  {
    unitCode: 'Unit 3',
    title: 'Food matters',
    passage:
      'This unit links food with memory, culture and family warmth. In “Delicious memories”, the writer says the taste and smell of certain food can bring back memories. The passage describes the mother’s home cooking, such as mapo tofu, dumplings, chicken soup and pancakes, but finally reveals that simple porridge is the writer’s favourite because it carries care, comfort and the feeling of home. Students also learn linking verbs and discuss balanced diets and food across borders.',
    summary: '主题是 food；语法点是 linking verbs；课文围绕 favourite food memory 展开，突出食物与亲情、记忆和文化的联系；单元产出是 favourite food fact sheet。',
    phrases: [
      { phrase: 'food matters', meaning: '食物很重要', example: 'Food matters to both health and culture.' },
      { phrase: 'a balanced diet', meaning: '均衡饮食', example: 'A balanced diet helps us stay healthy.' },
      { phrase: 'bring back memories', meaning: '勾起回忆', example: 'The smell of porridge can bring back memories.' },
      { phrase: 'eight-treasure porridge', meaning: '八宝粥', example: 'Sometimes, it is sweet eight-treasure porridge.' },
      { phrase: 'better medicine than a pill', meaning: '比药片更好的良方', example: 'Warm porridge feels better medicine than a pill.' },
    ],
    patterns: [
      { text: 'Food matters.', translation: '食物很重要。', kind: 'sentence' as const },
      { text: 'The taste and smell of a certain food can often bring back memories.', translation: '某种食物的味道和气味常常会勾起回忆。', kind: 'sentence' as const },
      { text: 'What food remains strong in your memory?', translation: '什么食物在你的记忆中依然很深刻？', kind: 'pattern' as const },
      { text: 'Write a short paragraph about food across borders.', translation: '写一段关于跨地域食物文化的短文。', kind: 'pattern' as const },
    ],
    vocab: [
      { id: 'n7b_u3_1', word: 'dumpling', phonetic: '/ˈdʌmplɪŋ/', definition: '饺子', example: 'Carrots and mutton become lovely dumplings.', mastered: false, grade: '7年级', semester: '下学期', unit: 'Unit 3' },
      { id: 'n7b_u3_2', word: 'porridge', phonetic: '/ˈpɒrɪdʒ/', definition: '粥', example: 'The writer often wakes up to the smell of porridge.', mastered: false, grade: '7年级', semester: '下学期', unit: 'Unit 3' },
      { id: 'n7b_u3_3', word: 'green onion', phonetic: '/ɡriːn ˈʌnjən/', definition: '大葱', example: 'Eggs and green onions become wonderful pancakes.', mastered: false, grade: '7年级', semester: '下学期', unit: 'Unit 3' },
      { id: 'n7b_u3_4', word: 'carrot', phonetic: '/ˈkærət/', definition: '胡萝卜', example: 'Carrots and mutton become lovely dumplings.', mastered: false, grade: '7年级', semester: '下学期', unit: 'Unit 3' },
      { id: 'n7b_u3_5', word: 'mutton', phonetic: '/ˈmʌtn/', definition: '羊肉', example: 'Mutton is one of the ingredients in the dumplings.', mastered: false, grade: '7年级', semester: '下学期', unit: 'Unit 3' },
      { id: 'n7b_u3_6', word: 'tofu', phonetic: '/ˈtəʊfuː/', definition: '豆腐', example: 'Tofu and beef become red, hot mapo tofu.', mastered: false, grade: '7年级', semester: '下学期', unit: 'Unit 3' },
      { id: 'n7b_u3_7', word: 'beef', phonetic: '/biːf/', definition: '牛肉', example: 'Beef is used in the writer’s home dishes.', mastered: false, grade: '7年级', semester: '下学期', unit: 'Unit 3' },
      { id: 'n7b_u3_8', word: 'thousand-year-old egg', phonetic: '/ˌθaʊzənd jɪə(r) əʊld eɡ/', definition: '皮蛋', example: 'Sometimes the porridge has pork and thousand-year-old eggs.', mastered: false, grade: '7年级', semester: '下学期', unit: 'Unit 3' },
    ],
    sentences: [
      { id: 'n7b_s3_1', text: 'The taste and smell of a certain food can often bring back memories.', translation: '某种食物的味道和气味常常会勾起回忆。', grade: '7年级', semester: '下学期', unit: 'Unit 3' },
      { id: 'n7b_s3_2', text: 'My mother can do magic in the kitchen.', translation: '我妈妈在厨房里像会变魔法一样。', grade: '7年级', semester: '下学期', unit: 'Unit 3' },
      { id: 'n7b_s3_3', text: 'But my favourite food is porridge.', translation: '但我最喜欢的食物是粥。', grade: '7年级', semester: '下学期', unit: 'Unit 3' },
      { id: 'n7b_s3_4', text: 'When I fall ill, my mother always makes plain rice porridge for me.', translation: '当我生病时，妈妈总会给我做白米粥。', grade: '7年级', semester: '下学期', unit: 'Unit 3' },
      { id: 'n7b_s3_5', text: 'For me, however, it’s the best food in the world.', translation: '然而，对我来说，那是世界上最好的食物。', grade: '7年级', semester: '下学期', unit: 'Unit 3' },
    ],
  },
  {
    unitCode: 'Unit 4',
    title: 'The art of having fun',
    passage:
      'This unit is about the value of fun in a healthy life. In “All work and no play makes Jack a dull boy”, students imagine living alone on an island and realise that fun is just as necessary as food or tools. The passage explains that fun can do away with bad feelings, lift people’s spirits, keep us feeling youthful and bring people closer through shared experiences. The unit then develops imperatives and asks students to present fun activities in a balanced way.',
    summary: '主题是 fun and balance；语法点是 imperatives；课文强调娱乐、情绪调节和人际联结的重要性；单元产出是 fun activities report。',
    phrases: [
      { phrase: 'have fun', meaning: '玩得开心', example: 'Students learn how to have fun in a balanced way.' },
      { phrase: 'all work and no play', meaning: '只学习不娱乐', example: 'All work and no play makes Jack a dull boy.' },
      { phrase: 'lift sb’s spirits', meaning: '振奋某人的精神', example: 'Fun can lift our spirits after a hard day.' },
      { phrase: 'bring people closer', meaning: '拉近人与人之间的距离', example: 'Shared fun activities bring people closer.' },
      { phrase: 'a moment of joy', meaning: '快乐时刻', example: 'A funny film can become a moment of joy.' },
    ],
    patterns: [
      { text: 'All work and no play makes Jack a dull boy.', translation: '只工作不玩耍，聪明孩子也变傻。', kind: 'sentence' as const },
      { text: 'Fun can do away with bad feelings and lift our spirits.', translation: '快乐可以赶走坏情绪，振奋我们的精神。', kind: 'sentence' as const },
      { text: 'We don’t stop playing because we grow old; we grow old because we stop playing.', translation: '我们不是因为变老才停止玩乐，而是因为停止玩乐才变老。', kind: 'sentence' as const },
      { text: 'Write a short paragraph about having fun in a balanced way.', translation: '写一段关于平衡娱乐方式的短文。', kind: 'pattern' as const },
    ],
    vocab: [
      { id: 'n7b_u4_1', word: 'island', phonetic: '/ˈaɪlənd/', definition: '岛屿', example: 'Imagine staying on an island alone.', mastered: false, grade: '7年级', semester: '下学期', unit: 'Unit 4' },
      { id: 'n7b_u4_2', word: 'youthful', phonetic: '/ˈjuːθfl/', definition: '年轻的；有朝气的', example: 'Fun keeps us feeling youthful.', mastered: false, grade: '7年级', semester: '下学期', unit: 'Unit 4' },
      { id: 'n7b_u4_3', word: 'spirit', phonetic: '/ˈspɪrɪt/', definition: '精神；情绪', example: 'Fun can lift our spirits.', mastered: false, grade: '7年级', semester: '下学期', unit: 'Unit 4' },
      { id: 'n7b_u4_4', word: 'shared', phonetic: '/ʃeəd/', definition: '共同的；共享的', example: 'You become closer because of the shared experience.', mastered: false, grade: '7年级', semester: '下学期', unit: 'Unit 4' },
      { id: 'n7b_u4_5', word: 'boring', phonetic: '/ˈbɔːrɪŋ/', definition: '无聊的', example: 'After all, no one wants to get bored.', mastered: false, grade: '7年级', semester: '下学期', unit: 'Unit 4' },
      { id: 'n7b_u4_6', word: 'closer', phonetic: '/ˈkləʊsə(r)/', definition: '更亲近的', example: 'Fun brings people closer.', mastered: false, grade: '7年级', semester: '下学期', unit: 'Unit 4' },
      { id: 'n7b_u4_7', word: 'joy', phonetic: '/dʒɔɪ/', definition: '欢乐', example: 'It becomes a moment of joy.', mastered: false, grade: '7年级', semester: '下学期', unit: 'Unit 4' },
      { id: 'n7b_u4_8', word: 'experience', phonetic: '/ɪkˈspɪəriəns/', definition: '经历；体验', example: 'Shared experience makes people closer.', mastered: false, grade: '7年级', semester: '下学期', unit: 'Unit 4' },
    ],
    sentences: [
      { id: 'n7b_s4_1', text: 'Most people would choose something for fun.', translation: '大多数人会选择一些带来乐趣的东西。', grade: '7年级', semester: '下学期', unit: 'Unit 4' },
      { id: 'n7b_s4_2', text: 'Fun can do away with bad feelings and lift our spirits.', translation: '快乐可以赶走坏情绪，振奋我们的精神。', grade: '7年级', semester: '下学期', unit: 'Unit 4' },
      { id: 'n7b_s4_3', text: 'Fun also keeps us feeling youthful.', translation: '快乐还能让我们保持年轻的感觉。', grade: '7年级', semester: '下学期', unit: 'Unit 4' },
      { id: 'n7b_s4_4', text: 'Fun is a good way to connect with others.', translation: '快乐是与他人建立联系的好方式。', grade: '7年级', semester: '下学期', unit: 'Unit 4' },
      { id: 'n7b_s4_5', text: 'We need to work hard, but we should be able to play hard, too.', translation: '我们需要努力学习，也应该尽情玩耍。', grade: '7年级', semester: '下学期', unit: 'Unit 4' },
    ],
  },
  {
    unitCode: 'Unit 5',
    title: 'Amazing nature',
    passage:
      'This unit explores natural beauty through the reading “Colours of my hometown”. The writer introduces life on the Qinghai-Tibet Plateau and describes the colours of nature there: white clouds and mountains, the blue sky, blue rivers and lakes, and green grasslands and fields. The passage blends description with emotion, showing why the writer is proud of the hometown. Students also learn comparatives and superlatives and later create a poster about a natural wonder.',
    summary: '主题是 nature；语法点是 comparatives and superlatives；课文围绕青藏高原家乡的自然色彩展开；单元产出是 natural wonder poster。',
    phrases: [
      { phrase: 'amazing nature', meaning: '神奇的大自然', example: 'Amazing nature can be found around us.' },
      { phrase: 'natural wonder', meaning: '自然奇观', example: 'Students make a poster about a natural wonder.' },
      { phrase: 'be full of', meaning: '充满', example: 'This area is full of amazing colours in nature.' },
      { phrase: 'a hundred kinds of', meaning: '各种各样的；许多种', example: 'There are a hundred kinds of blue in the water.' },
      { phrase: 'be proud of', meaning: '以……为自豪', example: 'I am proud to say I’m from one of the most beautiful places in the world.' },
    ],
    patterns: [
      { text: 'Amazing nature', translation: '神奇的大自然', kind: 'sentence' as const },
      { text: 'My hometown is on the Qinghai-Tibet Plateau.', translation: '我的家乡在青藏高原。', kind: 'sentence' as const },
      { text: 'The lovely blue of the sky always gives me a calm feeling.', translation: '天空那可爱的蓝色总会带给我平静的感觉。', kind: 'sentence' as const },
      { text: 'Write a short paragraph about another natural wonder crying for help.', translation: '写一段关于另一个“在呼救”的自然奇观的短文。', kind: 'pattern' as const },
    ],
    vocab: [
      { id: 'n7b_u5_1', word: 'nature', phonetic: '/ˈneɪtʃə(r)/', definition: '自然', example: 'This area is full of the most amazing colours in nature.', mastered: false, grade: '7年级', semester: '下学期', unit: 'Unit 5' },
      { id: 'n7b_u5_2', word: 'calm', phonetic: '/kɑːm/', definition: '平静的', example: 'The blue sky gives the writer a calm feeling.', mastered: false, grade: '7年级', semester: '下学期', unit: 'Unit 5' },
      { id: 'n7b_u5_3', word: 'cloud', phonetic: '/klaʊd/', definition: '云', example: 'The clouds are clean and soft.', mastered: false, grade: '7年级', semester: '下学期', unit: 'Unit 5' },
      { id: 'n7b_u5_4', word: 'mountain', phonetic: '/ˈmaʊntən/', definition: '山', example: 'The mountains shine brightly in the sun.', mastered: false, grade: '7年级', semester: '下学期', unit: 'Unit 5' },
      { id: 'n7b_u5_5', word: 'river', phonetic: '/ˈrɪvə(r)/', definition: '河流', example: 'Words can’t express the writer’s love for the rivers and lakes.', mastered: false, grade: '7年级', semester: '下学期', unit: 'Unit 5' },
      { id: 'n7b_u5_6', word: 'lake', phonetic: '/leɪk/', definition: '湖泊', example: 'There are many lakes on the plateau.', mastered: false, grade: '7年级', semester: '下学期', unit: 'Unit 5' },
      { id: 'n7b_u5_7', word: 'grassland', phonetic: '/ˈɡrɑːslænd/', definition: '草原', example: 'Our grasslands, forests and fields are all green.', mastered: false, grade: '7年级', semester: '下学期', unit: 'Unit 5' },
      { id: 'n7b_u5_8', word: 'plateau', phonetic: '/ˈplætəʊ/', definition: '高原', example: 'The writer’s hometown is on the Qinghai-Tibet Plateau.', mastered: false, grade: '7年级', semester: '下学期', unit: 'Unit 5' },
    ],
    sentences: [
      { id: 'n7b_s5_1', text: 'My hometown is on the Qinghai-Tibet Plateau.', translation: '我的家乡在青藏高原。', grade: '7年级', semester: '下学期', unit: 'Unit 5' },
      { id: 'n7b_s5_2', text: 'This area is also full of the most amazing colours in nature.', translation: '这片区域也充满了大自然中最迷人的色彩。', grade: '7年级', semester: '下学期', unit: 'Unit 5' },
      { id: 'n7b_s5_3', text: 'The clouds are clean and soft, like our white sheep.', translation: '云朵洁白柔软，就像我们的白羊一样。', grade: '7年级', semester: '下学期', unit: 'Unit 5' },
      { id: 'n7b_s5_4', text: 'There are a hundred kinds of blue in the water.', translation: '水中有上百种不同的蓝色。', grade: '7年级', semester: '下学期', unit: 'Unit 5' },
      { id: 'n7b_s5_5', text: 'I am proud to say I’m from one of the most beautiful places in the world.', translation: '我很自豪地说，我来自世界上最美的地方之一。', grade: '7年级', semester: '下学期', unit: 'Unit 5' },
    ],
  },
  {
    unitCode: 'Unit 6',
    title: 'Hitting the road',
    passage:
      'This unit brings together travel, local culture and discovery. In “Hot and cool”, the writer arrives in Chengdu, tries very hot Sichuan hot pot and then visits the Sanxingdui Museum. The contrast between hot food and cool museum exploration gives the passage its title. Students practise travel expressions, learn the structure as ... as, listen to a travel vlogger, and then write a short introduction to another great traveller.',
    summary: '主题是 travel；语法点是 as ... as；课文围绕成都旅行、美食体验和三星堆博物馆参观展开；单元产出是 travel plan。',
    phrases: [
      { phrase: 'hit the road', meaning: '启程上路', example: 'It is time to hit the road.' },
      { phrase: 'travel vlogger', meaning: '旅行视频博主', example: 'A travel vlogger and his vlog is one section title.' },
      { phrase: 'at last', meaning: '终于；最后', example: 'At last, I arrived in Chengdu.' },
      { phrase: 'do as the Chinese do', meaning: '入乡随俗', example: 'When in China, do as the Chinese do.' },
      { phrase: 'look forward to', meaning: '期待', example: 'I’m really looking forward to the rest of my trip around China.' },
    ],
    patterns: [
      { text: 'A travel vlogger and his vlog', translation: '一位旅行视频博主和他的视频日志', kind: 'sentence' as const },
      { text: 'When in China, do as the Chinese do!', translation: '到了中国，就要入乡随俗！', kind: 'sentence' as const },
      { text: 'My first day in China was full of fun.', translation: '我在中国的第一天充满了乐趣。', kind: 'sentence' as const },
      { text: 'Write a short introduction to another great traveller.', translation: '写一段关于另一位伟大旅行者的简短介绍。', kind: 'pattern' as const },
    ],
    vocab: [
      { id: 'n7b_u6_1', word: 'museum', phonetic: '/mjuˈziːəm/', definition: '博物馆', example: 'They went to the new Sanxingdui Museum after lunch.', mastered: false, grade: '7年级', semester: '下学期', unit: 'Unit 6' },
      { id: 'n7b_u6_2', word: 'hot pot', phonetic: '/ˈhɒt pɒt/', definition: '火锅', example: 'The writer couldn’t wait to try Sichuan hot pot.', mastered: false, grade: '7年级', semester: '下学期', unit: 'Unit 6' },
      { id: 'n7b_u6_3', word: 'airport', phonetic: '/ˈeəpɔːt/', definition: '机场', example: 'Haoyu took the writer to a restaurant right from the airport.', mastered: false, grade: '7年级', semester: '下学期', unit: 'Unit 6' },
      { id: 'n7b_u6_4', word: 'mouthful', phonetic: '/ˈmaʊθfʊl/', definition: '一口（食物）', example: 'I carefully took a small mouthful.', mastered: false, grade: '7年级', semester: '下学期', unit: 'Unit 6' },
      { id: 'n7b_u6_5', word: 'carefully', phonetic: '/ˈkeəfəli/', definition: '仔细地；小心地', example: 'The writer carefully took a small mouthful.', mastered: false, grade: '7年级', semester: '下学期', unit: 'Unit 6' },
      { id: 'n7b_u6_6', word: 'expect', phonetic: '/ɪkˈspekt/', definition: '预料；期待', example: 'The food was much hotter than I expected.', mastered: false, grade: '7年级', semester: '下学期', unit: 'Unit 6' },
      { id: 'n7b_u6_7', word: 'trip', phonetic: '/trɪp/', definition: '旅行', example: 'The writer is looking forward to the rest of the trip around China.', mastered: false, grade: '7年级', semester: '下学期', unit: 'Unit 6' },
      { id: 'n7b_u6_8', word: 'exciting', phonetic: '/ɪkˈsaɪtɪŋ/', definition: '令人兴奋的', example: 'They went to an exciting place after lunch.', mastered: false, grade: '7年级', semester: '下学期', unit: 'Unit 6' },
    ],
    sentences: [
      { id: 'n7b_s6_1', text: 'At last, I arrived in Chengdu.', translation: '终于，我到达了成都。', grade: '7年级', semester: '下学期', unit: 'Unit 6' },
      { id: 'n7b_s6_2', text: 'The food was much hotter than I expected.', translation: '食物比我预想的要辣得多。', grade: '7年级', semester: '下学期', unit: 'Unit 6' },
      { id: 'n7b_s6_3', text: 'When in China, do as the Chinese do!', translation: '到了中国，就要入乡随俗！', grade: '7年级', semester: '下学期', unit: 'Unit 6' },
      { id: 'n7b_s6_4', text: 'After lunch, things went from really hot to totally cool.', translation: '午饭后，事情从火热一下子变得非常清凉。', grade: '7年级', semester: '下学期', unit: 'Unit 6' },
      { id: 'n7b_s6_5', text: 'I’m really looking forward to the rest of my trip around China!', translation: '我真的非常期待接下来在中国的旅程！', grade: '7年级', semester: '下学期', unit: 'Unit 6' },
    ],
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
  description: '基于你提供的完整 2024 版七年级下册 PDF 解析而来，已按目录页与各单元起始正文页整理 6 个单元的课文摘要、核心词汇、固定搭配与重点句型，可直接用于教材选择、跟读、听写与口语学习。',
  unitMeta: junior2024_7LowerUnitMeta,
});

export const TEXTBOOK_SAMPLES: TextbookSample[] = [FLTRP_JUNIOR_7A_SAMPLE, FLTRP_JUNIOR_7B_SAMPLE];
