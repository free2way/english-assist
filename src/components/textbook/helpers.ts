import type { LessonStageKey, StudyState, UnitBundle } from './types';

export const createTaskId = (unitId: string, stage: LessonStageKey) => `${unitId}:${stage}`;

export const normalizeGrammarAnswer = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[.,!?;:]/g, '')
    .replace(/\s+/g, ' ');

export const getStageLabel = (stage: LessonStageKey) =>
  stage === 'preview' ? '课时1 词汇预习' :
  stage === 'reading' ? '课时2 重点句跟读' :
  stage === 'dictation' ? '课时3 听写巩固' :
  '课时4 口语表达';

export const getLessonOutcomeLabel = (unit: UnitBundle | null, stage: LessonStageKey, studyState: StudyState) => {
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

export const calculateTextSimilarity = (input: string, target: string) => {
  const normalizedInput = input.trim().toLowerCase().replace(/[.,!?;:]/g, '');
  const normalizedTarget = target.trim().toLowerCase().replace(/[.,!?;:]/g, '');

  if (!normalizedInput || !normalizedTarget) return 0;
  if (normalizedInput === normalizedTarget) return 100;

  const inputWords = normalizedInput.split(/\s+/);
  const targetWords = normalizedTarget.split(/\s+/);
  const matched = targetWords.filter((word) => inputWords.includes(word)).length;
  return Math.max(0, Math.min(100, Math.round((matched / targetWords.length) * 100)));
};

export const getPronunciationHint = (score: number) => {
  if (score >= 85) return '发音很接近目标句，可以继续关注重音和语调，让表达更自然。';
  if (score >= 70) return '整体发音基本准确，建议再把连读和停顿处理得更顺一些。';
  if (score >= 55) return '有几个关键词读得还不够稳，先逐词模仿，再完整读一遍会更好。';
  return '这句还需要重点回练，建议先听原句、看识别结果，再分短语重复跟读。';
};
