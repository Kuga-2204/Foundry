import { Router } from "express";
import db from "../db/index.js";
import { requireAuth, optionalAuth } from "../middleware/auth.js";
import { hasStake } from "../lib/stake.js";
import { notifyFollowers } from "../lib/notify.js";
import { moderate } from "../lib/moderate.js";

const router = Router();

function attachMeta(solution, userId) {
  const agg = db
    .prepare(
      `SELECT COUNT(*) AS c, COALESCE(AVG(rating), 0) AS avg,
              COALESCE(SUM(CASE WHEN outcome = 'solved' THEN 1 ELSE 0 END), 0) AS solved
       FROM reviews WHERE solution_id = ?`
    )
    .get(solution.id);

  let myReview = null;
  if (userId) {
    myReview = db
      .prepare("SELECT * FROM reviews WHERE solution_id = ? AND user_id = ?")
      .get(solution.id, userId);
  }

  let startup = null;
  if (solution.startup_id) {
    const s = db
      .prepare("SELECT id, name, claimed FROM startups WHERE id = ?")
      .get(solution.startup_id);
    if (s) startup = { ...s, claimed: !!s.claimed };
  }

  return {
    ...solution,
    startup,
    reviewCount: agg.c,
    avgRating: Math.round(agg.avg * 10) / 10,
    solvedCount: agg.solved,
    myReview: myReview || null,
  };
}

// List solutions for a problem
router.get("/problem/:problemId", optionalAuth, (req, res) => {
  const problem = db.prepare("SELECT id FROM problems WHERE id = ?").get(req.params.problemId);
  if (!problem) return res.status(404).json({ error: "Problem not found." });

  const rows = db
    .prepare(
      `SELECT s.*, u.name AS author_name FROM solutions s JOIN users u ON u.id = s.user_id
       WHERE s.problem_id = ? ORDER BY s.created_at DESC`
    )
    .all(req.params.problemId);

  const withMeta = rows.map((r) => attachMeta(r, req.userId));
  res.json({
    solutions: withMeta,
    canReview: hasStake(req.params.problemId, req.userId),
  });
});

// Post a solution, personally or on behalf of a startup you own.
router.post("/problem/:problemId", requireAuth, (req, res) => {
  const { title, description, link, startup_id } = req.body;
  if (!title?.trim() || !description?.trim()) {
    return res.status(400).json({ error: "Title and description are required." });
  }
  const cleanLink = (link || "").trim();
  if (cleanLink && !/^https?:\/\//i.test(cleanLink)) {
    return res.status(400).json({ error: "Link must start with http:// or https://." });
  }
  const flagged = moderate(title, description);
  if (flagged) return res.status(400).json({ error: flagged });
  const problem = db.prepare("SELECT * FROM problems WHERE id = ?").get(req.params.problemId);
  if (!problem) return res.status(404).json({ error: "Problem not found." });

  let startupId = null;
  if (startup_id) {
    const startup = db.prepare("SELECT * FROM startups WHERE id = ?").get(startup_id);
    if (!startup) return res.status(404).json({ error: "Startup not found." });
    if (startup.owner_user_id !== req.userId) {
      return res.status(403).json({ error: "You can only post on behalf of your own startup." });
    }
    startupId = startup.id;
  }

  const info = db
    .prepare(
      "INSERT INTO solutions (problem_id, user_id, startup_id, title, description, link) VALUES (?, ?, ?, ?, ?, ?)"
    )
    .run(req.params.problemId, req.userId, startupId, title.trim(), description.trim(), cleanLink);

  notifyFollowers(
    problem.id,
    req.userId,
    "solution",
    `A solution was posted on "${problem.title}": ${title.trim()}`,
    `/problems/${problem.id}`
  );

  const row = db
    .prepare(
      `SELECT s.*, u.name AS author_name FROM solutions s JOIN users u ON u.id = s.user_id WHERE s.id = ?`
    )
    .get(info.lastInsertRowid);
  res.status(201).json({ solution: attachMeta(row, req.userId) });
});

router.get("/:id", optionalAuth, (req, res) => {
  const row = db
    .prepare(
      `SELECT s.*, u.name AS author_name FROM solutions s JOIN users u ON u.id = s.user_id WHERE s.id = ?`
    )
    .get(req.params.id);
  if (!row) return res.status(404).json({ error: "Solution not found." });
  res.json({ solution: attachMeta(row, req.userId), canReview: hasStake(row.problem_id, req.userId) });
});

export default router;
