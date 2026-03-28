import Database from 'better-sqlite3';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { TEXTBOOK_SAMPLES, type TextbookSample } from './textbook-samples';

export interface AuthUser {
  id: string;
  username: string;
  grade: string;
  semester: string;
  school: string;
  role: 'admin' | 'user';
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

interface DbUserRow extends AuthUser {
  password_hash: string;
  password_salt: string;
  created_at: string;
}

const DB_DIR = path.resolve(process.cwd(), 'data');
const DB_PATH = path.join(DB_DIR, 'app.db');
const ADMIN_USERNAME = 'admin';
const ADMIN_PASSWORD = 'admin1234';
const DEFAULT_SESSION_HOURS = 24 * 7;
const ALLOWED_SESSION_HOURS = new Set([12, 24 * 7, 24 * 30]);

if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    password_salt TEXT NOT NULL,
    grade TEXT NOT NULL,
    semester TEXT NOT NULL,
    school TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('admin', 'user')),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    token_hash TEXT NOT NULL UNIQUE,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
  CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);

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
  );

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
  );

  CREATE TABLE IF NOT EXISTS textbook_lessons (
    id TEXT PRIMARY KEY,
    unit_id TEXT NOT NULL,
    stage_key TEXT NOT NULL,
    title TEXT NOT NULL,
    objective TEXT NOT NULL DEFAULT '',
    sort_order INTEGER NOT NULL,
    FOREIGN KEY(unit_id) REFERENCES textbook_units(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS textbook_vocab_items (
    id TEXT PRIMARY KEY,
    unit_id TEXT NOT NULL,
    word TEXT NOT NULL,
    phonetic TEXT NOT NULL DEFAULT '',
    definition TEXT NOT NULL DEFAULT '',
    example TEXT NOT NULL DEFAULT '',
    sort_order INTEGER NOT NULL,
    FOREIGN KEY(unit_id) REFERENCES textbook_units(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS textbook_sentences (
    id TEXT PRIMARY KEY,
    unit_id TEXT NOT NULL,
    text TEXT NOT NULL,
    translation TEXT NOT NULL DEFAULT '',
    sort_order INTEGER NOT NULL,
    FOREIGN KEY(unit_id) REFERENCES textbook_units(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS textbook_phrases (
    id TEXT PRIMARY KEY,
    unit_id TEXT NOT NULL,
    phrase TEXT NOT NULL,
    meaning TEXT NOT NULL DEFAULT '',
    example TEXT NOT NULL DEFAULT '',
    sort_order INTEGER NOT NULL,
    FOREIGN KEY(unit_id) REFERENCES textbook_units(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS textbook_patterns (
    id TEXT PRIMARY KEY,
    unit_id TEXT NOT NULL,
    text TEXT NOT NULL,
    translation TEXT NOT NULL DEFAULT '',
    kind TEXT NOT NULL DEFAULT 'pattern',
    sort_order INTEGER NOT NULL,
    FOREIGN KEY(unit_id) REFERENCES textbook_units(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_textbook_units_textbook_id ON textbook_units(textbook_id);
  CREATE INDEX IF NOT EXISTS idx_textbook_lessons_unit_id ON textbook_lessons(unit_id);
  CREATE INDEX IF NOT EXISTS idx_textbook_vocab_unit_id ON textbook_vocab_items(unit_id);
  CREATE INDEX IF NOT EXISTS idx_textbook_sentences_unit_id ON textbook_sentences(unit_id);
  CREATE INDEX IF NOT EXISTS idx_textbook_phrases_unit_id ON textbook_phrases(unit_id);
  CREATE INDEX IF NOT EXISTS idx_textbook_patterns_unit_id ON textbook_patterns(unit_id);
`);

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
});

const createDefaultAdmin = () => {
  const existingAdmin = db.prepare('SELECT id FROM users WHERE username = ?').get(ADMIN_USERNAME);
  if (existingAdmin) return;

  const password = createPasswordRecord(ADMIN_PASSWORD);
  db.prepare(`
    INSERT INTO users (id, username, password_hash, password_salt, grade, semester, school, role)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    crypto.randomUUID(),
    ADMIN_USERNAME,
    password.hash,
    password.salt,
    '管理员',
    '全学期',
    '系统',
    'admin'
  );
};

createDefaultAdmin();

const mapTextbookSummary = (row: any): TextbookSummary => ({
  id: row.id,
  publisher: row.publisher,
  series: row.series,
  title: row.title,
  stage: row.stage,
  grade: row.grade,
  semester: row.semester,
  volume: row.volume,
  description: row.description,
});

export const listUsers = (): AuthUser[] =>
  db
    .prepare(`SELECT id, username, grade, semester, school, role, password_hash, password_salt, created_at FROM users ORDER BY created_at DESC`)
    .all()
    .map((row) => mapUser(row as DbUserRow))
    .filter((user) => user.role !== 'admin');

export const createUser = (input: Omit<AuthUser, 'id' | 'role'> & { password: string }): AuthUser => {
  const username = input.username.trim();
  const normalizedUsername = username.toLowerCase();
  const existingUser = db
    .prepare('SELECT id FROM users WHERE lower(username) = ?')
    .get(normalizedUsername);

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

  db.prepare(`
    INSERT INTO users (id, username, password_hash, password_salt, grade, semester, school, role)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    user.id,
    user.username,
    password.hash,
    password.salt,
    user.grade,
    user.semester,
    user.school,
    user.role
  );

  return user;
};

const getUserById = (id: string) =>
  db
    .prepare(`
      SELECT id, username, grade, semester, school, role, password_hash, password_salt, created_at
      FROM users
      WHERE id = ?
    `)
    .get(id) as DbUserRow | undefined;

const createSessionForUser = (user: DbUserRow, sessionHours?: number): SessionInfo => {
  const rawToken = crypto.randomBytes(32).toString('hex');
  const sessionId = crypto.randomUUID();
  const normalizedHours = normalizeSessionHours(sessionHours);
  const expiresAt = new Date(Date.now() + normalizedHours * 60 * 60 * 1000).toISOString();

  db.prepare(`
    INSERT INTO sessions (id, user_id, token_hash, expires_at)
    VALUES (?, ?, ?, ?)
  `).run(sessionId, user.id, hashToken(rawToken), expiresAt);

  return {
    token: rawToken,
    user: mapUser(user),
    expiresAt,
  };
};

export const deleteUser = (id: string) => {
  db.prepare('DELETE FROM sessions WHERE user_id = ?').run(id);
  const result = db.prepare(`DELETE FROM users WHERE id = ? AND role != 'admin'`).run(id);
  return result.changes > 0;
};

export const createSessionForCredentials = (username: string, password: string, sessionHours?: number): SessionInfo | null => {
  const user = db
    .prepare(`
      SELECT id, username, grade, semester, school, role, password_hash, password_salt, created_at
      FROM users
      WHERE lower(username) = ?
    `)
    .get(username.trim().toLowerCase()) as DbUserRow | undefined;

  if (!user) return null;

  const expectedHash = hashPassword(password.trim(), user.password_salt);
  if (expectedHash !== user.password_hash) return null;

  return createSessionForUser(user, sessionHours);
};

export const getUserByToken = (token: string): AuthUser | null => {
  const session = db
    .prepare(`
      SELECT
        users.id,
        users.username,
        users.grade,
        users.semester,
        users.school,
        users.role,
        users.password_hash,
        users.password_salt,
        users.created_at,
        sessions.expires_at
      FROM sessions
      JOIN users ON users.id = sessions.user_id
      WHERE sessions.token_hash = ?
    `)
    .get(hashToken(token)) as (DbUserRow & { expires_at: string }) | undefined;

  if (!session) return null;

  if (new Date(session.expires_at).getTime() <= Date.now()) {
    db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(hashToken(token));
    return null;
  }

  return mapUser(session);
};

export const deleteSession = (token: string) => {
  db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(hashToken(token));
};

export const cleanupExpiredSessions = () => {
  db.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(new Date().toISOString());
};

export const changePassword = (
  userId: string,
  currentPassword: string,
  nextPassword: string,
  sessionHours?: number
): SessionInfo => {
  const user = getUserById(userId);
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
  db.prepare(`
    UPDATE users
    SET password_hash = ?, password_salt = ?
    WHERE id = ?
  `).run(password.hash, password.salt, userId);

  db.prepare('DELETE FROM sessions WHERE user_id = ?').run(userId);

  const updatedUser = getUserById(userId);
  if (!updatedUser) {
    throw new Error('用户不存在');
  }

  return createSessionForUser(updatedUser, sessionHours);
};

export const listTextbooks = (): TextbookSummary[] =>
  db
    .prepare(`
      SELECT id, publisher, series, title, stage, grade, semester, volume, description
      FROM textbooks
      ORDER BY stage, grade, semester, created_at
    `)
    .all()
    .map((row) => mapTextbookSummary(row));

export const getTextbookContent = (textbookId: string): TextbookContent | null => {
  const textbook = db
    .prepare(`
      SELECT id, publisher, series, title, stage, grade, semester, volume, description
      FROM textbooks
      WHERE id = ?
    `)
    .get(textbookId);

  if (!textbook) return null;

  const unitRows = db
    .prepare(`
      SELECT id, unit_code, title, summary, passage, sort_order
      FROM textbook_units
      WHERE textbook_id = ?
      ORDER BY sort_order, created_at
    `)
    .all(textbookId) as Array<{
      id: string;
      unit_code: string;
      title: string;
      summary: string;
      passage: string;
      sort_order: number;
    }>;

  const units: TextbookUnit[] = unitRows.map((unitRow) => ({
    id: unitRow.id,
    unitCode: unitRow.unit_code,
    title: unitRow.title,
    summary: unitRow.summary,
    passage: unitRow.passage,
    sortOrder: unitRow.sort_order,
    lessons: db
      .prepare(`
        SELECT id, stage_key as stageKey, title, objective, sort_order as sortOrder
        FROM textbook_lessons
        WHERE unit_id = ?
        ORDER BY sort_order
      `)
      .all(unitRow.id) as TextbookLesson[],
    vocab: db
      .prepare(`
        SELECT id, word, phonetic, definition, example, sort_order as sortOrder
        FROM textbook_vocab_items
        WHERE unit_id = ?
        ORDER BY sort_order
      `)
      .all(unitRow.id) as TextbookVocabItem[],
    sentences: db
      .prepare(`
        SELECT id, text, translation, sort_order as sortOrder
        FROM textbook_sentences
        WHERE unit_id = ?
        ORDER BY sort_order
      `)
      .all(unitRow.id) as TextbookSentenceItem[],
    phrases: db
      .prepare(`
        SELECT id, phrase, meaning, example, sort_order as sortOrder
        FROM textbook_phrases
        WHERE unit_id = ?
        ORDER BY sort_order
      `)
      .all(unitRow.id) as TextbookPhrase[],
    patterns: db
      .prepare(`
        SELECT id, text, translation, kind, sort_order as sortOrder
        FROM textbook_patterns
        WHERE unit_id = ?
        ORDER BY sort_order
      `)
      .all(unitRow.id) as TextbookPattern[],
  }));

  return {
    ...mapTextbookSummary(textbook),
    units,
  };
};

export const listTextbookSamples = () =>
  TEXTBOOK_SAMPLES.map((sample) => ({
    id: sample.id,
    title: sample.title,
    stage: sample.stage,
    grade: sample.grade,
    semester: sample.semester,
    unitCount: sample.units.length,
    description: sample.description,
  }));

const deleteTextbookCascade = db.transaction((textbookId: string) => {
  const unitIds = db.prepare('SELECT id FROM textbook_units WHERE textbook_id = ?').all(textbookId) as Array<{ id: string }>;
  for (const unit of unitIds) {
    db.prepare('DELETE FROM textbook_lessons WHERE unit_id = ?').run(unit.id);
    db.prepare('DELETE FROM textbook_vocab_items WHERE unit_id = ?').run(unit.id);
    db.prepare('DELETE FROM textbook_sentences WHERE unit_id = ?').run(unit.id);
    db.prepare('DELETE FROM textbook_phrases WHERE unit_id = ?').run(unit.id);
    db.prepare('DELETE FROM textbook_patterns WHERE unit_id = ?').run(unit.id);
  }
  db.prepare('DELETE FROM textbook_units WHERE textbook_id = ?').run(textbookId);
  db.prepare('DELETE FROM textbooks WHERE id = ?').run(textbookId);
});

const importTextbookSampleTx = db.transaction((sample: TextbookSample) => {
  deleteTextbookCascade(sample.id);

  db.prepare(`
    INSERT INTO textbooks (id, publisher, series, title, stage, grade, semester, volume, description, source_type)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    sample.id,
    sample.publisher,
    sample.series,
    sample.title,
    sample.stage,
    sample.grade,
    sample.semester,
    sample.volume,
    sample.description,
    'sample'
  );

  sample.units.forEach((unit, unitIndex) => {
    const unitId = `${sample.id}:${unit.unitCode.toLowerCase().replace(/\s+/g, '-')}`;
    db.prepare(`
      INSERT INTO textbook_units (id, textbook_id, unit_code, title, summary, passage, sort_order)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(unitId, sample.id, unit.unitCode, unit.title, unit.summary, unit.passage, unitIndex + 1);

    unit.lessons.forEach((lesson) => {
      db.prepare(`
        INSERT INTO textbook_lessons (id, unit_id, stage_key, title, objective, sort_order)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(`${unitId}:${lesson.stageKey}`, unitId, lesson.stageKey, lesson.title, lesson.objective, lesson.sortOrder);
    });

    unit.vocab.forEach((item, index) => {
      db.prepare(`
        INSERT INTO textbook_vocab_items (id, unit_id, word, phonetic, definition, example, sort_order)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(item.id, unitId, item.word, item.phonetic, item.definition, item.example, index + 1);
    });

    unit.sentences.forEach((item, index) => {
      db.prepare(`
        INSERT INTO textbook_sentences (id, unit_id, text, translation, sort_order)
        VALUES (?, ?, ?, ?, ?)
      `).run(item.id, unitId, item.text, item.translation, index + 1);
    });

    unit.phrases.forEach((item, index) => {
      db.prepare(`
        INSERT INTO textbook_phrases (id, unit_id, phrase, meaning, example, sort_order)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(`${unitId}:phrase:${index + 1}`, unitId, item.phrase, item.meaning, item.example, index + 1);
    });

    unit.patterns.forEach((item, index) => {
      db.prepare(`
        INSERT INTO textbook_patterns (id, unit_id, text, translation, kind, sort_order)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(`${unitId}:pattern:${index + 1}`, unitId, item.text, item.translation, item.kind, index + 1);
    });
  });
});

export const importTextbookSample = (sampleId: string): TextbookSummary => {
  const sample = TEXTBOOK_SAMPLES.find((item) => item.id === sampleId);
  if (!sample) {
    throw new Error('教材样板不存在');
  }

  importTextbookSampleTx(sample);
  const textbook = db
    .prepare(`
      SELECT id, publisher, series, title, stage, grade, semester, volume, description
      FROM textbooks
      WHERE id = ?
    `)
    .get(sample.id);

  return mapTextbookSummary(textbook);
};

export const importAllTextbookSamples = (): TextbookSummary[] => {
  return TEXTBOOK_SAMPLES.map((sample) => {
    importTextbookSampleTx(sample);
    const textbook = db
      .prepare(`
        SELECT id, publisher, series, title, stage, grade, semester, volume, description
        FROM textbooks
        WHERE id = ?
      `)
      .get(sample.id);
    return mapTextbookSummary(textbook);
  });
};
