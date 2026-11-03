import type { StudyState } from './types';

const DAY_MS = 24 * 60 * 60 * 1000;
export const STAGE_KEYS = ['preview', 'reading', 'dictation', 'speaking'] as const;

export const toDayKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

const parseTime = (value: string | undefined | null) => {
  if (!value) return Number.NaN;
  const normalised = value.includes('T') ? value : `${value.replace(' ', 'T')}Z`;
  return new Date(normalised).getTime();
};

const inLastDays = (value: string | undefined, days: number, now: Date) => {
  if (!value) return false;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (days - 1));
    return value >= toDayKey(start) && value <= toDayKey(now);
  }
  const time = parseTime(value);
  return Number.isFinite(time) && time >= now.getTime() - days * DAY_MS && time <= now.getTime() + DAY_MS;
};

export interface GrowthBadge {
  id: string;
  title: string;
  description: string;
  icon: string;
  earned: boolean;
  progress: string;
}

/**
 * Achievements are derived from the learning snapshot rather than stored, so a
 * badge is always consistent with the data the student can see.
 */
export const buildGrowthBadges = (state: StudyState, streak: number): GrowthBadge[] => {
  const unitStages = new Map<string, Set<string>>();
  state.completedTaskIds.forEach((taskId) => {
    const index = taskId.lastIndexOf(':');
    if (index <= 0) return;
    const unitId = taskId.slice(0, index);
    const stage = taskId.slice(index + 1);
    if (!STAGE_KEYS.includes(stage as (typeof STAGE_KEYS)[number])) return;
    if (!unitStages.has(unitId)) unitStages.set(unitId, new Set());
    unitStages.get(unitId)!.add(stage);
  });
  const completedUnits = [...unitStages.values()].filter((stages) => stages.size >= STAGE_KEYS.length).length;

  const checkedDays = state.dailyCheckins.filter((item) => item.checkedIn).length;
  const dictationPerfect = state.dictationAttempts.some((item) => item.total > 0 && item.correct === item.total);
  const challengePassed = state.challengeAttempts.some((item) => item.total > 0 && item.score === item.total);
  const passageRead = state.pronunciationAssessments.some((item) => item.sentenceId.endsWith('-passage'));
  const latestPronunciation = state.pronunciationAssessments
    .slice()
    .sort((a, b) => parseTime(b.createdAt) - parseTime(a.createdAt))[0];
  const resolvedCount = state.mistakes.filter((item) => item.resolved).length;

  return [
    {
      id: 'first_checkin',
      title: '启程',
      description: '完成第一次打卡',
      icon: '🌱',
      earned: checkedDays >= 1,
      progress: checkedDays >= 1 ? '已获得' : '完成 1 次打卡',
    },
    {
      id: 'streak_3',
      title: '坚持三天',
      description: '连续打卡 3 天',
      icon: '🔥',
      earned: streak >= 3,
      progress: `${Math.min(streak, 3)}/3 天`,
    },
    {
      id: 'streak_7',
      title: '一周不断',
      description: '连续打卡 7 天',
      icon: '🏅',
      earned: streak >= 7,
      progress: `${Math.min(streak, 7)}/7 天`,
    },
    {
      id: 'unit_complete',
      title: '单元通关',
      description: '完成一个单元的全部 4 个课时',
      icon: '🎯',
      earned: completedUnits >= 1,
      progress: `${completedUnits} 个单元`,
    },
    {
      id: 'dictation_perfect',
      title: '听写满分',
      description: '某一轮听写全部正确',
      icon: '✍️',
      earned: dictationPerfect,
      progress: dictationPerfect ? '已获得' : '听写全对一次',
    },
    {
      id: 'challenge_pass',
      title: '闯关达人',
      description: '一次闯关全部通过',
      icon: '⚡',
      earned: challengePassed,
      progress: challengePassed ? '已获得' : '闯关全对一次',
    },
    {
      id: 'passage_reading',
      title: '整篇朗读',
      description: '完成一次整篇课文朗读评测',
      icon: '🎙️',
      earned: passageRead,
      progress: passageRead ? '已获得' : '读完整篇课文',
    },
    {
      id: 'weak_words_clear',
      title: '发音清零',
      description: '最近一次发音评测没有弱词',
      icon: '🔊',
      earned: Boolean(latestPronunciation && latestPronunciation.weakWords.length === 0),
      progress: latestPronunciation
        ? latestPronunciation.weakWords.length === 0
          ? '已获得'
          : `还有 ${latestPronunciation.weakWords.length} 个弱词`
        : '先做一次发音评测',
    },
    {
      id: 'mistake_cleaner',
      title: '错题清道夫',
      description: '销账 10 条错题',
      icon: '🧹',
      earned: resolvedCount >= 10,
      progress: `${Math.min(resolvedCount, 10)}/10 条`,
    },
    {
      id: 'vocab_master',
      title: '词汇达人',
      description: '掌握 20 个核心词汇',
      icon: '📚',
      earned: state.masteredWordIds.length >= 20,
      progress: `${Math.min(state.masteredWordIds.length, 20)}/20 词`,
    },
  ];
};

export interface WeeklyGoal {
  id: string;
  label: string;
  current: number;
  target: number;
  done: boolean;
}

/** Weekly targets shown next to the badge wall; deliberately small and achievable. */
export const buildWeeklyGoals = (state: StudyState, now: Date = new Date()): WeeklyGoal[] => {
  const weekCheckins = state.dailyCheckins.filter((item) => inLastDays(item.date, 7, now));
  const checkinDays = weekCheckins.filter((item) => item.checkedIn).length;
  const tasks = weekCheckins.reduce((sum, item) => sum + item.completedTaskIds.length, 0);
  const resolved = state.mistakes.filter((item) => item.resolved && inLastDays(item.lastRetriedAt, 7, now)).length;
  const pronunciation = state.pronunciationAssessments.filter((item) => inLastDays(item.createdAt, 7, now)).length;

  return [
    { id: 'checkins', label: '打卡', current: checkinDays, target: 5, done: checkinDays >= 5 },
    { id: 'tasks', label: '完成任务', current: tasks, target: 6, done: tasks >= 6 },
    { id: 'resolved', label: '错题销账', current: resolved, target: 3, done: resolved >= 3 },
    { id: 'pronunciation', label: '发音评测', current: pronunciation, target: 3, done: pronunciation >= 3 },
  ];
};

export interface HeatmapCell {
  date: string;
  label: string;
  checkedIn: boolean;
  tasks: number;
  isToday: boolean;
}

/**
 * 12 weeks of check-ins laid out like a GitHub contribution graph: one column
 * per week, Monday first. Future days in the current week are `null`.
 */
export const buildCheckinHeatmap = (state: StudyState, weeks = 12, now: Date = new Date()): Array<Array<HeatmapCell | null>> => {
  const byDate = new Map(state.dailyCheckins.map((item) => [item.date, item]));
  const todayKey = toDayKey(now);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekday = (today.getDay() + 6) % 7; // Monday = 0
  const start = new Date(today.getTime() - (weekday + (weeks - 1) * 7) * DAY_MS);

  const columns: Array<Array<HeatmapCell | null>> = [];
  for (let week = 0; week < weeks; week += 1) {
    const column: Array<HeatmapCell | null> = [];
    for (let day = 0; day < 7; day += 1) {
      const date = new Date(start.getTime() + (week * 7 + day) * DAY_MS);
      const key = toDayKey(date);
      if (key > todayKey) {
        column.push(null);
        continue;
      }
      const record = byDate.get(key);
      column.push({
        date: key,
        label: `${date.getMonth() + 1}/${date.getDate()}`,
        checkedIn: Boolean(record?.checkedIn),
        tasks: record?.completedTaskIds.length || 0,
        isToday: key === todayKey,
      });
    }
    columns.push(column);
  }
  return columns;
};

export interface SevenDayPoint {
  date: string;
  label: string;
  tasks: number;
  pronunciation: number | null;
}

export const buildSevenDayProgress = (state: StudyState, now: Date = new Date()): SevenDayPoint[] => {
  return Array.from({ length: 7 }).map((_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (6 - index));
    const key = toDayKey(date);
    const record = state.dailyCheckins.find((item) => item.date === key);
    const scores = state.pronunciationAssessments
      .filter((item) => {
        const time = parseTime(item.createdAt);
        return Number.isFinite(time) && toDayKey(new Date(time)) === key;
      })
      .map((item) => item.pronunciationScore)
      .filter((score) => Number.isFinite(score));
    return {
      date: key,
      label: `${date.getMonth() + 1}/${date.getDate()}`,
      tasks: record?.completedTaskIds.length || 0,
      pronunciation: scores.length > 0 ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length) : null,
    };
  });
};
