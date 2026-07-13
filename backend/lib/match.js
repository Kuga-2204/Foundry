import db from "../db/index.js";

// Lightweight text matcher between a user's problem text and each startup's
// "problems we solve" statements. Statements are written in plain user
// language during startup onboarding precisely so this overlap works.

const STOPWORDS = new Set(
  `a an and are as at be been but by can cant could did do does doing dont for
   from get gets getting got had has have having how i if in into is it its im
   just like make makes making me my need no not now of on one or our out over
   really so some something still than that the their them then there these
   they this to too try trying up us use used using very want wants was way we
   were what when where which while who why will with would you your youre
   always never every everyone people person day daily easy easier hard find
   finding lot much many keep keeps way ways thing things time`.split(/\s+/)
);

export function tokenize(text) {
  return String(text || "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 3 && !STOPWORDS.has(t))
    .map((t) => (t.length > 4 && t.endsWith("s") ? t.slice(0, -1) : t));
}

// Build a weighted token index for one startup. Statement tokens carry the
// most weight because they are written in problem language.
function startupIndex(startup, statements) {
  const weights = new Map();
  const add = (text, weight) => {
    for (const tok of tokenize(text)) {
      weights.set(tok, Math.max(weights.get(tok) || 0, weight));
    }
  };
  for (const s of statements) add(s.statement, 3);
  add(startup.tagline, 2);
  add(startup.name, 1);
  add(startup.category, 1);
  add(startup.description, 1);
  return weights;
}

function loadStartupsWithStatements() {
  const startups = db.prepare("SELECT * FROM startups").all();
  const statements = db.prepare("SELECT * FROM startup_statements").all();
  const byStartup = new Map();
  for (const s of statements) {
    if (!byStartup.has(s.startup_id)) byStartup.set(s.startup_id, []);
    byStartup.get(s.startup_id).push(s);
  }
  return startups.map((st) => ({
    startup: st,
    statements: byStartup.get(st.id) || [],
  }));
}

// Score every startup against a piece of problem text.
// Returns strong matches ("likely solves this") and adjacent matches
// ("works in this space"), each with the terms that matched.
export function matchStartups(text, { limit = 6 } = {}) {
  const problemTokens = [...new Set(tokenize(text))];
  if (problemTokens.length === 0) return { strong: [], adjacent: [] };

  const scored = [];
  for (const { startup, statements } of loadStartupsWithStatements()) {
    const index = startupIndex(startup, statements);
    let score = 0;
    const matchedTerms = [];
    let statementHits = 0;
    for (const tok of problemTokens) {
      const w = index.get(tok);
      if (w) {
        score += w;
        matchedTerms.push(tok);
        if (w === 3) statementHits++;
      }
    }
    if (matchedTerms.length === 0) continue;
    scored.push({ startup, score, matchedTerms, statementHits });
  }

  scored.sort((a, b) => b.score - a.score);

  const strong = [];
  const adjacent = [];
  for (const m of scored) {
    const isStrong = m.statementHits >= 2 || (m.statementHits >= 1 && m.matchedTerms.length >= 3);
    if (isStrong && strong.length < limit) strong.push(m);
    else if (!isStrong && m.matchedTerms.length >= 2 && adjacent.length < limit) adjacent.push(m);
  }
  return { strong, adjacent };
}

// Inverse direction: score every problem against one startup, for the
// startup dashboard's lead feed.
export function matchProblemsForStartup(startupId, { limit = 25 } = {}) {
  const startup = db.prepare("SELECT * FROM startups WHERE id = ?").get(startupId);
  if (!startup) return { strong: [], adjacent: [] };
  const statements = db
    .prepare("SELECT * FROM startup_statements WHERE startup_id = ?")
    .all(startupId);
  const index = startupIndex(startup, statements);

  const problems = db
    .prepare("SELECT p.*, u.name AS author_name FROM problems p JOIN users u ON u.id = p.user_id")
    .all();

  const scored = [];
  for (const p of problems) {
    const tokens = [...new Set(tokenize(`${p.title} ${p.description}`))];
    let score = 0;
    const matchedTerms = [];
    let statementHits = 0;
    for (const tok of tokens) {
      const w = index.get(tok);
      if (w) {
        score += w;
        matchedTerms.push(tok);
        if (w === 3) statementHits++;
      }
    }
    if (matchedTerms.length === 0) continue;
    scored.push({ problem: p, score, matchedTerms, statementHits });
  }

  scored.sort((a, b) => b.score - a.score);

  const strong = [];
  const adjacent = [];
  for (const m of scored) {
    const isStrong = m.statementHits >= 2 || (m.statementHits >= 1 && m.matchedTerms.length >= 3);
    if (isStrong && strong.length < limit) strong.push(m);
    else if (!isStrong && m.matchedTerms.length >= 2 && adjacent.length < limit) adjacent.push(m);
  }
  return { strong, adjacent };
}
