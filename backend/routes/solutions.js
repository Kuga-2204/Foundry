import { Router } from "express";
import db from "../db/index.js";
import { requireAuth, optionalAuth } from "../middleware/auth.js";

const router = Router();

function attachMeta(solution, userId) {
  const agg = db
    .prepare("SELECT COUNT(*) AS c, COALESCE(AVG(rating), 0) AS avg FROM reviews WHERE solution_id = ?")
    .get(solution.id);

  let myReview = null;
  if (userId) {
    myReview = db
      .prepare("SELECT * FROM reviews WHERE solution_id = ? AND user_id = ?")
      .get(solution.id, userId);
  }

  return {
    ...solution,
    reviewCount: agg.c,
    avgRating: Math.round(agg.avg * 10) / 10,
    myReview: myReview || null,
  };
}

// Whether a user has "a stake" in a problem: they posted it, or they upvoted/downvoted it.
// Only stakeholders can view-and-approve (i.e. review) solutions to that problem.
function hasStake(problemId, userId) {
  if (!userId) return false;
  const problem = db.prepare("SELECT user_id FROM problems WHERE id = ?").get(problemId);
  if (!problem) return false;
  if (problem.user_id === userId) return true;
  const vote = db.prepare("SELECT id FROM votes WHERE problem_id = ? AND user_id = ?").get(problemId, userId);
  return !!vote;
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

// Provide a solution to a problem
router.post("/problem/:problemId", requireAuth, (req, res) => {
  const { title, description, link } = req.body;
  if (!title?.trim() || !description?.trim()) {
    return res.status(400).json({ error: "Title and description are required." });
  }
  const problem = db.prepare("SELECT * FROM problems WHERE id = ?").get(req.params.problemId);
  if (!problem) return res.status(404).json({ error: "Problem not found." });

  const info = db
    .prepare(
      "INSERT INTO solutions (problem_id, user_id, title, description, link) VALUES (?, ?, ?, ?, ?)"
    )
    .run(req.params.problemId, req.userId, title.trim(), description.trim(), (link || "").trim());

  const row = db
    .prepare(`SELECT s.*, u.name AS author_name FROM solutions s JOIN users u ON u.id = s.user_id WHERE s.id = ?`)
    .get(info.lastInsertRowid);
  res.status(201).json({ solution: attachMeta(row, req.userId) });
});

router.get("/:id", optionalAuth, (req, res) => {
  const row = db
    .prepare(`SELECT s.*, u.name AS author_name FROM solutions s JOIN users u ON u.id = s.user_id WHERE s.id = ?`)
    .get(req.params.id);
  if (!row) return res.status(404).json({ error: "Solution not found." });
  res.json({ solution: attachMeta(row, req.userId), canReview: hasStake(row.problem_id, req.userId) });
});

export default router;
