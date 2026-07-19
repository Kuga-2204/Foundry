import "dotenv/config";
import pg from "pg";

const { Pool, types } = pg;

const timestampParser = (value) => new Date(value).toISOString().replace(/\.\d{3}Z$/, "Z");
types.setTypeParser(1114, timestampParser);
types.setTypeParser(1184, timestampParser);

const connectionString =
  process.env.SUPABASE_DB_URL ||
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL;

if (!connectionString) {
  throw new Error(
    "Set SUPABASE_DB_URL (or DATABASE_URL/POSTGRES_URL) to your Supabase Postgres connection string."
  );
}

const pool = new Pool({
  connectionString,
  ssl: process.env.DB_SSL === "false" ? false : { rejectUnauthorized: false },
});

function normalizeValue(value) {
  if (typeof value !== "string" || value === "") return value;
  if (!/^-?\d+(\.\d+)?$/.test(value)) return value;
  const number = Number(value);
  return Number.isSafeInteger(number) || value.includes(".") ? number : value;
}

function normalizeRow(row) {
  if (!row) return row;
  return Object.fromEntries(Object.entries(row).map(([key, value]) => [key, normalizeValue(value)]));
}

function toPostgresSql(sql) {
  let i = 0;
  let pgSql = sql.replace(/\?/g, () => `$${++i}`);
  pgSql = pgSql.replace(
    /INSERT\s+OR\s+IGNORE\s+INTO\s+(.+?)\s+VALUES\s*\((.+?)\)/is,
    "INSERT INTO $1 VALUES ($2) ON CONFLICT DO NOTHING"
  );
  pgSql = pgSql.replace(/\bLIKE\b/g, "ILIKE");
  return pgSql;
}

function shouldReturnId(sql) {
  return /^\s*INSERT\b/i.test(sql) && !/\bRETURNING\b/i.test(sql);
}

const db = {
  async exec(sql) {
    await pool.query(sql);
  },
  prepare(sql) {
    return {
      async all(...params) {
        const result = await pool.query(toPostgresSql(sql), params);
        return result.rows.map(normalizeRow);
      },
      async get(...params) {
        const result = await pool.query(toPostgresSql(sql), params);
        return normalizeRow(result.rows[0]);
      },
      async run(...params) {
        const query = toPostgresSql(shouldReturnId(sql) ? `${sql} RETURNING id` : sql);
        const result = await pool.query(query, params);
        return {
          changes: result.rowCount,
          lastInsertRowid: result.rows[0]?.id,
        };
      },
    };
  },
  async close() {
    await pool.end();
  },
};

export async function initDb() {
  await db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  bio TEXT DEFAULT '',
  google_id TEXT,
  anon_handle TEXT UNIQUE,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS problems (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'General',
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','building','solved')),
  is_anonymous INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS votes (
  id SERIAL PRIMARY KEY,
  problem_id INTEGER NOT NULL REFERENCES problems(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  vote_type INTEGER NOT NULL CHECK (vote_type IN (1, -1)),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(problem_id, user_id)
);

CREATE TABLE IF NOT EXISTS startups (
  id SERIAL PRIMARY KEY,
  owner_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  tagline TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  website TEXT DEFAULT '',
  category TEXT NOT NULL DEFAULT 'General',
  claimed INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS startup_statements (
  id SERIAL PRIMARY KEY,
  startup_id INTEGER NOT NULL REFERENCES startups(id) ON DELETE CASCADE,
  statement TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS solutions (
  id SERIAL PRIMARY KEY,
  problem_id INTEGER NOT NULL REFERENCES problems(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  startup_id INTEGER REFERENCES startups(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  link TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS reviews (
  id SERIAL PRIMARY KEY,
  solution_id INTEGER NOT NULL REFERENCES solutions(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  outcome TEXT CHECK (outcome IN ('solved','partial','unsolved')),
  feedback TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(solution_id, user_id)
);

CREATE TABLE IF NOT EXISTS problem_followers (
  id SERIAL PRIMARY KEY,
  problem_id INTEGER NOT NULL REFERENCES problems(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(problem_id, user_id)
);

CREATE TABLE IF NOT EXISTS commitments (
  id SERIAL PRIMARY KEY,
  problem_id INTEGER NOT NULL REFERENCES problems(id) ON DELETE CASCADE,
  startup_id INTEGER NOT NULL REFERENCES startups(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'building' CHECK (status IN ('building','shipped')),
  note TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(problem_id, startup_id)
);

CREATE TABLE IF NOT EXISTS notifications (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  message TEXT NOT NULL,
  link TEXT DEFAULT '',
  read INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS comments (
  id SERIAL PRIMARY KEY,
  problem_id INTEGER NOT NULL REFERENCES problems(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  startup_id INTEGER REFERENCES startups(id) ON DELETE SET NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS problem_media (
  id SERIAL PRIMARY KEY,
  problem_id INTEGER NOT NULL REFERENCES problems(id) ON DELETE CASCADE,
  file TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('image','video')),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS events (
  id SERIAL PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('profile_view','search_match')),
  startup_id INTEGER NOT NULL REFERENCES startups(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_events_startup ON events(startup_id, type, created_at);

CREATE TABLE IF NOT EXISTS password_resets (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_resets_token ON password_resets(token_hash);

CREATE TABLE IF NOT EXISTS reports (
  id SERIAL PRIMARY KEY,
  reporter_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  target_type TEXT NOT NULL CHECK (target_type IN ('problem','comment')),
  target_id INTEGER NOT NULL,
  reason TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Every problem list aggregates counts across these tables. Without an index
-- on the foreign key, Postgres sequentially scans the whole table for each
-- aggregate, which gets slow as soon as there is real data.
CREATE INDEX IF NOT EXISTS idx_votes_problem       ON votes(problem_id);
CREATE INDEX IF NOT EXISTS idx_votes_user          ON votes(user_id);
CREATE INDEX IF NOT EXISTS idx_followers_problem   ON problem_followers(problem_id);
CREATE INDEX IF NOT EXISTS idx_followers_user      ON problem_followers(user_id);
CREATE INDEX IF NOT EXISTS idx_solutions_problem   ON solutions(problem_id);
CREATE INDEX IF NOT EXISTS idx_solutions_startup   ON solutions(startup_id);
CREATE INDEX IF NOT EXISTS idx_comments_problem    ON comments(problem_id);
CREATE INDEX IF NOT EXISTS idx_media_problem       ON problem_media(problem_id);
CREATE INDEX IF NOT EXISTS idx_reviews_solution    ON reviews(solution_id);
CREATE INDEX IF NOT EXISTS idx_commitments_problem ON commitments(problem_id);
CREATE INDEX IF NOT EXISTS idx_commitments_startup ON commitments(startup_id);
CREATE INDEX IF NOT EXISTS idx_statements_startup  ON startup_statements(startup_id);
CREATE INDEX IF NOT EXISTS idx_problems_user       ON problems(user_id);
CREATE INDEX IF NOT EXISTS idx_problems_created    ON problems(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user  ON notifications(user_id, read);
`);
}

export default db;
