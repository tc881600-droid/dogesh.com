'use strict';
/**
 * Dogesh.com — data layer (SQLite via better-sqlite3).
 * All statements are prepared once and reused; every query is parameterised.
 */
const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', '..', 'data');
fs.mkdirSync(DATA_DIR, { recursive: true });

const DB_FILE = process.env.DB_FILE || path.join(DATA_DIR, 'dogesh.db');
const db = new Database(DB_FILE);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

/* ---------------------------------------------------------------- schema */
db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  email         TEXT    NOT NULL UNIQUE,
  full_name     TEXT    NOT NULL DEFAULT '',
  password_hash TEXT    NOT NULL,
  created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sessions (
  token      TEXT    PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL,
  created_at TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

CREATE TABLE IF NOT EXISTS breeds (
  id          TEXT    PRIMARY KEY,
  name        TEXT    NOT NULL,
  group_key   TEXT    NOT NULL DEFAULT '',
  variant     TEXT    NOT NULL DEFAULT '',
  endpoint    TEXT,
  blurb       TEXT    NOT NULL DEFAULT '',
  badge       TEXT    NOT NULL DEFAULT '',
  featured    INTEGER NOT NULL DEFAULT 0,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  favorites_count INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_breeds_name ON breeds(name);

CREATE TABLE IF NOT EXISTS facts (
  id     INTEGER PRIMARY KEY AUTOINCREMENT,
  stat   TEXT NOT NULL,
  unit   TEXT NOT NULL DEFAULT '',
  label  TEXT NOT NULL,
  body   TEXT NOT NULL,
  rot    TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS favorites (
  user_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  breed_id  TEXT    NOT NULL REFERENCES breeds(id) ON DELETE CASCADE,
  created_at TEXT   NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, breed_id)
);

CREATE TABLE IF NOT EXISTS ratings (
  breed_id   TEXT    NOT NULL REFERENCES breeds(id) ON DELETE CASCADE,
  score      INTEGER NOT NULL CHECK (score BETWEEN 1 AND 10),
  created_at TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_ratings_breed ON ratings(breed_id);

CREATE TABLE IF NOT EXISTS messages (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT    NOT NULL,
  email      TEXT    NOT NULL,
  body       TEXT    NOT NULL,
  created_at TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS meta (
  key   TEXT PRIMARY KEY,
  value TEXT
);
`);

/* ---------------------------------------------------------------- users */
const users = {
  create: db.prepare(
    `INSERT INTO users (email, full_name, password_hash) VALUES (@email, @full_name, @password_hash)`
  ),
  byEmail: db.prepare(`SELECT * FROM users WHERE email = ?`),
  byId: db.prepare(`SELECT id, email, full_name, created_at FROM users WHERE id = ?`),
};

/* ------------------------------------------------------------ sessions */
const sessions = {
  create: db.prepare(
    `INSERT INTO sessions (token, user_id, expires_at) VALUES (@token, @user_id, @expires_at)`
  ),
  touch: db.prepare(`UPDATE sessions SET expires_at = ? WHERE token = ?`),
  byToken: db.prepare(
    `SELECT s.token, s.user_id, s.expires_at, u.email, u.full_name
       FROM sessions s JOIN users u ON u.id = s.user_id
      WHERE s.token = ? AND s.expires_at > ?`
  ),
  deleteByToken: db.prepare(`DELETE FROM sessions WHERE token = ?`),
  deleteAllForUser: db.prepare(`DELETE FROM sessions WHERE user_id = ?`),
  purgeExpired: db.prepare(`DELETE FROM sessions WHERE expires_at <= ?`),
};

/* -------------------------------------------------------------- breeds */
const breeds = {
  insert: db.prepare(
    `INSERT INTO breeds (id, name, group_key, variant, endpoint, blurb, badge, featured, sort_order)
     VALUES (@id, @name, @group_key, @variant, @endpoint, @blurb, @badge, @featured, @sort_order)
     ON CONFLICT(id) DO UPDATE SET
       name = excluded.name, group_key = excluded.group_key, variant = excluded.variant,
       endpoint = excluded.endpoint, blurb = CASE WHEN breeds.blurb = '' THEN excluded.blurb ELSE breeds.blurb END,
       badge  = CASE WHEN breeds.badge = '' THEN excluded.badge ELSE breeds.badge END,
       featured = excluded.featured, sort_order = excluded.sort_order`
  ),
  all: db.prepare(`SELECT * FROM breeds ORDER BY sort_order, name`),
  byId: db.prepare(`SELECT * FROM breeds WHERE id = ?`),
  count: db.prepare(`SELECT COUNT(*) AS n FROM breeds`),
  featured: db.prepare(`SELECT * FROM breeds WHERE featured = 1 ORDER BY sort_order`),
  search: db.prepare(
    `SELECT * FROM breeds
      WHERE instr(lower(name), lower(@q)) > 0
         OR instr(lower(group_key), lower(@q)) > 0
         OR instr(lower(variant), lower(@q)) > 0
      ORDER BY sort_order, name
      LIMIT @limit OFFSET @offset`
  ),
  searchCount: db.prepare(
    `SELECT COUNT(*) AS n FROM breeds
      WHERE instr(lower(name), lower(@q)) > 0
         OR instr(lower(group_key), lower(@q)) > 0
         OR instr(lower(variant), lower(@q)) > 0`
  ),
};

/* --------------------------------------------------------------- facts */
const facts = {
  insert: db.prepare(`INSERT INTO facts (stat, unit, label, body, rot) VALUES (@stat, @unit, @label, @body, @rot)`),
  all: db.prepare(`SELECT * FROM facts ORDER BY id`),
  clear: db.prepare(`DELETE FROM facts`),
};

/* ----------------------------------------------------------- favorites */
const favorites = {
  add: db.prepare(
    `INSERT INTO favorites (user_id, breed_id) VALUES (@user_id, @breed_id)
     ON CONFLICT(user_id, breed_id) DO NOTHING`
  ),
  remove: db.prepare(`DELETE FROM favorites WHERE user_id = ? AND breed_id = ?`),
  listForUser: db.prepare(
    `SELECT b.* FROM favorites f JOIN breeds b ON b.id = f.breed_id
      WHERE f.user_id = ? ORDER BY f.created_at DESC`
  ),
  idsForUser: db.prepare(`SELECT breed_id FROM favorites WHERE user_id = ?`),
  has: db.prepare(`SELECT 1 FROM favorites WHERE user_id = ? AND breed_id = ?`),
  bumpBreed: db.prepare(`UPDATE breeds SET favorites_count = COALESCE(favorites_count, 0) + ? WHERE id = ?`),
};

/* ------------------------------------------------------------- ratings */
const ratings = {
  add: db.prepare(`INSERT INTO ratings (breed_id, score) VALUES (?, ?)`),
  stats: db.prepare(
    `SELECT breed_id, COUNT(*) AS votes, ROUND(AVG(score), 2) AS average
       FROM ratings GROUP BY breed_id`
  ),
  forBreed: db.prepare(
    `SELECT COUNT(*) AS votes, COALESCE(ROUND(AVG(score), 2), 0) AS average FROM ratings WHERE breed_id = ?`
  ),
};

/* ------------------------------------------------------------- messages */
const messages = {
  add: db.prepare(`INSERT INTO messages (name, email, body) VALUES (@name, @email, @body)`),
  latest: db.prepare(`SELECT id, name, email, body, created_at FROM messages ORDER BY id DESC LIMIT 50`),
  count: db.prepare(`SELECT COUNT(*) AS n FROM messages`),
};

/* ------------------------------------------------------------------------------------------------------------------------- meta */
const meta = {
  set: db.prepare(`INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`),
  get: db.prepare(`SELECT value FROM meta WHERE key = ?`),
};

const publicUser = (row) =>
  row ? { id: row.id, email: row.email, fullName: row.full_name, createdAt: row.created_at } : null;

const publicBreed = (row, extra = {}) =>
  row
    ? {
        id: row.id,
        name: row.name,
        groupKey: row.group_key,
        variant: row.variant,
        endpoint: row.endpoint,
        blurb: row.blurb,
        badge: row.badge,
        featured: !!row.featured,
        ...extra,
      }
    : null;

module.exports = {
  db,
  tables: { users, sessions, breeds, facts, favorites, ratings, messages, meta },
  publicUser,
  publicBreed,
};
