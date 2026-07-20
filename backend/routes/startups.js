import { Router } from "express";
import db from "../db/index.js";
import { requireAuth, optionalAuth } from "../middleware/auth.js";
import { matchProblemsForStartup } from "../lib/match.js";
import { maskAnonymous } from "../lib/anon.js";
import { moderate } from "../lib/moderate.js";
import { track, statsFor } from "../lib/track.js";

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

async function attachMeta(startup, userId) {
  const statements = await db
    .prepare("SELECT id, statement FROM startup_statements WHERE startup_id = ?")
    .all(startup.id);

  const ratings = await db
    .prepare(
      `SELECT COUNT(*) AS c, COALESCE(AVG(r.rating), 0) AS avg,
              COALESCE(SUM(CASE WHEN r.outcome = 'solved' THEN 1 ELSE 0 END), 0) AS solved
       FROM reviews r JOIN solutions s ON s.id = r.solution_id
       WHERE s.startup_id = ?`
    )
    .get(startup.id);

  const solutionCount = (await db
    .prepare("SELECT COUNT(*) AS c FROM solutions WHERE startup_id = ?")
    .get(startup.id)).c;

  const commitmentCount = (await db
    .prepare("SELECT COUNT(*) AS c FROM commitments WHERE startup_id = ?")
    .get(startup.id)).c;

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

router.get("/", optionalAuth, async (req, res) => {
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
  sql += " ORDER BY claimed DESC, LOWER(name) ASC";

  const rows = await db.prepare(sql).all(...params);
  const startups = [];
  for (const s of rows) startups.push(await attachMeta(s, req.userId));
  res.json({ startups });
});

router.get("/mine", requireAuth, async (req, res) => {
  const rows = await db.prepare("SELECT * FROM startups WHERE owner_user_id = ?").all(req.userId);
  const startups = [];
  for (const s of rows) startups.push(await attachMeta(s, req.userId));
  res.json({ startups });
});

router.post("/", requireAuth, async (req, res) => {
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

  const flagged = moderate(name, tagline, description, ...cleaned);
  if (flagged) return res.status(400).json({ error: flagged });

  const info = await db
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
  for (const s of cleaned) await insertStatement.run(info.lastInsertRowid, s);

  const row = await db.prepare("SELECT * FROM startups WHERE id = ?").get(info.lastInsertRowid);
  res.status(201).json({ startup: await attachMeta(row, req.userId) });
});

router.get("/:id", optionalAuth, async (req, res) => {
  const row = await db.prepare("SELECT * FROM startups WHERE id = ?").get(req.params.id);
  if (!row) return res.status(404).json({ error: "Startup not found." });

  // Analytics must never block a profile view. If tracking has a transient
  // database issue, the startup page should still load normally.
  if (row.owner_user_id !== req.userId) {
    track("profile_view", row.id, req.userId).catch((err) =>
      console.warn("profile_view tracking failed", err)
    );
  }

  const solutions = (await db
    .prepare(
      `SELECT s.*, u.name AS author_name, p.title AS problem_title,
              (SELECT COUNT(*) FROM reviews r WHERE r.solution_id = s.id) AS reviewCount,
              (SELECT COALESCE(AVG(r.rating), 0) FROM reviews r WHERE r.solution_id = s.id) AS avgRating
       FROM solutions s
       JOIN users u ON u.id = s.user_id
       JOIN problems p ON p.id = s.problem_id
       WHERE s.startup_id = ? ORDER BY s.created_at DESC`
    )
    .all(req.params.id))
    .map((s) => ({ ...s, avgRating: Math.round(s.avgRating * 10) / 10 }));

  const commitments = await db
    .prepare(
      `SELECT c.*, p.title AS problem_title, p.status AS problem_status
       FROM commitments c JOIN problems p ON p.id = c.problem_id
       WHERE c.startup_id = ? ORDER BY c.created_at DESC`
    )
    .all(req.params.id);

  res.json({ startup: await attachMeta(row, req.userId), solutions, commitments });
});

router.put("/:id", requireAuth, async (req, res) => {
  const startup = await db.prepare("SELECT * FROM startups WHERE id = ?").get(req.params.id);
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

  const flagged = moderate(name, tagline, description, ...cleaned);
  if (flagged) return res.status(400).json({ error: flagged });

  await db.prepare(
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

  await db.prepare("DELETE FROM startup_statements WHERE startup_id = ?").run(req.params.id);
  const insertStatement = db.prepare(
    "INSERT INTO startup_statements (startup_id, statement) VALUES (?, ?)"
  );
  for (const s of cleaned) await insertStatement.run(req.params.id, s);

  const row = await db.prepare("SELECT * FROM startups WHERE id = ?").get(req.params.id);
  res.json({ startup: await attachMeta(row, req.userId) });
});

// Claim an unclaimed (seeded) startup profile. In production this needs a
// verification step (work email on the startup's domain, or manual review).
router.post("/:id/claim", requireAuth, async (req, res) => {
  const startup = await db.prepare("SELECT * FROM startups WHERE id = ?").get(req.params.id);
  if (!startup) return res.status(404).json({ error: "Startup not found." });
  if (startup.claimed) return res.status(409).json({ error: "This startup is already claimed." });

  try {
    await db.prepare("UPDATE startups SET owner_user_id = ?, claimed = 1 WHERE id = ?").run(
      req.userId,
      req.params.id
    );
  } catch (err) {
    console.error("startup claim failed:", err.message);
    return res.status(500).json({
      error: "We couldn't claim this startup right now. Please try again in a moment.",
    });
  }

  const row = await db.prepare("SELECT * FROM startups WHERE id = ?").get(req.params.id);
  if (!row || !row.claimed || row.owner_user_id !== req.userId) {
    return res.status(409).json({ error: "This startup could not be claimed. Refresh and try again." });
  }
  res.json({ startup: await attachMeta(row, req.userId) });
});

// Reach stats for the startup dashboard: profile visits and how often this
// startup surfaced while people typed problems it covers.
router.get("/:id/stats", requireAuth, async (req, res) => {
  const startup = await db.prepare("SELECT * FROM startups WHERE id = ?").get(req.params.id);
  if (!startup) return res.status(404).json({ error: "Startup not found." });
  if (startup.owner_user_id !== req.userId) {
    return res.status(403).json({ error: "Only the owner can view this startup's stats." });
  }
  res.json({ stats: await statsFor(startup.id) });
});

// Lead feed for the startup dashboard: problems that match what this startup
// solves (strong) plus adjacent problems in its space (roadmap signal).
router.get("/:id/leads", requireAuth, async (req, res) => {
  const startup = await db.prepare("SELECT * FROM startups WHERE id = ?").get(req.params.id);
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

  const decorate = async (m) => {
    const v = await problemMeta.get(m.problem.id);
    return maskAnonymous(
      {
        ...m.problem,
        upvotes: v.up,
        downvotes: v.down,
        score: v.up,
        followerCount: (await followerCount.get(m.problem.id)).c,
        matchScore: m.score,
        matchedTerms: m.matchedTerms,
      },
      req.userId
    );
  };

  const { strong, adjacent } = await matchProblemsForStartup(req.params.id);
  const strongDecorated = [];
  for (const m of strong) strongDecorated.push(await decorate(m));
  const adjacentDecorated = [];
  for (const m of adjacent) adjacentDecorated.push(await decorate(m));
  res.json({ strong: strongDecorated, adjacent: adjacentDecorated });
});

export default router;
