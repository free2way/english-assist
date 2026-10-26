import 'dotenv/config';
import { createClient, type Client } from '@libsql/client';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { TEXTBOOK_SAMPLES, type TextbookSample } from './textbook-samples.js';

export interface AuthUser {
  id: string;
  username: string;
  grade: string;
  semester: string;
  school: string;
  role: 'admin' | 'user';
  selectedTextbookId?: string;
}

export interface SessionInfo {
  token: string;
  user: AuthUser;
  expiresAt: string;
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

export interface TextbookLesson {
  id: string;
  stageKey: 'preview' | 'reading' | 'dictation' | 'speaking';
  title: string;
  objective: string;
  sortOrder: number;
}

export interface TextbookPhrase {
  id: string;
  phrase: string;
  meaning: string;
  example: string;
  sortOrder: number;
}

export interface TextbookPattern {
  id: string;
  text: string;
  translation: string;
  kind: 'sentence' | 'pattern';
  sortOrder: number;
}

export interface TextbookVocabItem {
  id: string;
  word: string;
  phonetic: string;
  definition: string;
  example: string;
  sortOrder: number;
}

export interface TextbookSentenceItem {
  id: string;
  text: string;
  translation: string;
  sortOrder: number;
}

export interface TextbookUnit {
  id: string;
  unitCode: string;
  title: string;
  summary: string;
  passage: string;
  sortOrder: number;
  lessons: TextbookLesson[];
  vocab: TextbookVocabItem[];
  sentences: TextbookSentenceItem[];
  phrases: TextbookPhrase[];
  patterns: TextbookPattern[];
}

export interface TextbookContent extends TextbookSummary {
  units: TextbookUnit[];
}

export interface AIServiceConfig {
  model: string;
  baseURL: string;
  apiKey?: string;
  hasApiKey: boolean;
  updatedAt?: string;
}

interface DbUserRow extends AuthUser {
  selected_textbook_id?: string | null;
  password_hash: string;
  password_salt: string;
  created_at: string;
}

const DB_DIR = path.resolve(process.cwd(), 'data');
const DB_PATH = path.join(DB_DIR, 'app.db');
const DEFAULT_LOCAL_URL = `file:${DB_PATH}`;
const TURSO_DATABASE_URL = process.env.TURSO_DATABASE_URL?.trim();
const TURSO_AUTH_TOKEN = process.env.TURSO_AUTH_TOKEN?.trim();
const IS_VERCEL =
  process.env.VERCEL === '1' ||
  process.env.VERCEL === 'true' ||
  Boolean(process.env.VERCEL_ENV) ||
  Boolean(process.env.NOW_REGION);
const ADMIN_USERNAME = 'admin';
// Deployments can override the seeded admin password via ADMIN_INITIAL_PASSWORD.
// The hard-coded default only exists so a fresh local checkout still boots.
const ADMIN_INITIAL_PASSWORD = process.env.ADMIN_INITIAL_PASSWORD?.trim();
const ADMIN_PASSWORD = ADMIN_INITIAL_PASSWORD || 'admin1234';
const USING_DEFAULT_ADMIN_PASSWORD = !ADMIN_INITIAL_PASSWORD;
const DEFAULT_SESSION_HOURS = 24 * 7;
const ALLOWED_SESSION_HOURS = new Set([12, 24 * 7, 24 * 30]);
const DEFAULT_AI_MODEL = process.env.AI_MODEL?.trim() || 'gemini-2.5-flash';
const DEFAULT_AI_BASE_URL = process.env.AI_BASE_URL?.trim() || 'https://generativelanguage.googleapis.com/v1beta/openai';
const DEFAULT_AI_API_KEY = process.env.GEMINI_API_KEY?.trim() || process.env.AI_API_KEY?.trim() || '';

let client: Client | null = null;

const schemaStatements = [
  `
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      password_salt TEXT NOT NULL,
      grade TEXT NOT NULL,
      semester TEXT NOT NULL,
      school TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('admin', 'user')),
      selected_textbook_id TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `,
  `
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      token_hash TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `,
  `CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at)`,
  `
    CREATE TABLE IF NOT EXISTS textbooks (
      id TEXT PRIMARY KEY,
      publisher TEXT NOT NULL,
      series TEXT NOT NULL,
      title TEXT NOT NULL,
      stage TEXT NOT NULL,
      grade TEXT NOT NULL,
      semester TEXT NOT NULL,
      volume TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      source_type TEXT NOT NULL DEFAULT 'manual',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `,
  `
    CREATE TABLE IF NOT EXISTS textbook_units (
      id TEXT PRIMARY KEY,
      textbook_id TEXT NOT NULL,
      unit_code TEXT NOT NULL,
      title TEXT NOT NULL,
      summary TEXT NOT NULL DEFAULT '',
      passage TEXT NOT NULL DEFAULT '',
      sort_order INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(textbook_id) REFERENCES textbooks(id) ON DELETE CASCADE
    )
  `,
  `
    CREATE TABLE IF NOT EXISTS textbook_lessons (
      id TEXT PRIMARY KEY,
      unit_id TEXT NOT NULL,
      stage_key TEXT NOT NULL,
      title TEXT NOT NULL,
      objective TEXT NOT NULL DEFAULT '',
      sort_order INTEGER NOT NULL,
      FOREIGN KEY(unit_id) REFERENCES textbook_units(id) ON DELETE CASCADE
    )
  `,
  `
    CREATE TABLE IF NOT EXISTS textbook_vocab_items (
      id TEXT PRIMARY KEY,
      unit_id TEXT NOT NULL,
      word TEXT NOT NULL,
      phonetic TEXT NOT NULL DEFAULT '',
      definition TEXT NOT NULL DEFAULT '',
      example TEXT NOT NULL DEFAULT '',
      sort_order INTEGER NOT NULL,
      FOREIGN KEY(unit_id) REFERENCES textbook_units(id) ON DELETE CASCADE
    )
  `,
  `
    CREATE TABLE IF NOT EXISTS textbook_sentences (
      id TEXT PRIMARY KEY,
      unit_id TEXT NOT NULL,
      text TEXT NOT NULL,
      translation TEXT NOT NULL DEFAULT '',
      sort_order INTEGER NOT NULL,
      FOREIGN KEY(unit_id) REFERENCES textbook_units(id) ON DELETE CASCADE
    )
  `,
  `
    CREATE TABLE IF NOT EXISTS textbook_phrases (
      id TEXT PRIMARY KEY,
      unit_id TEXT NOT NULL,
      phrase TEXT NOT NULL,
      meaning TEXT NOT NULL DEFAULT '',
      example TEXT NOT NULL DEFAULT '',
      sort_order INTEGER NOT NULL,
      FOREIGN KEY(unit_id) REFERENCES textbook_units(id) ON DELETE CASCADE
    )
  `,
  `
    CREATE TABLE IF NOT EXISTS textbook_patterns (
      id TEXT PRIMARY KEY,
      unit_id TEXT NOT NULL,
      text TEXT NOT NULL,
      translation TEXT NOT NULL DEFAULT '',
      kind TEXT NOT NULL DEFAULT 'pattern',
      sort_order INTEGER NOT NULL,
      FOREIGN KEY(unit_id) REFERENCES textbook_units(id) ON DELETE CASCADE
    )
  `,
  `CREATE INDEX IF NOT EXISTS idx_textbook_units_textbook_id ON textbook_units(textbook_id)`,
  `CREATE INDEX IF NOT EXISTS idx_textbook_lessons_unit_id ON textbook_lessons(unit_id)`,
  `CREATE INDEX IF NOT EXISTS idx_textbook_vocab_unit_id ON textbook_vocab_items(unit_id)`,
  `CREATE INDEX IF NOT EXISTS idx_textbook_sentences_unit_id ON textbook_sentences(unit_id)`,
  `CREATE INDEX IF NOT EXISTS idx_textbook_phrases_unit_id ON textbook_phrases(unit_id)`,
  `CREATE INDEX IF NOT EXISTS idx_textbook_patterns_unit_id ON textbook_patterns(unit_id)`,
  // Server-side study state (per user + textbook). The browser keeps a copy for
  // offline use; this table is what makes teacher dashboards and cross-device
  // progress possible.
  `CREATE TABLE IF NOT EXISTS study_states (
      user_id TEXT NOT NULL,
      textbook_id TEXT NOT NULL,
      state_json TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (user_id, textbook_id)
    )`,
  `CREATE INDEX IF NOT EXISTS idx_study_states_textbook_id ON study_states(textbook_id)`,
  // Classes + homework. SQLite does not enforce foreign keys unless PRAGMA
  // foreign_keys is enabled, so deletes in this file cascade by hand.
  `
    CREATE TABLE IF NOT EXISTS classes (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      grade TEXT NOT NULL DEFAULT '',
      semester TEXT NOT NULL DEFAULT '',
      school TEXT NOT NULL DEFAULT '',
      created_by TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `,
  `
    CREATE TABLE IF NOT EXISTS class_members (
      class_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      joined_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (class_id, user_id),
      FOREIGN KEY(class_id) REFERENCES classes(id) ON DELETE CASCADE,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `,
  `CREATE INDEX IF NOT EXISTS idx_class_members_user_id ON class_members(user_id)`,
  `
    CREATE TABLE IF NOT EXISTS homework_assignments (
      id TEXT PRIMARY KEY,
      class_id TEXT NOT NULL,
      textbook_id TEXT NOT NULL,
      unit_id TEXT NOT NULL,
      title TEXT NOT NULL,
      task_keys TEXT NOT NULL,
      due_at TEXT,
      created_by TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(class_id) REFERENCES classes(id) ON DELETE CASCADE
    )
  `,
  `CREATE INDEX IF NOT EXISTS idx_homework_class_id ON homework_assignments(class_id)`,
  `
    CREATE TABLE IF NOT EXISTS feedback_notes (
      id TEXT PRIMARY KEY,
      student_id TEXT NOT NULL,
      class_id TEXT,
      assignment_id TEXT,
      content TEXT NOT NULL,
      created_by TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `,
  `CREATE INDEX IF NOT EXISTS idx_feedback_student ON feedback_notes(student_id)`,
  `CREATE INDEX IF NOT EXISTS idx_feedback_class ON feedback_notes(class_id)`,
];

export interface StudyStateRecord {
  userId: string;
  username: string;
  grade: string;
  semester: string;
  school: string;
  textbookId: string;
  state: unknown;
  updatedAt: string;
}

export const getStudyState = async (userId: string, textbookId: string) => {
  await initializeDatabase();
  const row = await queryFirst<{ state_json: string; updated_at: string }>(
    'SELECT state_json, updated_at FROM study_states WHERE user_id = ? AND textbook_id = ?',
    [userId, textbookId]
  );
  if (!row) return null;
  try {
    return { state: JSON.parse(row.state_json), updatedAt: row.updated_at };
  } catch {
    return null;
  }
};

export const upsertStudyState = async (userId: string, textbookId: string, state: unknown, updatedAt: string) => {
  await initializeDatabase();
  await executeStatement(
    `
      INSERT INTO study_states (user_id, textbook_id, state_json, updated_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(user_id, textbook_id) DO UPDATE SET
        state_json = excluded.state_json,
        updated_at = excluded.updated_at
    `,
    [userId, textbookId, JSON.stringify(state ?? {}), updatedAt]
  );
  return { updatedAt };
};

export const listStudyStates = async (): Promise<StudyStateRecord[]> => {
  await initializeDatabase();
  const rows = await queryAll<{
    user_id: string;
    username: string;
    grade: string;
    semester: string;
    school: string;
    textbook_id: string;
    state_json: string;
    updated_at: string;
  }>(
    `
      SELECT s.user_id, u.username, u.grade, u.semester, u.school, s.textbook_id, s.state_json, s.updated_at
      FROM study_states s
      JOIN users u ON u.id = s.user_id
      WHERE u.role != 'admin'
      ORDER BY s.updated_at DESC
      LIMIT 500
    `
  );

  return rows.map((row) => {
    let state: unknown = null;
    try {
      state = JSON.parse(row.state_json);
    } catch {
      state = null;
    }
    return {
      userId: row.user_id,
      username: row.username,
      grade: row.grade,
      semester: row.semester,
      school: row.school,
      textbookId: row.textbook_id,
      state,
      updatedAt: row.updated_at,
    };
  });
};

// The four stages of a textbook unit the front end can assign as homework.
export const HOMEWORK_TASK_KEYS = ['preview', 'reading', 'dictation', 'speaking'];

export interface ClassMemberSummary {
  userId: string;
  username: string;
  grade: string;
  semester: string;
  school: string;
}

export interface ClassSummary {
  id: string;
  name: string;
  grade: string;
  semester: string;
  school: string;
  createdAt: string;
  members: ClassMemberSummary[];
}

export interface HomeworkAssignmentSummary {
  id: string;
  classId: string;
  className: string;
  textbookId: string;
  unitId: string;
  title: string;
  taskKeys: string[];
  dueAt: string | null;
  createdAt: string;
}

export interface HomeworkStudentProgress {
  userId: string;
  username: string;
  completed: boolean;
  tasks: Record<string, boolean>;
}

export interface HomeworkTeacherView extends HomeworkAssignmentSummary {
  students: HomeworkStudentProgress[];
  completedCount: number;
  totalCount: number;
}

export interface HomeworkStudentView extends HomeworkAssignmentSummary {
  tasks: Record<string, boolean>;
  completed: boolean;
}

/**
 * Pure completion check over a study_states snapshot. A student finished a task
 * when its `completedTaskIds` contains `${unitId}:${taskKey}` - the same id shape
 * `createTaskId` builds in the browser. A missing or unparsable snapshot means
 * "nothing completed" instead of throwing.
 */
export const computeTaskCompletion = (
  stateJson: unknown,
  unitId: string,
  taskKeys: string[]
): Record<string, boolean> => {
  let state: any = stateJson;
  if (typeof stateJson === 'string') {
    try {
      state = JSON.parse(stateJson);
    } catch {
      state = null;
    }
  }

  const completedTaskIds: string[] =
    state && typeof state === 'object' && Array.isArray(state.completedTaskIds)
      ? state.completedTaskIds.map((taskId: unknown) => String(taskId))
      : [];

  const completion: Record<string, boolean> = {};
  for (const taskKey of taskKeys) {
    completion[taskKey] = completedTaskIds.includes(`${unitId}:${taskKey}`);
  }
  return completion;
};

const parseHomeworkTaskKeys = (raw: unknown): string[] => {
  if (typeof raw !== 'string') return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map((taskKey) => String(taskKey)) : [];
  } catch {
    return [];
  }
};

const isAssignmentCompleted = (tasks: Record<string, boolean>, taskKeys: string[]) =>
  taskKeys.length > 0 && taskKeys.every((taskKey) => tasks[taskKey] === true);

const mapClassRow = (row: {
  id: string;
  name: string;
  grade: string;
  semester: string;
  school: string;
  created_at: string;
}) => ({
  id: row.id,
  name: row.name,
  grade: row.grade,
  semester: row.semester,
  school: row.school,
  createdAt: row.created_at,
});

export const createClass = async (input: {
  name: string;
  grade?: string;
  semester?: string;
  school?: string;
  createdBy?: string | null;
}) => {
  await initializeDatabase();
  const id = crypto.randomUUID();
  await executeStatement(
    `
      INSERT INTO classes (id, name, grade, semester, school, created_by)
      VALUES (?, ?, ?, ?, ?, ?)
    `,
    [
      id,
      input.name.trim(),
      (input.grade ?? '').trim(),
      (input.semester ?? '').trim(),
      (input.school ?? '').trim(),
      input.createdBy ?? null,
    ]
  );

  const row = await queryFirst<{
    id: string;
    name: string;
    grade: string;
    semester: string;
    school: string;
    created_at: string;
  }>(
    `
      SELECT id, name, grade, semester, school, created_at
      FROM classes
      WHERE id = ?
    `,
    [id]
  );

  return mapClassRow(row as any);
};

export const listClasses = async (): Promise<ClassSummary[]> => {
  await initializeDatabase();
  const classRows = await queryAll<{
    id: string;
    name: string;
    grade: string;
    semester: string;
    school: string;
    created_at: string;
  }>(
    `
      SELECT id, name, grade, semester, school, created_at
      FROM classes
      ORDER BY created_at DESC, name
    `
  );

  const memberRows = await queryAll<{
    class_id: string;
    user_id: string;
    username: string;
    grade: string;
    semester: string;
    school: string;
  }>(
    `
      SELECT m.class_id, m.user_id, u.username, u.grade, u.semester, u.school
      FROM class_members m
      JOIN users u ON u.id = m.user_id
      ORDER BY m.joined_at, u.username
    `
  );

  const membersByClass = new Map<string, ClassMemberSummary[]>();
  for (const row of memberRows) {
    if (!membersByClass.has(row.class_id)) {
      membersByClass.set(row.class_id, []);
    }
    membersByClass.get(row.class_id)!.push({
      userId: row.user_id,
      username: row.username,
      grade: row.grade,
      semester: row.semester,
      school: row.school,
    });
  }

  return classRows.map((row) => ({
    ...mapClassRow(row),
    members: membersByClass.get(row.id) ?? [],
  }));
};

export const deleteClass = async (id: string) => {
  await initializeDatabase();
  const target = await queryFirst<{ id: string }>('SELECT id FROM classes WHERE id = ?', [id]);
  if (!target) return false;
  // Explicit cascade: the local libSQL file does not enable PRAGMA foreign_keys.
  await executeStatement('DELETE FROM class_members WHERE class_id = ?', [id]);
  await executeStatement('DELETE FROM homework_assignments WHERE class_id = ?', [id]);
  await executeStatement('DELETE FROM feedback_notes WHERE class_id = ?', [id]);
  await executeStatement('DELETE FROM classes WHERE id = ?', [id]);
  return true;
};

export const addClassMember = async (classId: string, userId: string) => {
  await initializeDatabase();
  await executeStatement('INSERT OR IGNORE INTO class_members (class_id, user_id) VALUES (?, ?)', [
    classId,
    userId,
  ]);
};

export const removeClassMember = async (classId: string, userId: string) => {
  await initializeDatabase();
  await executeStatement('DELETE FROM class_members WHERE class_id = ? AND user_id = ?', [classId, userId]);
};

export const createHomework = async (input: {
  classId: string;
  textbookId: string;
  unitId: string;
  title: string;
  taskKeys: string[];
  dueAt?: string | null;
  createdBy?: string | null;
}): Promise<HomeworkAssignmentSummary> => {
  await initializeDatabase();
  const id = crypto.randomUUID();
  const taskKeys = [...new Set(input.taskKeys)];
  const dueAt = input.dueAt?.trim() ? input.dueAt.trim() : null;

  await executeStatement(
    `
      INSERT INTO homework_assignments (id, class_id, textbook_id, unit_id, title, task_keys, due_at, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      id,
      input.classId,
      input.textbookId,
      input.unitId,
      input.title.trim(),
      JSON.stringify(taskKeys),
      dueAt,
      input.createdBy ?? null,
    ]
  );

  const rows = await queryAll<{ created_at: string }>(
    'SELECT created_at FROM homework_assignments WHERE id = ?',
    [id]
  );

  return {
    id,
    classId: input.classId,
    className: '',
    textbookId: input.textbookId,
    unitId: input.unitId,
    title: input.title.trim(),
    taskKeys,
    dueAt,
    createdAt: rows[0]?.created_at ?? new Date().toISOString(),
  };
};

export const deleteHomework = async (id: string) => {
  await initializeDatabase();
  const target = await queryFirst<{ id: string }>('SELECT id FROM homework_assignments WHERE id = ?', [id]);
  if (!target) return false;
  await executeStatement('DELETE FROM homework_assignments WHERE id = ?', [id]);
  return true;
};

/** Loads `user_id -> state_json` for one textbook, memoized per textbook id. */
const loadStudyStateByTextbook = async (textbookId: string, cache: Map<string, Map<string, string>>) => {
  const cached = cache.get(textbookId);
  if (cached) return cached;

  const rows = await queryAll<{ user_id: string; state_json: string }>(
    'SELECT user_id, state_json FROM study_states WHERE textbook_id = ?',
    [textbookId]
  );
  const states = new Map<string, string>();
  for (const row of rows) {
    states.set(row.user_id, row.state_json);
  }
  cache.set(textbookId, states);
  return states;
};

export const listHomeworkForTeacher = async (classId?: string): Promise<HomeworkTeacherView[]> => {
  await initializeDatabase();
  const assignmentRows = await queryAll<{
    id: string;
    class_id: string;
    class_name: string;
    textbook_id: string;
    unit_id: string;
    title: string;
    task_keys: string;
    due_at: string | null;
    created_at: string;
  }>(
    classId
      ? `
        SELECT h.id, h.class_id, c.name AS class_name, h.textbook_id, h.unit_id, h.title, h.task_keys, h.due_at, h.created_at
        FROM homework_assignments h
        JOIN classes c ON c.id = h.class_id
        WHERE h.class_id = ?
        ORDER BY h.created_at DESC
      `
      : `
        SELECT h.id, h.class_id, c.name AS class_name, h.textbook_id, h.unit_id, h.title, h.task_keys, h.due_at, h.created_at
        FROM homework_assignments h
        JOIN classes c ON c.id = h.class_id
        ORDER BY h.created_at DESC
      `,
    classId ? [classId] : []
  );

  const memberRows = await queryAll<{ class_id: string; user_id: string; username: string }>(
    `
      SELECT m.class_id, m.user_id, u.username
      FROM class_members m
      JOIN users u ON u.id = m.user_id
      ORDER BY m.joined_at, u.username
    `
  );

  const membersByClass = new Map<string, { userId: string; username: string }[]>();
  for (const row of memberRows) {
    if (!membersByClass.has(row.class_id)) {
      membersByClass.set(row.class_id, []);
    }
    membersByClass.get(row.class_id)!.push({ userId: row.user_id, username: row.username });
  }

  const stateCache = new Map<string, Map<string, string>>();
  const assignments: HomeworkTeacherView[] = [];

  for (const row of assignmentRows) {
    const taskKeys = parseHomeworkTaskKeys(row.task_keys);
    const states = await loadStudyStateByTextbook(row.textbook_id, stateCache);
    const students = (membersByClass.get(row.class_id) ?? []).map((member) => {
      const tasks = computeTaskCompletion(states.get(member.userId) ?? null, row.unit_id, taskKeys);
      return {
        userId: member.userId,
        username: member.username,
        completed: isAssignmentCompleted(tasks, taskKeys),
        tasks,
      };
    });

    assignments.push({
      id: row.id,
      classId: row.class_id,
      className: row.class_name,
      textbookId: row.textbook_id,
      unitId: row.unit_id,
      title: row.title,
      taskKeys,
      dueAt: row.due_at ?? null,
      createdAt: row.created_at,
      students,
      completedCount: students.filter((student) => student.completed).length,
      totalCount: students.length,
    });
  }

  return assignments;
};

export const listHomeworkForStudent = async (userId: string): Promise<HomeworkStudentView[]> => {
  await initializeDatabase();
  const rows = await queryAll<{
    id: string;
    class_id: string;
    class_name: string;
    textbook_id: string;
    unit_id: string;
    title: string;
    task_keys: string;
    due_at: string | null;
    created_at: string;
  }>(
    `
      SELECT h.id, h.class_id, c.name AS class_name, h.textbook_id, h.unit_id, h.title, h.task_keys, h.due_at, h.created_at
      FROM homework_assignments h
      JOIN classes c ON c.id = h.class_id
      JOIN class_members m ON m.class_id = h.class_id AND m.user_id = ?
      ORDER BY (h.due_at IS NULL), h.due_at, h.created_at DESC
    `,
    [userId]
  );

  // One query covers every textbook this student has a snapshot for.
  const stateRows = await queryAll<{ textbook_id: string; state_json: string }>(
    'SELECT textbook_id, state_json FROM study_states WHERE user_id = ?',
    [userId]
  );
  const statesByTextbook = new Map<string, string>();
  for (const row of stateRows) {
    statesByTextbook.set(row.textbook_id, row.state_json);
  }

  return rows.map((row) => {
    const taskKeys = parseHomeworkTaskKeys(row.task_keys);
    const tasks = computeTaskCompletion(statesByTextbook.get(row.textbook_id) ?? null, row.unit_id, taskKeys);
    return {
      id: row.id,
      classId: row.class_id,
      className: row.class_name,
      textbookId: row.textbook_id,
      unitId: row.unit_id,
      title: row.title,
      taskKeys,
      dueAt: row.due_at ?? null,
      createdAt: row.created_at,
      tasks,
      completed: isAssignmentCompleted(tasks, taskKeys),
    };
  });
};

export interface FeedbackNote {
  id: string;
  studentId: string;
  studentName: string;
  classId: string | null;
  className: string | null;
  assignmentId: string | null;
  content: string;
  createdAt: string;
}

export interface StudentFeedbackNote {
  id: string;
  classId: string | null;
  className: string | null;
  assignmentId: string | null;
  content: string;
  createdAt: string;
}

export const createFeedback = async (input: {
  studentId: string;
  classId?: string | null;
  assignmentId?: string | null;
  content: string;
  createdBy?: string | null;
}): Promise<FeedbackNote> => {
  await initializeDatabase();
  const id = crypto.randomUUID();
  const classId = input.classId?.trim() ? input.classId.trim() : null;
  const assignmentId = input.assignmentId?.trim() ? input.assignmentId.trim() : null;
  const content = input.content.trim();

  await executeStatement(
    `
      INSERT INTO feedback_notes (id, student_id, class_id, assignment_id, content, created_by)
      VALUES (?, ?, ?, ?, ?, ?)
    `,
    [id, input.studentId, classId, assignmentId, content, input.createdBy ?? null]
  );

  const row = await queryFirst<{
    id: string;
    student_id: string;
    student_name: string | null;
    class_id: string | null;
    class_name: string | null;
    assignment_id: string | null;
    content: string;
    created_at: string;
  }>(
    `
      SELECT f.id, f.student_id, u.username AS student_name, f.class_id, c.name AS class_name,
             f.assignment_id, f.content, f.created_at
      FROM feedback_notes f
      LEFT JOIN users u ON u.id = f.student_id
      LEFT JOIN classes c ON c.id = f.class_id
      WHERE f.id = ?
    `,
    [id]
  );

  return {
    id,
    studentId: input.studentId,
    studentName: row?.student_name ?? '',
    classId,
    className: row?.class_name ?? null,
    assignmentId,
    content,
    createdAt: row?.created_at ?? new Date().toISOString(),
  };
};

export const listFeedbackForTeacher = async (classId?: string): Promise<FeedbackNote[]> => {
  await initializeDatabase();
  const rows = await queryAll<{
    id: string;
    student_id: string;
    student_name: string | null;
    class_id: string | null;
    class_name: string | null;
    assignment_id: string | null;
    content: string;
    created_at: string;
  }>(
    classId
      ? `
        SELECT f.id, f.student_id, u.username AS student_name, f.class_id, c.name AS class_name,
               f.assignment_id, f.content, f.created_at
        FROM feedback_notes f
        LEFT JOIN users u ON u.id = f.student_id
        LEFT JOIN classes c ON c.id = f.class_id
        WHERE f.class_id = ?
        ORDER BY f.created_at DESC, f.rowid DESC
        LIMIT 200
      `
      : `
        SELECT f.id, f.student_id, u.username AS student_name, f.class_id, c.name AS class_name,
               f.assignment_id, f.content, f.created_at
        FROM feedback_notes f
        LEFT JOIN users u ON u.id = f.student_id
        LEFT JOIN classes c ON c.id = f.class_id
        ORDER BY f.created_at DESC, f.rowid DESC
        LIMIT 200
      `,
    classId ? [classId] : []
  );

  return rows.map((row) => ({
    id: row.id,
    studentId: row.student_id,
    studentName: row.student_name ?? '',
    classId: row.class_id ?? null,
    className: row.class_name ?? null,
    assignmentId: row.assignment_id ?? null,
    content: row.content,
    createdAt: row.created_at,
  }));
};

export const listFeedbackForStudent = async (userId: string, limit = 3): Promise<StudentFeedbackNote[]> => {
  await initializeDatabase();
  const rows = await queryAll<{
    id: string;
    class_id: string | null;
    class_name: string | null;
    assignment_id: string | null;
    content: string;
    created_at: string;
  }>(
    `
      SELECT f.id, f.class_id, c.name AS class_name, f.assignment_id, f.content, f.created_at
      FROM feedback_notes f
      LEFT JOIN classes c ON c.id = f.class_id
      WHERE f.student_id = ?
      ORDER BY f.created_at DESC, f.rowid DESC
      LIMIT ?
    `,
    [userId, limit]
  );

  return rows.map((row) => ({
    id: row.id,
    classId: row.class_id ?? null,
    className: row.class_name ?? null,
    assignmentId: row.assignment_id ?? null,
    content: row.content,
    createdAt: row.created_at,
  }));
};

export const deleteFeedback = async (id: string) => {
  await initializeDatabase();
  const target = await queryFirst<{ id: string }>('SELECT id FROM feedback_notes WHERE id = ?', [id]);
  if (!target) return false;
  await executeStatement('DELETE FROM feedback_notes WHERE id = ?', [id]);
  return true;
};

let initializationPromise: Promise<void> | null = null;

const getClient = () => {
  if (!client) {
    throw new Error('Database client not initialized');
  }
  return client;
};

const hashPassword = (password: string, salt: string) =>
  crypto.scryptSync(password, salt, 64).toString('hex');

const hashToken = (token: string) =>
  crypto.createHash('sha256').update(token).digest('hex');

const normalizeSessionHours = (hours?: number) => {
  if (hours && ALLOWED_SESSION_HOURS.has(hours)) {
    return hours;
  }
  return DEFAULT_SESSION_HOURS;
};

const createPasswordRecord = (password: string) => {
  const salt = crypto.randomBytes(16).toString('hex');
  return {
    salt,
    hash: hashPassword(password, salt),
  };
};

const mapUser = (row: DbUserRow): AuthUser => ({
  id: row.id,
  username: row.username,
  grade: row.grade,
  semester: row.semester,
  school: row.school,
  role: row.role,
  selectedTextbookId: row.selected_textbook_id ? String(row.selected_textbook_id) : undefined,
});

const mapTextbookSummary = (row: any): TextbookSummary => ({
  id: String(row.id),
  publisher: String(row.publisher),
  series: String(row.series),
  title: String(row.title),
  stage: String(row.stage),
  grade: String(row.grade),
  semester: String(row.semester),
  volume: String(row.volume),
  description: String(row.description ?? ''),
});

const queryAll = async <T = any>(sql: string, args: any[] = []) => {
  const result = await getClient().execute({ sql, args });
  return result.rows as unknown as T[];
};

const queryFirst = async <T = any>(sql: string, args: any[] = []) => {
  const rows = await queryAll<T>(sql, args);
  return rows[0] ?? null;
};

const executeStatement = async (sql: string, args: any[] = []) => {
  await getClient().execute({ sql, args });
};

const createDefaultAdmin = async () => {
  const existingAdmin = await queryFirst<{ id: string }>(
    'SELECT id FROM users WHERE username = ?',
    [ADMIN_USERNAME]
  );
  if (existingAdmin) return;
  if (USING_DEFAULT_ADMIN_PASSWORD) {
    console.warn(
      '[security] 正在使用默认管理员口令创建 admin 账号。请在部署环境设置 ADMIN_INITIAL_PASSWORD 并在首次登录后修改密码。'
    );
  }

  const password = createPasswordRecord(ADMIN_PASSWORD);
  await executeStatement(
    `
      INSERT INTO users (id, username, password_hash, password_salt, grade, semester, school, role)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      crypto.randomUUID(),
      ADMIN_USERNAME,
      password.hash,
      password.salt,
      '管理员',
      '全学期',
      '系统',
      'admin',
    ]
  );
};

const ensureUserPreferenceColumns = async () => {
  const columns = await queryAll<{ name: string }>('PRAGMA table_info(users)');
  if (columns.some((column) => column.name === 'selected_textbook_id')) return;
  await executeStatement('ALTER TABLE users ADD COLUMN selected_textbook_id TEXT');
};

const ensureAIServiceConfigTable = async () => {
  await executeStatement(
    `
      CREATE TABLE IF NOT EXISTS ai_service_config (
        id TEXT PRIMARY KEY,
        model TEXT NOT NULL,
        base_url TEXT NOT NULL,
        api_key TEXT NOT NULL DEFAULT '',
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `
  );

  const existingConfig = await queryFirst<{ id: string; api_key: string }>(
    'SELECT id, api_key FROM ai_service_config WHERE id = ?',
    ['global']
  );
  if (existingConfig) {
    if (!existingConfig.api_key && DEFAULT_AI_API_KEY) {
      await executeStatement(
        `
          UPDATE ai_service_config
          SET api_key = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `,
        [DEFAULT_AI_API_KEY, 'global']
      );
    }
    return;
  }

  await executeStatement(
    `
      INSERT INTO ai_service_config (id, model, base_url, api_key)
      VALUES (?, ?, ?, ?)
    `,
    ['global', DEFAULT_AI_MODEL, DEFAULT_AI_BASE_URL, DEFAULT_AI_API_KEY]
  );
};

export const initializeDatabase = async () => {
  if (!initializationPromise) {
    initializationPromise = (async () => {
      if (IS_VERCEL && !TURSO_DATABASE_URL) {
        throw new Error('Missing TURSO_DATABASE_URL in Vercel environment');
      }

      if (IS_VERCEL && TURSO_DATABASE_URL && !TURSO_AUTH_TOKEN) {
        throw new Error('Missing TURSO_AUTH_TOKEN in Vercel environment');
      }

      if (!client) {
        const shouldUseLocalFile = !TURSO_DATABASE_URL && !IS_VERCEL;
        if (shouldUseLocalFile && !fs.existsSync(DB_DIR)) {
          fs.mkdirSync(DB_DIR, { recursive: true });
        }

        client = createClient({
          url: TURSO_DATABASE_URL || DEFAULT_LOCAL_URL,
          authToken: TURSO_DATABASE_URL ? TURSO_AUTH_TOKEN : undefined,
        });
      }

      for (const statement of schemaStatements) {
        await executeStatement(statement);
      }
      await ensureUserPreferenceColumns();
      await createDefaultAdmin();
    })();
  }

  return initializationPromise;
};

const getUserById = async (id: string) =>
  (await queryFirst<DbUserRow>(
    `
      SELECT id, username, grade, semester, school, role, selected_textbook_id, password_hash, password_salt, created_at
      FROM users
      WHERE id = ?
    `,
    [id]
  )) as DbUserRow | null;

const createSessionForUser = async (user: DbUserRow, sessionHours?: number): Promise<SessionInfo> => {
  const rawToken = crypto.randomBytes(32).toString('hex');
  const sessionId = crypto.randomUUID();
  const normalizedHours = normalizeSessionHours(sessionHours);
  const expiresAt = new Date(Date.now() + normalizedHours * 60 * 60 * 1000).toISOString();

  await executeStatement(
    `
      INSERT INTO sessions (id, user_id, token_hash, expires_at)
      VALUES (?, ?, ?, ?)
    `,
    [sessionId, user.id, hashToken(rawToken), expiresAt]
  );

  return {
    token: rawToken,
    user: mapUser(user),
    expiresAt,
  };
};

export const listUsers = async (): Promise<AuthUser[]> => {
  await initializeDatabase();
  const rows = await queryAll<DbUserRow>(
    `
      SELECT id, username, grade, semester, school, role, selected_textbook_id, password_hash, password_salt, created_at
      FROM users
      ORDER BY created_at DESC
    `
  );
  return rows.map((row) => mapUser(row)).filter((user) => user.role !== 'admin');
};

export const createUser = async (input: Omit<AuthUser, 'id' | 'role'> & { password: string }): Promise<AuthUser> => {
  await initializeDatabase();
  const username = input.username.trim();
  const normalizedUsername = username.toLowerCase();
  const existingUser = await queryFirst<{ id: string }>(
    'SELECT id FROM users WHERE lower(username) = ?',
    [normalizedUsername]
  );

  if (existingUser) {
    throw new Error('用户名已存在');
  }

  const password = createPasswordRecord(input.password.trim());
  const user: AuthUser = {
    id: crypto.randomUUID(),
    username,
    grade: input.grade,
    semester: input.semester,
    school: input.school.trim(),
    role: 'user',
  };

  await executeStatement(
    `
      INSERT INTO users (id, username, password_hash, password_salt, grade, semester, school, role)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [user.id, user.username, password.hash, password.salt, user.grade, user.semester, user.school, user.role]
  );

  return user;
};

export const deleteUser = async (id: string) => {
  await initializeDatabase();
  await executeStatement('DELETE FROM sessions WHERE user_id = ?', [id]);
  const before = await queryFirst<{ id: string }>('SELECT id FROM users WHERE id = ? AND role != ?', [id, 'admin']);
  if (!before) return false;
  // Explicit cascade for the rows that reference this user.
  await executeStatement('DELETE FROM class_members WHERE user_id = ?', [id]);
  await executeStatement('DELETE FROM study_states WHERE user_id = ?', [id]);
  await executeStatement('DELETE FROM feedback_notes WHERE student_id = ?', [id]);
  await executeStatement('DELETE FROM users WHERE id = ? AND role != ?', [id, 'admin']);
  return true;
};

export const createSessionForCredentials = async (username: string, password: string, sessionHours?: number): Promise<SessionInfo | null> => {
  await initializeDatabase();
  const user = (await queryFirst<DbUserRow>(
    `
      SELECT id, username, grade, semester, school, role, selected_textbook_id, password_hash, password_salt, created_at
      FROM users
      WHERE lower(username) = ?
    `,
    [username.trim().toLowerCase()]
  )) as DbUserRow | null;

  if (!user) return null;

  const expectedHash = hashPassword(password.trim(), user.password_salt);
  if (expectedHash !== user.password_hash) return null;

  return createSessionForUser(user, sessionHours);
};

export const getUserByToken = async (token: string): Promise<AuthUser | null> => {
  await initializeDatabase();
  const session = (await queryFirst<DbUserRow & { expires_at: string }>(
    `
      SELECT
        users.id,
        users.username,
        users.grade,
        users.semester,
        users.school,
        users.role,
        users.selected_textbook_id,
        users.password_hash,
        users.password_salt,
        users.created_at,
        sessions.expires_at
      FROM sessions
      JOIN users ON users.id = sessions.user_id
      WHERE sessions.token_hash = ?
    `,
    [hashToken(token)]
  )) as (DbUserRow & { expires_at: string }) | null;

  if (!session) return null;

  if (new Date(session.expires_at).getTime() <= Date.now()) {
    await executeStatement('DELETE FROM sessions WHERE token_hash = ?', [hashToken(token)]);
    return null;
  }

  return mapUser(session);
};

export const deleteSession = async (token: string) => {
  await initializeDatabase();
  await executeStatement('DELETE FROM sessions WHERE token_hash = ?', [hashToken(token)]);
};

export const cleanupExpiredSessions = async () => {
  await initializeDatabase();
  await executeStatement('DELETE FROM sessions WHERE expires_at <= ?', [new Date().toISOString()]);
};

export const updateSelectedTextbookForUser = async (
  userId: string,
  textbookId: string
): Promise<AuthUser> => {
  await initializeDatabase();
  const textbook = await queryFirst<{ id: string }>(
    'SELECT id FROM textbooks WHERE id = ?',
    [textbookId]
  );
  if (!textbook) {
    throw new Error('教材不存在');
  }

  await executeStatement(
    `
      UPDATE users
      SET selected_textbook_id = ?
      WHERE id = ?
    `,
    [textbookId, userId]
  );

  const user = await getUserById(userId);
  if (!user) {
    throw new Error('用户不存在');
  }
  return mapUser(user);
};

const normalizeBaseURL = (value?: string) => {
  let baseURL = (value || DEFAULT_AI_BASE_URL).trim();
  if (!baseURL.startsWith('http://') && !baseURL.startsWith('https://')) {
    baseURL = `https://${baseURL}`;
  }
  return baseURL.replace(/\/+$/, '');
};

const mapAIConfig = (
  row: { model: string; base_url: string; api_key: string; updated_at?: string },
  includeSecret = false
): AIServiceConfig => ({
  model: String(row.model || DEFAULT_AI_MODEL),
  baseURL: normalizeBaseURL(String(row.base_url || DEFAULT_AI_BASE_URL)),
  apiKey: includeSecret ? String(row.api_key || '') : undefined,
  hasApiKey: Boolean(String(row.api_key || '').trim()),
  updatedAt: row.updated_at ? String(row.updated_at) : undefined,
});

export const getAIServiceConfig = async (options: { includeSecret?: boolean } = {}): Promise<AIServiceConfig> => {
  await initializeDatabase();
  await ensureAIServiceConfigTable();
  const row = await queryFirst<{ model: string; base_url: string; api_key: string; updated_at?: string }>(
    `
      SELECT model, base_url, api_key, updated_at
      FROM ai_service_config
      WHERE id = ?
    `,
    ['global']
  );

  if (!row) {
    return {
      model: DEFAULT_AI_MODEL,
      baseURL: normalizeBaseURL(DEFAULT_AI_BASE_URL),
      apiKey: options.includeSecret ? DEFAULT_AI_API_KEY : undefined,
      hasApiKey: Boolean(DEFAULT_AI_API_KEY),
    };
  }

  return mapAIConfig(row, Boolean(options.includeSecret));
};

export const updateAIServiceConfig = async (input: {
  model?: string;
  baseURL?: string;
  apiKey?: string;
}): Promise<AIServiceConfig> => {
  await initializeDatabase();
  await ensureAIServiceConfigTable();
  const current = await getAIServiceConfig({ includeSecret: true });
  const model = input.model?.trim() || current.model || DEFAULT_AI_MODEL;
  const baseURL = normalizeBaseURL(input.baseURL || current.baseURL || DEFAULT_AI_BASE_URL);
  const nextApiKey = typeof input.apiKey === 'string' && input.apiKey.trim()
    ? input.apiKey.trim()
    : current.apiKey || '';

  await executeStatement(
    `
      INSERT INTO ai_service_config (id, model, base_url, api_key, updated_at)
      VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(id) DO UPDATE SET
        model = excluded.model,
        base_url = excluded.base_url,
        api_key = excluded.api_key,
        updated_at = CURRENT_TIMESTAMP
    `,
    ['global', model, baseURL, nextApiKey]
  );

  return getAIServiceConfig();
};

export const changePassword = async (
  userId: string,
  currentPassword: string,
  nextPassword: string,
  sessionHours?: number
): Promise<SessionInfo> => {
  await initializeDatabase();
  const user = await getUserById(userId);
  if (!user) {
    throw new Error('用户不存在');
  }

  const currentHash = hashPassword(currentPassword.trim(), user.password_salt);
  if (currentHash !== user.password_hash) {
    throw new Error('当前密码不正确');
  }

  const trimmedNextPassword = nextPassword.trim();
  if (trimmedNextPassword.length < 6) {
    throw new Error('新密码至少需要 6 位');
  }

  const password = createPasswordRecord(trimmedNextPassword);
  await executeStatement(
    `
      UPDATE users
      SET password_hash = ?, password_salt = ?
      WHERE id = ?
    `,
    [password.hash, password.salt, userId]
  );

  await executeStatement('DELETE FROM sessions WHERE user_id = ?', [userId]);

  const updatedUser = await getUserById(userId);
  if (!updatedUser) {
    throw new Error('用户不存在');
  }

  return createSessionForUser(updatedUser, sessionHours);
};

export const listTextbooks = async (): Promise<TextbookSummary[]> => {
  await initializeDatabase();
  const rows = await queryAll(
    `
      SELECT id, publisher, series, title, stage, grade, semester, volume, description
      FROM textbooks
      ORDER BY stage, grade, semester, created_at
    `
  );
  return rows.map((row) => mapTextbookSummary(row));
};

export const getTextbookContent = async (textbookId: string): Promise<TextbookContent | null> => {
  await initializeDatabase();
  const textbook = await queryFirst(
    `
      SELECT id, publisher, series, title, stage, grade, semester, volume, description
      FROM textbooks
      WHERE id = ?
    `,
    [textbookId]
  );

  if (!textbook) return null;

  const unitRows = await queryAll<{
    id: string;
    unit_code: string;
    title: string;
    summary: string;
    passage: string;
    sort_order: number;
  }>(
    `
      SELECT id, unit_code, title, summary, passage, sort_order
      FROM textbook_units
      WHERE textbook_id = ?
      ORDER BY sort_order, created_at
    `,
    [textbookId]
  );

  const units: TextbookUnit[] = [];
  for (const unitRow of unitRows) {
    const [lessons, vocab, sentences, phrases, patterns] = await Promise.all([
      queryAll<TextbookLesson>(
        `
          SELECT id, stage_key as stageKey, title, objective, sort_order as sortOrder
          FROM textbook_lessons
          WHERE unit_id = ?
          ORDER BY sort_order
        `,
        [unitRow.id]
      ),
      queryAll<TextbookVocabItem>(
        `
          SELECT id, word, phonetic, definition, example, sort_order as sortOrder
          FROM textbook_vocab_items
          WHERE unit_id = ?
          ORDER BY sort_order
        `,
        [unitRow.id]
      ),
      queryAll<TextbookSentenceItem>(
        `
          SELECT id, text, translation, sort_order as sortOrder
          FROM textbook_sentences
          WHERE unit_id = ?
          ORDER BY sort_order
        `,
        [unitRow.id]
      ),
      queryAll<TextbookPhrase>(
        `
          SELECT id, phrase, meaning, example, sort_order as sortOrder
          FROM textbook_phrases
          WHERE unit_id = ?
          ORDER BY sort_order
        `,
        [unitRow.id]
      ),
      queryAll<TextbookPattern>(
        `
          SELECT id, text, translation, kind, sort_order as sortOrder
          FROM textbook_patterns
          WHERE unit_id = ?
          ORDER BY sort_order
        `,
        [unitRow.id]
      ),
    ]);

    units.push({
      id: unitRow.id,
      unitCode: String(unitRow.unit_code),
      title: String(unitRow.title),
      summary: String(unitRow.summary),
      passage: String(unitRow.passage),
      sortOrder: Number(unitRow.sort_order),
      lessons,
      vocab,
      sentences,
      phrases,
      patterns,
    });
  }

  return {
    ...mapTextbookSummary(textbook),
    units,
  };
};

export const listTextbookSamples = async () => {
  await initializeDatabase();
  return TEXTBOOK_SAMPLES.map((sample) => ({
    id: sample.id,
    title: sample.title,
    stage: sample.stage,
    grade: sample.grade,
    semester: sample.semester,
    unitCount: sample.units.length,
    description: sample.description,
  }));
};

const deleteTextbookCascade = async (textbookId: string) => {
  const unitIds = await queryAll<{ id: string }>(
    'SELECT id FROM textbook_units WHERE textbook_id = ?',
    [textbookId]
  );

  for (const unit of unitIds) {
    await executeStatement('DELETE FROM textbook_lessons WHERE unit_id = ?', [unit.id]);
    await executeStatement('DELETE FROM textbook_vocab_items WHERE unit_id = ?', [unit.id]);
    await executeStatement('DELETE FROM textbook_sentences WHERE unit_id = ?', [unit.id]);
    await executeStatement('DELETE FROM textbook_phrases WHERE unit_id = ?', [unit.id]);
    await executeStatement('DELETE FROM textbook_patterns WHERE unit_id = ?', [unit.id]);
  }

  await executeStatement('DELETE FROM textbook_units WHERE textbook_id = ?', [textbookId]);
  await executeStatement('DELETE FROM textbooks WHERE id = ?', [textbookId]);
};

const importTextbookSampleTx = async (sample: TextbookSample) => {
  await deleteTextbookCascade(sample.id);

  await executeStatement(
    `
      INSERT INTO textbooks (id, publisher, series, title, stage, grade, semester, volume, description, source_type)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      sample.id,
      sample.publisher,
      sample.series,
      sample.title,
      sample.stage,
      sample.grade,
      sample.semester,
      sample.volume,
      sample.description,
      'sample',
    ]
  );

  for (const [unitIndex, unit] of sample.units.entries()) {
    const unitId = `${sample.id}:${unit.unitCode.toLowerCase().replace(/\s+/g, '-')}`;
    await executeStatement(
      `
        INSERT INTO textbook_units (id, textbook_id, unit_code, title, summary, passage, sort_order)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
      [unitId, sample.id, unit.unitCode, unit.title, unit.summary, unit.passage, unitIndex + 1]
    );

    for (const lesson of unit.lessons) {
      await executeStatement(
        `
          INSERT INTO textbook_lessons (id, unit_id, stage_key, title, objective, sort_order)
          VALUES (?, ?, ?, ?, ?, ?)
        `,
        [`${unitId}:${lesson.stageKey}`, unitId, lesson.stageKey, lesson.title, lesson.objective, lesson.sortOrder]
      );
    }

    for (const [index, item] of unit.vocab.entries()) {
      await executeStatement(
        `
          INSERT INTO textbook_vocab_items (id, unit_id, word, phonetic, definition, example, sort_order)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `,
        [item.id, unitId, item.word, item.phonetic, item.definition, item.example, index + 1]
      );
    }

    for (const [index, item] of unit.sentences.entries()) {
      await executeStatement(
        `
          INSERT INTO textbook_sentences (id, unit_id, text, translation, sort_order)
          VALUES (?, ?, ?, ?, ?)
        `,
        [item.id, unitId, item.text, item.translation, index + 1]
      );
    }

    for (const [index, item] of unit.phrases.entries()) {
      await executeStatement(
        `
          INSERT INTO textbook_phrases (id, unit_id, phrase, meaning, example, sort_order)
          VALUES (?, ?, ?, ?, ?, ?)
        `,
        [`${unitId}:phrase:${index + 1}`, unitId, item.phrase, item.meaning, item.example, index + 1]
      );
    }

    for (const [index, item] of unit.patterns.entries()) {
      await executeStatement(
        `
          INSERT INTO textbook_patterns (id, unit_id, text, translation, kind, sort_order)
          VALUES (?, ?, ?, ?, ?, ?)
        `,
        [`${unitId}:pattern:${index + 1}`, unitId, item.text, item.translation, item.kind, index + 1]
      );
    }
  }
};

export const importTextbookSample = async (sampleId: string): Promise<TextbookSummary> => {
  await initializeDatabase();
  const sample = TEXTBOOK_SAMPLES.find((item) => item.id === sampleId);
  if (!sample) {
    throw new Error('教材样板不存在');
  }

  await importTextbookSampleTx(sample);
  const textbook = await queryFirst(
    `
      SELECT id, publisher, series, title, stage, grade, semester, volume, description
      FROM textbooks
      WHERE id = ?
    `,
    [sample.id]
  );

  return mapTextbookSummary(textbook);
};

export const importAllTextbookSamples = async (): Promise<TextbookSummary[]> => {
  await initializeDatabase();
  const textbooks: TextbookSummary[] = [];
  for (const sample of TEXTBOOK_SAMPLES) {
    await importTextbookSampleTx(sample);
    const textbook = await queryFirst(
      `
        SELECT id, publisher, series, title, stage, grade, semester, volume, description
        FROM textbooks
        WHERE id = ?
      `,
      [sample.id]
    );
    textbooks.push(mapTextbookSummary(textbook));
  }
  return textbooks;
};
