import Database from 'better-sqlite3';
import { DB_FILE } from './config.js';

export const db = new Database(DB_FILE);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  manual_order  TEXT NOT NULL DEFAULT '[]',
  settings      TEXT NOT NULL DEFAULT '{}',
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS tasks (
  id             TEXT PRIMARY KEY,
  user_id        TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title          TEXT NOT NULL,
  course         TEXT NOT NULL,
  deadline       TEXT NOT NULL,             -- ISO 8601
  weight         REAL NOT NULL DEFAULT 0,   -- % of final grade
  difficulty     TEXT NOT NULL DEFAULT 'medium' CHECK (difficulty IN ('easy','medium','hard')),
  hours          REAL,                      -- student's own estimate; NULL = use difficulty guess
  progress       INTEGER NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
  done           INTEGER NOT NULL DEFAULT 0,
  alerted_at     TEXT,                      -- when the start-by alert was sent
  snoozed_until  TEXT,
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at     TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_tasks_user ON tasks(user_id);

CREATE TABLE IF NOT EXISTS push_subscriptions (
  endpoint   TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  keys       TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS kv (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`);

export const DEFAULT_SETTINGS = { sound: true, vibrate: true, silent: false, hc: false, big: false };

/** SQLite row -> API object */
export function toTask(r) {
  if (!r) return null;
  return {
    id: r.id,
    title: r.title,
    course: r.course,
    deadline: r.deadline,
    weight: r.weight,
    difficulty: r.difficulty,
    hours: r.hours,
    progress: r.progress,
    done: !!r.done,
    alertedAt: r.alerted_at,
    snoozedUntil: r.snoozed_until,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export function ensureUser(id) {
  db.prepare('INSERT OR IGNORE INTO users (id) VALUES (?)').run(id);
  return db.prepare('SELECT * FROM users WHERE id = ?').get(id);
}

export function kvGet(key) {
  const r = db.prepare('SELECT value FROM kv WHERE key = ?').get(key);
  return r ? JSON.parse(r.value) : null;
}
export function kvSet(key, value) {
  db.prepare('INSERT INTO kv (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
    .run(key, JSON.stringify(value));
}
