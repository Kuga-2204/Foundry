import { Router } from "express";
import db from "../db/index.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

function hasStake(problemId, userId) {
  const problem = db.prepare("SELECT user_id FROM problems WHERE id = ?").get(problemId);
  if (!problem) return false;
  if (problem.user_id === userId) return true;
  const vote = db.prepare("SELECT id FROM votes WHERE problem_id = ? AND user_id = ?").get(problemId, userId);
  return !!vote;
}

router.get("/solution/:solutionId", (req, res) => {
  const rows = db
    .prepare(
      `SELECT r.*, u.name AS author_name FROM reviews r JOIN users u ON u.id = r.user_id
       WHERE r.solution_id = ? ORDER BY r.created_at DESC`
    )
    .all(req.params.solutionId);
  res.json({ reviews: rows });
});

// Add or update a review. Only people who posted the problem or voted on it may review a solution to it.
router.post("/solution/:solutionId", requireAuth, (req, res) => {
  const { rating, feedback } = req.body;
  const r = Number(rating);
  if (!Number.isInteger(r) || r < 1 || r > 5) {
    return res.status(400).json({ error: "Rating must be a whole number from 1 to 5." });
  }

  const solution = db.prepare("SELECT * FROM solutions WHERE id = ?").get(req.params.solutionId);
  if (!solution) return res.status(404).json({ error: "Solution not found." });

  if (!hasStake(solution.problem_id, req.userId)) {
    return res
      .status(403)
      .json({ error: "Only people who posted or upvoted/downvoted this problem can review its solutions." });
  }

  const existing = db
    .prepare("SELECT * FROM reviews WHERE solution_id = ? AND user_id = ?")
    .get(req.params.solutionId, req.userId);

  if (existing) {
    db.prepare("UPDATE reviews SET rating = ?, feedback = ? WHERE id = ?").run(
      r,
      (feedback || "").trim(),
      existing.id
    );
  } else {
    db.prepare("INSERT INTO reviews (solution_id, user_id, rating, feedback) VALUES (?, ?, ?, ?)").run(
      req.params.solutionId,
      req.userId,
      r,
      (feedback || "").trim()
    );
  }

  const row = db
    .prepare(
      `SELECT r.*, u.name AS author_name FROM reviews r JOIN users u ON u.id = r.user_id
       WHERE r.solution_id = ? AND r.user_id = ?`
    )
    .get(req.params.solutionId, req.userId);
  res.status(existing ? 200 : 201).json({ review: row });
});

export default router;
