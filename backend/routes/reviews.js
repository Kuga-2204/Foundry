import { Router } from "express";
import db from "../db/index.js";
import { requireAuth } from "../middleware/auth.js";
import { hasStake } from "../lib/stake.js";
import { notify } from "../lib/notify.js";
import { moderate } from "../lib/moderate.js";

const router = Router();

const OUTCOMES = ["solved", "partial", "unsolved"];

router.get("/solution/:solutionId", (req, res) => {
  const rows = db
    .prepare(
      `SELECT r.*, u.name AS author_name FROM reviews r JOIN users u ON u.id = r.user_id
       WHERE r.solution_id = ? ORDER BY r.created_at DESC`
    )
    .all(req.params.solutionId);
  res.json({ reviews: rows });
});

// Add or update a review. Only stakeholders (posted or voted on the problem)
// can review, and no one can review their own solution or their own
// startup's solution. Reviews are outcome-based: did it actually fix it?
router.post("/solution/:solutionId", requireAuth, (req, res) => {
  const { rating, outcome, feedback } = req.body;
  const r = Number(rating);
  if (!Number.isInteger(r) || r < 1 || r > 5) {
    return res.status(400).json({ error: "Rating must be a whole number from 1 to 5." });
  }
  if (!OUTCOMES.includes(outcome)) {
    return res.status(400).json({ error: "Say whether it solved your problem: solved, partial, or unsolved." });
  }
  const flagged = moderate(feedback);
  if (flagged) return res.status(400).json({ error: flagged });

  const solution = db.prepare("SELECT * FROM solutions WHERE id = ?").get(req.params.solutionId);
  if (!solution) return res.status(404).json({ error: "Solution not found." });

  if (solution.user_id === req.userId) {
    return res.status(403).json({ error: "You cannot review your own solution." });
  }
  if (solution.startup_id) {
    const startup = db.prepare("SELECT owner_user_id FROM startups WHERE id = ?").get(solution.startup_id);
    if (startup && startup.owner_user_id === req.userId) {
      return res.status(403).json({ error: "You cannot review your own startup's solution." });
    }
  }

  if (!hasStake(solution.problem_id, req.userId)) {
    return res
      .status(403)
      .json({ error: "Only people who posted or voted on this problem can review its solutions." });
  }

  const existing = db
    .prepare("SELECT * FROM reviews WHERE solution_id = ? AND user_id = ?")
    .get(req.params.solutionId, req.userId);

  if (existing) {
    db.prepare("UPDATE reviews SET rating = ?, outcome = ?, feedback = ? WHERE id = ?").run(
      r,
      outcome,
      (feedback || "").trim(),
      existing.id
    );
  } else {
    db.prepare(
      "INSERT INTO reviews (solution_id, user_id, rating, outcome, feedback) VALUES (?, ?, ?, ?, ?)"
    ).run(req.params.solutionId, req.userId, r, outcome, (feedback || "").trim());

    notify(
      solution.user_id,
      "review",
      `Your solution "${solution.title}" received a ${r}-star review.`,
      `/problems/${solution.problem_id}`
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
