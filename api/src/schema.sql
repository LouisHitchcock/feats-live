CREATE TABLE IF NOT EXISTS articles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  url_id TEXT UNIQUE NOT NULL,
  body TEXT NOT NULL,
  excerpt TEXT DEFAULT '',
  author TEXT DEFAULT 'Feats.',
  publish_date TEXT NOT NULL,
  categories TEXT DEFAULT '',
  tags TEXT DEFAULT '',
  cover_url TEXT DEFAULT '',
  status TEXT DEFAULT 'publish',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS writers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  photo_url TEXT DEFAULT '',
  bio TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now'))
);
