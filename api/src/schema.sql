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


-- Admin users table
CREATE TABLE IF NOT EXISTS admin_users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'admin',
  google_id TEXT UNIQUE,
  avatar_url TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now')),
  last_login TEXT
);

-- Default admin (first-time login uses this as a seed)
INSERT OR IGNORE INTO admin_users (email, name, role) VALUES ('louishitchcock@gmail.com', 'Louis Hitchcock', 'superadmin');

-- Analytics page views table
CREATE TABLE IF NOT EXISTS page_views (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  article_id INTEGER,
  page_url TEXT NOT NULL,
  visitor_ip TEXT,
  user_agent TEXT,
  country TEXT,
  city TEXT,
  viewed_at TEXT DEFAULT (datetime('now'))
);

-- Article engagement table
CREATE TABLE IF NOT EXISTS article_engagement (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  article_id INTEGER NOT NULL,
  views INTEGER DEFAULT 0,
  unique_visitors INTEGER DEFAULT 0,
  date TEXT NOT NULL,
  UNIQUE(article_id, date)
);
