import { Router } from "express";
import db from "../db/index.js";
import { requireAuth, optionalAuth } from "../middleware/auth.js";

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

function attachMeta(problem, userId) {
  const votes = db
    .prepare(
      `SELECT
         COALESCE(SUM(CASE WHEN vote_type = 1 THEN 1 ELSE 0 END), 0) AS up,
         COALESCE(SUM(CASE WHEN vote_type = -1 THEN 1 ELSE 0 END), 0) AS down
       FROM votes WHERE problem_id = ?`
    )
    .get(problem.id);

  const solutionCount = db
    .prepare("SELECT COUNT(*) AS c FROM solutions WHERE problem_id = ?")
    .get(problem.id).c;

  let myVote = null;
  let hasStake = false;
  if (userId) {
    const v = db
      .prepare("SELECT vote_type FROM votes WHERE problem_id = ? AND user_id = ?")
      .get(problem.id, userId);
    myVote = v ? v.vote_type : null;
    hasStake = myVote !== null || problem.user_id === userId;
  }

  return {
    ...problem,
    upvotes: votes.up,
    downvotes: votes.down,
    score: votes.up - votes.down,
    solutionCount,
    myVote,
    hasStake, // eligible to view/approve solutions with a review
  };
}

router.get("/categories", (_req, res) => {
  res.json({ categories: CATEGORIES });
});

// Browse / feed
router.get("/", optionalAuth, (req, res) => {
  const { sort = "top", category, search, mine } = req.query;

  let sql = `
    SELECT p.*, u.name AS author_name
    FROM problems p JOIN users u ON u.id = p.user_id
    WHERE 1=1
  `;
  const params = [];

  if (category && category !== "All") {
    sql += " AND p.category = ?";
    params.push(category);
  }
  if (search) {
    sql += " AND (p.title LIKE ? OR p.description LIKE ?)";
    params.push(`%${search}%`, `%${search}%`);
  }
  if (mine === "true" && req.userId) {
    sql += " AND p.user_id = ?";
    params.push(req.userId);
  }

  const rows = db.prepare(sql).all(...params);
  let withMeta = rows.map((r) => attachMeta(r, req.userId));

  if (sort === "top") withMeta.sort((a, b) => b.score - a.score);
  else if (sort === "new") withMeta.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  else if (sort === "solved") withMeta.sort((a, b) => b.solutionCount - a.solutionCount);
  else if (sort === "unsolved")
    withMeta = withMeta
      .filter((p) => p.solutionCount === 0)
      .sort((a, b) => b.score - a.score);

  res.json({ problems: withMeta });
});

router.post("/", requireAuth, (req, res) => {
  const { title, description, category } = req.body;
  if (!title?.trim() || !description?.trim()) {
    return res.status(400).json({ error: "Title and description are required." });
  }
  const cat = CATEGORIES.includes(category) ? category : "General";
  const info = db
    .prepare("INSERT INTO problems (user_id, title, description, category) VALUES (?, ?, ?, ?)")
    .run(req.userId, title.trim(), description.trim(), cat);

  // The poster automatically has a stake in their own problem (no auto-upvote; they can vote too)
  const row = db
    .prepare(`SELECT p.*, u.name AS author_name FROM problems p JOIN users u ON u.id = p.user_id WHERE p.id = ?`)
    .get(info.lastInsertRowid);
  res.status(201).json({ problem: attachMeta(row, req.userId) });
});

router.get("/:id", optionalAuth, (req, res) => {
  const row = db
    .prepare(`SELECT p.*, u.name AS author_name FROM problems p JOIN users u ON u.id = p.user_id WHERE p.id = ?`)
    .get(req.params.id);
  if (!row) return res.status(404).json({ error: "Problem not found." });
  res.json({ problem: attachMeta(row, req.userId) });
});

// Vote: type must be 1 (up) or -1 (down). Voting again with the same type removes the vote (toggle).
router.post("/:id/vote", requireAuth, (req, res) => {
  const { type } = req.body;
  if (![1, -1].includes(type)) return res.status(400).json({ error: "Vote type must be 1 or -1." });

  const problem = db.prepare("SELECT * FROM problems WHERE id = ?").get(req.params.id);
  if (!problem) return res.status(404).json({ error: "Problem not found." });

  const existing = db
    .prepare("SELECT * FROM votes WHERE problem_id = ? AND user_id = ?")
    .get(req.params.id, req.userId);

  if (existing && existing.vote_type === type) {
    db.prepare("DELETE FROM votes WHERE id = ?").run(existing.id);
  } else if (existing) {
    db.prepare("UPDATE votes SET vote_type = ? WHERE id = ?").run(type, existing.id);
  } else {
    db.prepare("INSERT INTO votes (problem_id, user_id, vote_type) VALUES (?, ?, ?)").run(
      req.params.id,
      req.userId,
      type
    );
  }

  const row = db
    .prepare(`SELECT p.*, u.name AS author_name FROM problems p JOIN users u ON u.id = p.user_id WHERE p.id = ?`)
    .get(req.params.id);
  res.json({ problem: attachMeta(row, req.userId) });
});

export default router;
