import type { StudyState } from './types';

const DAY_MS = 24 * 60 * 60 * 1000;
/** Mistake reasons are stored as English keys; the report shows Chinese. */
const reasonLabels: Record<string, string> = {
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
  word_order: '语序错误',
  sentence_judgement: '句子判断',
};

export interface WeeklyWeakPoint {
  label: string;
  count: number;
}

export interface WeeklyWeakWord {
  word: string;
  count: number;
}

export interface WeeklyStats {
  rangeLabel: string;
  checkinDays: number;
  activeDays: number;
  tasksDone: number;
  newMistakes: number;
  pendingMistakes: number;
  resolvedMistakes: number;
  topWeakPoints: WeeklyWeakPoint[];
  dictationRounds: number;
  dictationAccuracy: number | null;
  pronunciationCount: number;
  pronunciationAverage: number | null;
  weakestWords: WeeklyWeakWord[];
  latestChallenge: { score: number; total: number; completedAt: string } | null;
}

const parseTime = (value: string | undefined | null) => {
  if (!value) return Number.NaN;
  const normalised = value.includes('T') ? value : `${value.replace(' ', 'T')}Z`;
  return new Date(normalised).getTime();
};

const formatDay = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

/**
 * Builds the numbers behind a parent-facing weekly report. "This week" means the
 * last seven calendar days (including today) in the user's local timezone.
 */
export const buildWeeklyStats = (state: StudyState, now: Date = new Date(), days = 7): WeeklyStats => {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (days - 1));
  const startKey = formatDay(start);
  const todayKey = formatDay(now);
  const inRange = (value: string | undefined) => {
    if (!value) return false;
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value >= startKey && value <= todayKey;
    const time = parseTime(value);
    return Number.isFinite(time) && time >= start.getTime() && time <= now.getTime() + DAY_MS;
  };

  const weekCheckins = state.dailyCheckins.filter((item) => inRange(item.date));
  const weekMistakes = state.mistakes.filter((item) => inRange(item.createdAt));
  const weekResolved = state.mistakes.filter((item) => item.resolved && inRange(item.lastRetriedAt));
  const weekDictation = state.dictationAttempts.filter((item) => inRange(item.completedAt));
  const weekPronunciation = state.pronunciationAssessments.filter((item) => inRange(item.createdAt));
  const weekChallenges = state.challengeAttempts.filter((item) => inRange(item.completedAt));

  const reasonCounts = new Map<string, number>();
  weekMistakes.forEach((item) => {
    const label = item.reason ? reasonLabels[item.reason] || item.reason : '未分类';
    reasonCounts.set(label, (reasonCounts.get(label) || 0) + 1);
  });

  const wordCounts = new Map<string, number>();
  weekPronunciation.forEach((item) => {
    (item.weakWords || []).forEach((word) => {
      const key = String(word).trim();
      if (key) wordCounts.set(key, (wordCounts.get(key) || 0) + 1);
    });
  });

  const dictationTotal = weekDictation.reduce((sum, item) => sum + (item.total || 0), 0);
  const dictationCorrect = weekDictation.reduce((sum, item) => sum + (item.correct || 0), 0);

  const pronunciationScores = weekPronunciation.map((item) => item.pronunciationScore).filter((score) => Number.isFinite(score));
  const latestChallenge = weekChallenges
    .slice()
    .sort((a, b) => parseTime(b.completedAt) - parseTime(a.completedAt))[0];

  return {
    rangeLabel: `${startKey} ~ ${todayKey}`,
    checkinDays: weekCheckins.filter((item) => item.checkedIn).length,
    activeDays: weekCheckins.filter((item) => item.completedTaskIds.length > 0 || item.recommendationIds.length > 0).length,
    tasksDone: weekCheckins.reduce((sum, item) => sum + item.completedTaskIds.length, 0),
    newMistakes: weekMistakes.length,
    pendingMistakes: state.mistakes.filter((item) => !item.resolved && inRange(item.createdAt)).length,
    resolvedMistakes: weekResolved.length,
    topWeakPoints: [...reasonCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([label, count]) => ({ label, count })),
    dictationRounds: weekDictation.length,
    dictationAccuracy: dictationTotal > 0 ? Math.round((dictationCorrect / dictationTotal) * 100) : null,
    pronunciationCount: weekPronunciation.length,
    pronunciationAverage: pronunciationScores.length > 0
      ? Math.round(pronunciationScores.reduce((sum, score) => sum + score, 0) / pronunciationScores.length)
      : null,
    weakestWords: [...wordCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([word, count]) => ({ word, count })),
    latestChallenge: latestChallenge
      ? { score: latestChallenge.score, total: latestChallenge.total, completedAt: latestChallenge.completedAt }
      : null,
  };
};

/** Plain-text version for WeChat / SMS, which is how most parents actually get it. */
export const buildWeeklyReportText = (input: {
  studentName: string;
  grade: string;
  semester: string;
  textbookTitle: string;
  stats: WeeklyStats;
  homework: Array<{ title: string; completed: boolean; dueAt: string | null }>;
  feedback: string[];
  suggestion: string;
}) => {
  const { studentName, grade, semester, textbookTitle, stats, homework, feedback, suggestion } = input;
  const lines: string[] = [];
  lines.push(`${studentName} 本周学习报告（${stats.rangeLabel}）`);
  lines.push(`${grade} ${semester} · ${textbookTitle}`);
  lines.push('');
  lines.push(`打卡 ${stats.checkinDays} 天 · 完成任务 ${stats.tasksDone} 个 · 练习天数 ${stats.activeDays} 天`);
  if (stats.dictationAccuracy !== null) {
    lines.push(`听写 ${stats.dictationRounds} 轮，正确率 ${stats.dictationAccuracy}%`);
  }
  if (stats.pronunciationAverage !== null) {
    lines.push(`发音评测 ${stats.pronunciationCount} 次，平均 ${stats.pronunciationAverage} 分`);
  }
  if (stats.latestChallenge) {
    lines.push(`最近一次闯关 ${stats.latestChallenge.score}/${stats.latestChallenge.total}`);
  }
  lines.push('');
  const mistakes = `本周新增错题 ${stats.newMistakes} 条，待复盘 ${stats.pendingMistakes} 条，已销账 ${stats.resolvedMistakes} 条`;
  lines.push(mistakes);
  if (stats.topWeakPoints.length > 0) {
    lines.push(`主要薄弱点：${stats.topWeakPoints.map((item) => `${item.label}(${item.count})`).join('、')}`);
  }
  if (stats.weakestWords.length > 0) {
    lines.push(`需重点复习的单词：${stats.weakestWords.map((item) => item.word).join('、')}`);
  }
  if (homework.length > 0) {
    lines.push('');
    lines.push('作业：');
    homework.forEach((item) => {
      lines.push(`- ${item.title}：${item.completed ? '已完成' : '未完成'}${item.dueAt ? `（截止 ${item.dueAt}）` : ''}`);
    });
  }
  if (feedback.length > 0) {
    lines.push('');
    lines.push(`老师评语：${feedback[0]}`);
  }
  if (suggestion) {
    lines.push('');
    lines.push(`下一步建议：${suggestion}`);
  }
  return lines.join('\n');
};
