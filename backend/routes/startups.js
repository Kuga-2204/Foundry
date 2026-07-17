import { Router } from "express";
import db from "../db/index.js";
import { requireAuth, optionalAuth } from "../middleware/auth.js";
import { matchProblemsForStartup } from "../lib/match.js";

const router = Router();

function validLink(link) {
  return !link || /^https?:\/\//i.test(link);
}

function cleanStatements(raw) {
  if (!Array.isArray(raw)) return null;
  const cleaned = raw.map((s) => String(s || "").trim()).filter(Boolean);
  if (cleaned.length < 1 || cleaned.length > 10) return null;
  return cleaned;
}

function attachMeta(startup, userId) {
  const statements = db
    .prepare("SELECT id, statement FROM startup_statements WHERE startup_id = ?")
    .all(startup.id);

  const ratings = db
    .prepare(
      `SELECT COUNT(*) AS c, COALESCE(AVG(r.rating), 0) AS avg,
              COALESCE(SUM(CASE WHEN r.outcome = 'solved' THEN 1 ELSE 0 END), 0) AS solved
       FROM reviews r JOIN solutions s ON s.id = r.solution_id
       WHERE s.startup_id = ?`
    )
    .get(startup.id);

  const solutionCount = db
    .prepare("SELECT COUNT(*) AS c FROM solutions WHERE startup_id = ?")
    .get(startup.id).c;

  const commitmentCount = db
    .prepare("SELECT COUNT(*) AS c FROM commitments WHERE startup_id = ?")
    .get(startup.id).c;

  return {
    ...startup,
    claimed: !!startup.claimed,
    isOwner: !!userId && startup.owner_user_id === userId,
    statements,
    solutionCount,
    commitmentCount,
    reviewCount: ratings.c,
    avgRating: Math.round(ratings.avg * 10) / 10,
    solvedCount: ratings.solved,
  };
}

router.get("/", optionalAuth, (req, res) => {
  const { category, search, claimed } = req.query;
  let sql = "SELECT * FROM startups WHERE 1=1";
  const params = [];
  if (category && category !== "All") {
    sql += " AND category = ?";
    params.push(category);
  }
  if (search) {
    sql += " AND (name LIKE ? OR tagline LIKE ? OR description LIKE ?)";
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }
  if (claimed === "true") sql += " AND claimed = 1";
  sql += " ORDER BY claimed DESC, name COLLATE NOCASE ASC";

  const rows = db.prepare(sql).all(...params);
  res.json({ startups: rows.map((s) => attachMeta(s, req.userId)) });
});

router.get("/mine", requireAuth, (req, res) => {
  const rows = db.prepare("SELECT * FROM startups WHERE owner_user_id = ?").all(req.userId);
  res.json({ startups: rows.map((s) => attachMeta(s, req.userId)) });
});

router.post("/", requireAuth, (req, res) => {
  const { name, tagline, description, website, category, statements } = req.body;
  if (!name?.trim() || !tagline?.trim() || !description?.trim()) {
    return res.status(400).json({ error: "Name, tagline, and description are required." });
  }
  if (!validLink((website || "").trim())) {
    return res.status(400).json({ error: "Website must start with http:// or https://." });
  }
  const cleaned = cleanStatements(statements);
  if (!cleaned) {
    return res
      .status(400)
      .json({ error: "Add 1 to 10 'problems we solve' statements, in plain user language." });
  }

  const info = db
    .prepare(
      `INSERT INTO startups (owner_user_id, name, tagline, description, website, category, claimed)
       VALUES (?, ?, ?, ?, ?, ?, 1)`
    )
    .run(
      req.userId,
      name.trim(),
      tagline.trim(),
      description.trim(),
      (website || "").trim(),
      (category || "General").trim()
    );

  const insertStatement = db.prepare(
    "INSERT INTO startup_statements (startup_id, statement) VALUES (?, ?)"
  );
  for (const s of cleaned) insertStatement.run(info.lastInsertRowid, s);

  const row = db.prepare("SELECT * FROM startups WHERE id = ?").get(info.lastInsertRowid);
  res.status(201).json({ startup: attachMeta(row, req.userId) });
});

router.get("/:id", optionalAuth, (req, res) => {
  const row = db.prepare("SELECT * FROM startups WHERE id = ?").get(req.params.id);
  if (!row) return res.status(404).json({ error: "Startup not found." });

  const solutions = db
    .prepare(
      `SELECT s.*, u.name AS author_name, p.title AS problem_title,
              (SELECT COUNT(*) FROM reviews r WHERE r.solution_id = s.id) AS reviewCount,
              (SELECT COALESCE(AVG(r.rating), 0) FROM reviews r WHERE r.solution_id = s.id) AS avgRating
       FROM solutions s
       JOIN users u ON u.id = s.user_id
       JOIN problems p ON p.id = s.problem_id
       WHERE s.startup_id = ? ORDER BY s.created_at DESC`
    )
    .all(req.params.id)
    .map((s) => ({ ...s, avgRating: Math.round(s.avgRating * 10) / 10 }));

  const commitments = db
    .prepare(
      `SELECT c.*, p.title AS problem_title, p.status AS problem_status
       FROM commitments c JOIN problems p ON p.id = c.problem_id
       WHERE c.startup_id = ? ORDER BY c.created_at DESC`
    )
    .all(req.params.id);

  res.json({ startup: attachMeta(row, req.userId), solutions, commitments });
});

router.put("/:id", requireAuth, (req, res) => {
  const startup = db.prepare("SELECT * FROM startups WHERE id = ?").get(req.params.id);
  if (!startup) return res.status(404).json({ error: "Startup not found." });
  if (startup.owner_user_id !== req.userId) {
    return res.status(403).json({ error: "Only the owner can edit this startup." });
  }

  const { name, tagline, description, website, category, statements } = req.body;
  if (!name?.trim() || !tagline?.trim() || !description?.trim()) {
    return res.status(400).json({ error: "Name, tagline, and description are required." });
  }
  if (!validLink((website || "").trim())) {
    return res.status(400).json({ error: "Website must start with http:// or https://." });
  }
  const cleaned = cleanStatements(statements);
  if (!cleaned) {
    return res
      .status(400)
      .json({ error: "Add 1 to 10 'problems we solve' statements, in plain user language." });
  }

  db.prepare(
    `UPDATE startups SET name = ?, tagline = ?, description = ?, website = ?, category = ?
     WHERE id = ?`
  ).run(
    name.trim(),
    tagline.trim(),
    description.trim(),
    (website || "").trim(),
    (category || "General").trim(),
    req.params.id
  );

  db.prepare("DELETE FROM startup_statements WHERE startup_id = ?").run(req.params.id);
  const insertStatement = db.prepare(
    "INSERT INTO startup_statements (startup_id, statement) VALUES (?, ?)"
  );
  for (const s of cleaned) insertStatement.run(req.params.id, s);

  const row = db.prepare("SELECT * FROM startups WHERE id = ?").get(req.params.id);
  res.json({ startup: attachMeta(row, req.userId) });
});

// Claim an unclaimed (seeded) startup profile. In production this needs a
// verification step (work email on the startup's domain, or manual review).
router.post("/:id/claim", requireAuth, (req, res) => {
  const startup = db.prepare("SELECT * FROM startups WHERE id = ?").get(req.params.id);
  if (!startup) return res.status(404).json({ error: "Startup not found." });
  if (startup.claimed) return res.status(409).json({ error: "This startup is already claimed." });

  db.prepare("UPDATE startups SET owner_user_id = ?, claimed = 1 WHERE id = ?").run(
    req.userId,
    req.params.id
  );
  const row = db.prepare("SELECT * FROM startups WHERE id = ?").get(req.params.id);
  res.json({ startup: attachMeta(row, req.userId) });
});

// Lead feed for the startup dashboard: problems that match what this startup
// solves (strong) plus adjacent problems in its space (roadmap signal).
router.get("/:id/leads", requireAuth, (req, res) => {
  const startup = db.prepare("SELECT * FROM startups WHERE id = ?").get(req.params.id);
  if (!startup) return res.status(404).json({ error: "Startup not found." });
  if (startup.owner_user_id !== req.userId) {
    return res.status(403).json({ error: "Only the owner can view this startup's leads." });
  }

  const problemMeta = db.prepare(
    `SELECT
       COALESCE(SUM(CASE WHEN vote_type = 1 THEN 1 ELSE 0 END), 0) AS up,
       COALESCE(SUM(CASE WHEN vote_type = -1 THEN 1 ELSE 0 END), 0) AS down
     FROM votes WHERE problem_id = ?`
  );
  const followerCount = db.prepare(
    "SELECT COUNT(*) AS c FROM problem_followers WHERE problem_id = ?"
  );

  const decorate = (m) => {
    const v = problemMeta.get(m.problem.id);
    return {
      ...m.problem,
      score: v.up - v.down,
      followerCount: followerCount.get(m.problem.id).c,
      matchScore: m.score,
      matchedTerms: m.matchedTerms,
    };
  };

  const { strong, adjacent } = matchProblemsForStartup(req.params.id);
  res.json({ strong: strong.map(decorate), adjacent: adjacent.map(decorate) });
});

export default router;
