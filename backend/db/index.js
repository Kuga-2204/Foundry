import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const db = new Database(path.join(__dirname, "problemhub.sqlite"));

db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

// ISO-8601 UTC with explicit Z so every client parses it the same way.
const NOW = "(strftime('%Y-%m-%dT%H:%M:%SZ','now'))";

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  bio TEXT DEFAULT '',
  created_at TEXT DEFAULT ${NOW}
);

CREATE TABLE IF NOT EXISTS problems (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'General',
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','building','solved')),
  created_at TEXT DEFAULT ${NOW}
);

CREATE TABLE IF NOT EXISTS votes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  problem_id INTEGER NOT NULL REFERENCES problems(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  vote_type INTEGER NOT NULL CHECK (vote_type IN (1, -1)),
  created_at TEXT DEFAULT ${NOW},
  UNIQUE(problem_id, user_id)
);

CREATE TABLE IF NOT EXISTS solutions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  problem_id INTEGER NOT NULL REFERENCES problems(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  startup_id INTEGER REFERENCES startups(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  link TEXT DEFAULT '',
  created_at TEXT DEFAULT ${NOW}
);

CREATE TABLE IF NOT EXISTS reviews (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  solution_id INTEGER NOT NULL REFERENCES solutions(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  outcome TEXT CHECK (outcome IN ('solved','partial','unsolved')),
  feedback TEXT DEFAULT '',
  created_at TEXT DEFAULT ${NOW},
  UNIQUE(solution_id, user_id)
);

CREATE TABLE IF NOT EXISTS startups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  tagline TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  website TEXT DEFAULT '',
  category TEXT NOT NULL DEFAULT 'General',
  claimed INTEGER NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT ${NOW}
);

CREATE TABLE IF NOT EXISTS startup_statements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  startup_id INTEGER NOT NULL REFERENCES startups(id) ON DELETE CASCADE,
  statement TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS problem_followers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  problem_id INTEGER NOT NULL REFERENCES problems(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT DEFAULT ${NOW},
  UNIQUE(problem_id, user_id)
);

CREATE TABLE IF NOT EXISTS commitments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  problem_id INTEGER NOT NULL REFERENCES problems(id) ON DELETE CASCADE,
  startup_id INTEGER NOT NULL REFERENCES startups(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'building' CHECK (status IN ('building','shipped')),
  note TEXT DEFAULT '',
  created_at TEXT DEFAULT ${NOW},
  UNIQUE(problem_id, startup_id)
);

CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  message TEXT NOT NULL,
  link TEXT DEFAULT '',
  read INTEGER NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT ${NOW}
);

CREATE TABLE IF NOT EXISTS comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  problem_id INTEGER NOT NULL REFERENCES problems(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  startup_id INTEGER REFERENCES startups(id) ON DELETE SET NULL,
  body TEXT NOT NULL,
  created_at TEXT DEFAULT ${NOW}
);

CREATE TABLE IF NOT EXISTS problem_media (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  problem_id INTEGER NOT NULL REFERENCES problems(id) ON DELETE CASCADE,
  file TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('image','video')),
  created_at TEXT DEFAULT ${NOW}
);

CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL CHECK (type IN ('profile_view','search_match')),
  startup_id INTEGER NOT NULL REFERENCES startups(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT DEFAULT ${NOW}
);
CREATE INDEX IF NOT EXISTS idx_events_startup ON events(startup_id, type, created_at);
`);

// Migrations for databases created before the startup-matching pivot.
// "duplicate column name" errors mean the column already exists; ignore them.
const MIGRATIONS = [
  "ALTER TABLE problems ADD COLUMN status TEXT NOT NULL DEFAULT 'open'",
  "ALTER TABLE solutions ADD COLUMN startup_id INTEGER REFERENCES startups(id) ON DELETE SET NULL",
  "ALTER TABLE reviews ADD COLUMN outcome TEXT",
  "ALTER TABLE problems ADD COLUMN is_anonymous INTEGER NOT NULL DEFAULT 0",
];
for (const sql of MIGRATIONS) {
  try {
    db.exec(sql);
  } catch (err) {
    if (!String(err.message).includes("duplicate column name")) throw err;
  }
}

export default db;
