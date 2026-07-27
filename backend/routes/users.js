import { Router } from "express";
import db from "../db/index.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

const CATEGORIES = [
  "General",
  "Health & Wellness",
  "Productivity",
  "Finance",
  "Sustainability",
  "Education",
  "Home & Living",
  "Transport",
  "Community",
  "Developer Tools",
];

router.get("/me/interests", requireAuth, async (req, res) => {
  const rows = await db
    .prepare("SELECT category FROM user_interests WHERE user_id = ? ORDER BY category")
    .all(req.userId);
  res.json({ interests: rows.map((row) => row.category) });
});

router.put("/me/interests", requireAuth, async (req, res) => {
  const requested = Array.isArray(req.body.interests) ? req.body.interests : [];
  const interests = [...new Set(requested.filter((category) => CATEGORIES.includes(category)))];
  if (interests.length > 5) {
    return res.status(400).json({ error: "Choose up to 5 interest categories." });
  }

  await db.prepare("DELETE FROM user_interests WHERE user_id = ?").run(req.userId);
  for (const category of interests) {
    await db
      .prepare("INSERT INTO user_interests (user_id, category) VALUES (?, ?)")
      .run(req.userId, category);
  }

  res.json({ interests });
});

// Public profile: builds credibility for the person behind a problem or
// solution. Anonymous problems are excluded here just as they are everywhere
// else, so this route can never de-anonymize them.
router.get("/:id", async (req, res) => {
  const user = await db
    .prepare("SELECT id, name, bio, created_at FROM users WHERE id = ?")
    .get(req.params.id);
  if (!user) return res.status(404).json({ error: "User not found." });

  const problems = await db
    .prepare(
      `SELECT p.id, p.title, p.category, p.status, p.created_at,
              (SELECT COALESCE(SUM(vote_type), 0) FROM votes v WHERE v.problem_id = p.id) AS score
       FROM problems p
       WHERE p.user_id = ? AND p.is_anonymous = 0
       ORDER BY p.created_at DESC`
    )
    .all(req.params.id);

  const solutions = await db
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

  const startups = await db
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
