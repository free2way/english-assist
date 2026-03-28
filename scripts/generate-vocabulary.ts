/**
 * 使用 AI 生成外研版英语教材词汇和句子数据
 * 运行: npx tsx scripts/generate-vocabulary.ts
 */

import { GoogleGenAI } from "@google/genai";
import * as fs from 'fs';
import * as path from 'path';

const GRADES = ['7年级', '8年级', '9年级', '10年级', '11年级', '12年级'];
const SEMESTERS = ['上学期', '下学期'];
const UNITS = ['Unit 1', 'Unit 2', 'Unit 3', 'Unit 4', 'Unit 5', 'Unit 6'];

// 从环境变量获取 API Key
const API_KEY = process.env.GEMINI_API_KEY || '';

if (!API_KEY) {
  console.error('请设置 GEMINI_API_KEY 环境变量');
  process.exit(1);
}

const ai = new GoogleGenAI({ apiKey: API_KEY });

interface VocabWord {
  id: string;
  word: string;
  phonetic: string;
  definition: string;
  example: string;
  mastered: boolean;
  grade: string;
  semester: string;
  unit: string;
}

interface Sentence {
  id: string;
  text: string;
  translation: string;
  grade: string;
  semester: string;
  unit: string;
}

async function generateVocabularyForUnit(
  grade: string,
  semester: string,
  unit: string
): Promise<VocabWord[]> {
  const prompt = `请为外研版英语教材生成 ${grade}${semester}${unit} 的词汇表。

要求：
1. 生成 15-20 个适合该年级难度的单词
2. 每个单词包含：英文单词、音标、中文释义、英文例句
3. 单词应符合外研版教材的教学大纲和主题
4. 返回 JSON 格式数组

示例格式：
[
  {
    "word": "example",
    "phonetic": "/ɪɡˈzæmpl/",
    "definition": "例子，榜样",
    "example": "This is a good example."
  }
]

请只返回 JSON 数组，不要包含其他说明文字。`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
    });

    const text = response.text || '';
    // 提取 JSON 部分
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const words = JSON.parse(jsonMatch[0]);
      return words.map((w: any, idx: number) => ({
        id: `v${grade.charAt(0)}${semester === '上学期' ? 'u' : 'd'}${unit.split(' ')[1]}_${idx + 1}`,
        word: w.word,
        phonetic: w.phonetic,
        definition: w.definition,
        example: w.example,
        mastered: false,
        grade,
        semester,
        unit,
      }));
    }
    return [];
  } catch (error) {
    console.error(`生成 ${grade}${semester}${unit} 词汇失败:`, error);
    return [];
  }
}

async function generateSentencesForUnit(
  grade: string,
  semester: string,
  unit: string
): Promise<Sentence[]> {
  const prompt = `请为外研版英语教材生成 ${grade}${semester}${unit} 的重点句子和谚语。

要求：
1. 生成 5-8 个重点句子或谚语
2. 每个句子包含：英文句子、中文翻译
3. 内容应符合该年级的学习难度
4. 返回 JSON 格式数组

示例格式：
[
  {
    "text": "Practice makes perfect.",
    "translation": "熟能生巧。"
  }
]

请只返回 JSON 数组，不要包含其他说明文字。`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
    });

    const text = response.text || '';
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const sentences = JSON.parse(jsonMatch[0]);
      return sentences.map((s: any, idx: number) => ({
        id: `s${grade.charAt(0)}${semester === '上学期' ? 'u' : 'd'}${unit.split(' ')[1]}_${idx + 1}`,
        text: s.text,
        translation: s.translation,
        grade,
        semester,
        unit,
      }));
    }
    return [];
  } catch (error) {
    console.error(`生成 ${grade}${semester}${unit} 句子失败:`, error);
    return [];
  }
}

async function main() {
  const allVocabulary: VocabWord[] = [];
  const allSentences: Sentence[] = [];

  console.log('开始生成外研版英语教材数据...\n');

  for (const grade of GRADES) {
    for (const semester of SEMESTERS) {
      for (const unit of UNITS) {
        console.log(`正在生成: ${grade} ${semester} ${unit}`);
        
        // 生成词汇
        const vocab = await generateVocabularyForUnit(grade, semester, unit);
        allVocabulary.push(...vocab);
        console.log(`  ✓ 生成 ${vocab.length} 个单词`);
        
        // 生成句子
        const sentences = await generateSentencesForUnit(grade, semester, unit);
        allSentences.push(...sentences);
        console.log(`  ✓ 生成 ${sentences.length} 个句子`);
        
        // 添加延迟避免请求过快
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  }

  // 保存数据文件
  const dataDir = path.join(__dirname, '..', 'src', 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  // 生成 TypeScript 数据文件
  const vocabFile = `// 外研版英语教材词汇表 (AI生成)
export const FLTRP_VOCAB = ${JSON.stringify(allVocabulary, null, 2)};
`;

  const sentenceFile = `// 外研版英语教材句子表 (AI生成)
export const FLTRP_SENTENCES = ${JSON.stringify(allSentences, null, 2)};
`;

  fs.writeFileSync(path.join(dataDir, 'vocabulary.ts'), vocabFile);
  fs.writeFileSync(path.join(dataDir, 'sentences.ts'), sentenceFile);

  console.log(`\n✅ 数据生成完成!`);
  console.log(`   - 词汇总数: ${allVocabulary.length}`);
  console.log(`   - 句子总数: ${allSentences.length}`);
  console.log(`\n文件已保存到 src/data/ 目录`);
}

main().catch(console.error);
