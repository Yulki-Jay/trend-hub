const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DATA_DIR = path.join(process.cwd(), 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new Database(path.join(DATA_DIR, 'trendhub.db'));
db.pragma('journal_mode = WAL');

db.exec(`
CREATE TABLE IF NOT EXISTS repos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  full_name TEXT NOT NULL,
  url TEXT NOT NULL,
  author TEXT,
  name TEXT,
  description TEXT,
  language TEXT,
  stars INTEGER DEFAULT 0,
  forks INTEGER DEFAULT 0,
  today_stars INTEGER DEFAULT 0,
  range TEXT DEFAULT 'daily',
  rank INTEGER,
  fetched_date TEXT,
  created_at TEXT DEFAULT (datetime('now','localtime')),
  UNIQUE(full_name, range, fetched_date)
);

CREATE TABLE IF NOT EXISTS developers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  login TEXT NOT NULL,
  name TEXT,
  url TEXT NOT NULL,
  avatar TEXT,
  repo_name TEXT,
  repo_url TEXT,
  repo_desc TEXT,
  range TEXT DEFAULT 'daily',
  rank INTEGER,
  fetched_date TEXT,
  created_at TEXT DEFAULT (datetime('now','localtime')),
  UNIQUE(login, range, fetched_date)
);

CREATE TABLE IF NOT EXISTS explore_repos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  full_name TEXT NOT NULL UNIQUE,
  url TEXT NOT NULL,
  author TEXT,
  name TEXT,
  description TEXT,
  language TEXT,
  topics TEXT DEFAULT '[]',
  category TEXT DEFAULT 'other',
  stars INTEGER DEFAULT 0,
  forks INTEGER DEFAULT 0,
  open_issues INTEGER DEFAULT 0,
  growth_7d INTEGER DEFAULT 0,
  score REAL DEFAULT 0,
  reason TEXT,
  license TEXT,
  repo_created_at TEXT,
  pushed_at TEXT,
  fetched_date TEXT,
  created_at TEXT DEFAULT (datetime('now','localtime')),
  updated_at TEXT DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS repo_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  full_name TEXT NOT NULL,
  stars INTEGER DEFAULT 0,
  forks INTEGER DEFAULT 0,
  captured_date TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now','localtime')),
  UNIQUE(full_name, captured_date)
);

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT COLLATE NOCASE UNIQUE,
  email TEXT NOT NULL COLLATE NOCASE UNIQUE,
  display_name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT DEFAULT 'user',
  disabled INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now','localtime')),
  updated_at TEXT DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS user_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at INTEGER NOT NULL,
  created_at TEXT DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS user_favorites (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  item_type TEXT NOT NULL,
  item_key TEXT NOT NULL,
  item_data TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now','localtime')),
  UNIQUE(user_id, item_type, item_key)
);

CREATE TABLE IF NOT EXISTS user_dismissals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  item_type TEXT NOT NULL,
  item_key TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now','localtime')),
  UNIQUE(user_id, item_type, item_key)
);

CREATE TABLE IF NOT EXISTS news (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  url TEXT NOT NULL UNIQUE,
  summary TEXT,
  category TEXT,
  source TEXT,
  image TEXT,
  published_at TEXT,
  created_at TEXT DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS papers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  url TEXT NOT NULL UNIQUE,
  summary TEXT,
  authors TEXT,
  category TEXT,
  source TEXT DEFAULT 'arXiv',
  stars INTEGER DEFAULT 0,
  citations INTEGER DEFAULT 0,
  influential_citations INTEGER DEFAULT 0,
  venue TEXT,
  year INTEGER,
  published_at TEXT,
  created_at TEXT DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS sources (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  type TEXT DEFAULT 'rss',
  url TEXT NOT NULL,
  category TEXT DEFAULT 'tech',
  enabled INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT
);

CREATE TABLE IF NOT EXISTS recipients (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  enabled INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS job_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  job TEXT,
  status TEXT,
  message TEXT,
  count INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now','localtime'))
);

CREATE INDEX IF NOT EXISTS idx_explore_repos_date_score
  ON explore_repos(fetched_date, score DESC);
CREATE INDEX IF NOT EXISTS idx_repo_snapshots_name_date
  ON repo_snapshots(full_name, captured_date);
CREATE INDEX IF NOT EXISTS idx_user_sessions_token
  ON user_sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_user_favorites_user_type
  ON user_favorites(user_id, item_type);
CREATE INDEX IF NOT EXISTS idx_user_dismissals_user_type
  ON user_dismissals(user_id, item_type);
`);

// 轻量迁移：为已存在的旧表补充新列
function ensureColumn(table, column, ddl) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all();
  if (!cols.some((c) => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
  }
}
ensureColumn('papers', 'citations', 'citations INTEGER DEFAULT 0');
ensureColumn('papers', 'influential_citations', 'influential_citations INTEGER DEFAULT 0');
ensureColumn('papers', 'venue', 'venue TEXT');
ensureColumn('papers', 'year', 'year INTEGER');
ensureColumn('users', 'username', 'username TEXT COLLATE NOCASE');
ensureColumn('users', 'disabled', 'disabled INTEGER DEFAULT 0');

db.exec(`
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username
  ON users(username COLLATE NOCASE);
`);

module.exports = db;
