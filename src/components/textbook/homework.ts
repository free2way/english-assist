import type { LessonStageKey } from './types';

/** One assignment as the student sees it (server computes `tasks` from their study state). */
export interface StudentHomeworkItem {
  id: string;
  classId: string;
  className: string;
  textbookId: string;
  unitId: string;
  title: string;
  taskKeys: string[];
  dueAt: string | null;
  createdAt: string;
  tasks: Record<string, boolean>;
  completed: boolean;
}

export const HOMEWORK_TASK_OPTIONS: Array<{ key: LessonStageKey; label: string }> = [
  { key: 'preview', label: '词汇预习' },
  { key: 'reading', label: '重点句跟读' },
  { key: 'dictation', label: '听写巩固' },
  { key: 'speaking', label: '口语表达' },
];

export const getHomeworkTaskLabel = (key: string) =>
  HOMEWORK_TASK_OPTIONS.find((item) => item.key === key)?.label || key;

export const isHomeworkTaskKey = (key: string): key is LessonStageKey =>
  HOMEWORK_TASK_OPTIONS.some((item) => item.key === key);

/** The task the "去完成" button should open: first unfinished one, else the first. */
export const getNextHomeworkTask = (item: StudentHomeworkItem): LessonStageKey | null => {
  const undone = item.taskKeys.find((key) => !item.tasks[key] && isHomeworkTaskKey(key));
  const fallback = item.taskKeys.find((key) => isHomeworkTaskKey(key));
  return (undone || fallback) as LessonStageKey | undefined || null;
};

export const isHomeworkOverdue = (item: StudentHomeworkItem) => {
  if (!item.dueAt || item.completed) return false;
  const due = new Date(`${item.dueAt}T23:59:59`);
  return Number.isFinite(due.getTime()) && due.getTime() < Date.now();
};

/** A note a teacher left for a student (teacher view carries the names). */
export interface TeacherFeedbackNote {
  id: string;
  studentId: string;
  studentName: string;
  classId: string | null;
  className: string | null;
  assignmentId: string | null;
  content: string;
  createdAt: string;
}

/** A note as its own student sees it. */
export interface StudentFeedbackNote {
  id: string;
  classId: string | null;
  className: string | null;
  assignmentId: string | null;
  content: string;
  createdAt: string;
}

/**
 * `created_at` comes back from SQLite as "YYYY-MM-DD HH:MM:SS" (UTC) while
 * `toISOString()` values carry a T/Z - normalise both before formatting.
 */
export const formatFeedbackTime = (value: string) => {
  const normalised = value.includes('T') ? value : `${value.replace(' ', 'T')}Z`;
  const date = new Date(normalised);
  if (!Number.isFinite(date.getTime())) return value;
  return date.toLocaleString('zh-CN', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
};
