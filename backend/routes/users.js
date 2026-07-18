import { Router } from "express";
import db from "../db/index.js";

const router = Router();

// Public profile: builds credibility for the person behind a problem or
// solution. Anonymous problems are excluded here just as they are everywhere
// else, so this route can never de-anonymize them.
router.get("/:id", (req, res) => {
  const user = db
    .prepare("SELECT id, name, bio, created_at FROM users WHERE id = ?")
    .get(req.params.id);
  if (!user) return res.status(404).json({ error: "User not found." });

  const problems = db
    .prepare(
      `SELECT p.id, p.title, p.category, p.status, p.created_at,
              (SELECT COALESCE(SUM(vote_type), 0) FROM votes v WHERE v.problem_id = p.id) AS score
       FROM problems p
       WHERE p.user_id = ? AND p.is_anonymous = 0
       ORDER BY p.created_at DESC`
    )
    .all(req.params.id);

  const solutions = db
    .prepare(
      `SELECT s.id, s.title, s.problem_id, p.title AS problem_title, s.startup_id,
              st.name AS startup_name
       FROM solutions s
       JOIN problems p ON p.id = s.problem_id
       LEFT JOIN startups st ON st.id = s.startup_id
       WHERE s.user_id = ?
       ORDER BY s.created_at DESC`
    )
    .all(req.params.id);

  const startups = db
    .prepare("SELECT id, name, tagline FROM startups WHERE owner_user_id = ? ORDER BY name")
    .all(req.params.id);

  res.json({
    user,
    stats: {
      problemCount: problems.length,
      solutionCount: solutions.length,
      startupCount: startups.length,
    },
    problems,
    solutions,
    startups,
  });
});

export default router;
