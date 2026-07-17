import { Router } from "express";
import db from "../db/index.js";
import { requireAuth, optionalAuth } from "../middleware/auth.js";
import { matchStartups } from "../lib/match.js";
import { notify, notifyFollowers, follow } from "../lib/notify.js";

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

  const followerCount = db
    .prepare("SELECT COUNT(*) AS c FROM problem_followers WHERE problem_id = ?")
    .get(problem.id).c;

  let myVote = null;
  let hasStake = false;
  let isFollowing = false;
  if (userId) {
    const v = db
      .prepare("SELECT vote_type FROM votes WHERE problem_id = ? AND user_id = ?")
      .get(problem.id, userId);
    myVote = v ? v.vote_type : null;
    hasStake = myVote !== null || problem.user_id === userId;
    isFollowing = !!db
      .prepare("SELECT id FROM problem_followers WHERE problem_id = ? AND user_id = ?")
      .get(problem.id, userId);
  }

  return {
    ...problem,
    upvotes: votes.up,
    downvotes: votes.down,
    score: votes.up - votes.down,
    solutionCount,
    followerCount,
    myVote,
    hasStake, // eligible to review solutions
    isFollowing,
  };
}

function getFullProblem(id, userId) {
  const row = db
    .prepare(
      `SELECT p.*, u.name AS author_name FROM problems p JOIN users u ON u.id = p.user_id WHERE p.id = ?`
    )
    .get(id);
  return row ? attachMeta(row, userId) : null;
}

router.get("/categories", (_req, res) => {
  res.json({ categories: CATEGORIES });
});

// Live matching while a user types a problem: "does a startup already solve
// this?" This powers the post-a-problem flow and the problem detail panel.
router.post("/match", (req, res) => {
  const { text } = req.body;
  if (!text || String(text).trim().length < 8) {
    return res.json({ strong: [], adjacent: [] });
  }
  const { strong, adjacent } = matchStartups(String(text));
  const shape = (m) => ({
    ...m.startup,
    claimed: !!m.startup.claimed,
    matchScore: m.score,
    matchedTerms: m.matchedTerms,
  });
  res.json({ strong: strong.map(shape), adjacent: adjacent.map(shape) });
});

// Browse / feed
router.get("/", optionalAuth, (req, res) => {
  const { sort = "top", category, search, status, mine } = req.query;

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
  if (status && ["open", "building", "solved"].includes(status)) {
    sql += " AND p.status = ?";
    params.push(status);
  }
  if (mine === "true" && req.userId) {
    sql += " AND p.user_id = ?";
    params.push(req.userId);
  }

  const rows = db.prepare(sql).all(...params);
  let withMeta = rows.map((r) => attachMeta(r, req.userId));

  if (sort === "top") withMeta.sort((a, b) => b.score - a.score);
  else if (sort === "new") withMeta.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  else if (sort === "followed") withMeta.sort((a, b) => b.followerCount - a.followerCount);
  else if (sort === "unsolved")
    withMeta = withMeta
      .filter((p) => p.status === "open" && p.solutionCount === 0)
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
  const problemId = info.lastInsertRowid;

  // The poster follows their own problem so status changes reach them.
  follow(problemId, req.userId);

  // Tell owners of matching startups that a new lead landed.
  const { strong } = matchStartups(`${title} ${description}`);
  const seenOwners = new Set();
  for (const m of strong) {
    const ownerId = m.startup.owner_user_id;
    if (!ownerId || ownerId === req.userId || seenOwners.has(ownerId)) continue;
    seenOwners.add(ownerId);
    notify(
      ownerId,
      "lead",
      `New problem matches what ${m.startup.name} solves: "${title.trim()}"`,
      `/problems/${problemId}`
    );
  }

  res.status(201).json({ problem: getFullProblem(problemId, req.userId) });
});

router.get("/:id", optionalAuth, (req, res) => {
  const problem = getFullProblem(req.params.id, req.userId);
  if (!problem) return res.status(404).json({ error: "Problem not found." });

  const commitments = db
    .prepare(
      `SELECT c.*, s.name AS startup_name, s.claimed AS startup_claimed
       FROM commitments c JOIN startups s ON s.id = c.startup_id
       WHERE c.problem_id = ? ORDER BY c.created_at DESC`
    )
    .all(req.params.id);

  res.json({ problem, commitments });
});

// Startups that likely already solve this problem.
router.get("/:id/matches", (req, res) => {
  const problem = db.prepare("SELECT * FROM problems WHERE id = ?").get(req.params.id);
  if (!problem) return res.status(404).json({ error: "Problem not found." });
  const { strong, adjacent } = matchStartups(`${problem.title} ${problem.description}`);
  const shape = (m) => ({
    ...m.startup,
    claimed: !!m.startup.claimed,
    matchScore: m.score,
    matchedTerms: m.matchedTerms,
  });
  res.json({ strong: strong.map(shape), adjacent: adjacent.map(shape) });
});

// Vote: 1 (up) or -1 (down). Same type again removes the vote (toggle).
// Any vote also follows the problem, so voters hear when it gets solved.
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
    follow(req.params.id, req.userId);
  }

  res.json({ problem: getFullProblem(req.params.id, req.userId) });
});

router.post("/:id/follow", requireAuth, (req, res) => {
  const problem = db.prepare("SELECT id FROM problems WHERE id = ?").get(req.params.id);
  if (!problem) return res.status(404).json({ error: "Problem not found." });

  const existing = db
    .prepare("SELECT id FROM problem_followers WHERE problem_id = ? AND user_id = ?")
    .get(req.params.id, req.userId);
  if (existing) db.prepare("DELETE FROM problem_followers WHERE id = ?").run(existing.id);
  else follow(req.params.id, req.userId);

  res.json({ problem: getFullProblem(req.params.id, req.userId) });
});

// A startup commits to building a fix. Problem moves to "building" and every
// follower is notified. Shipping later moves it to "solved".
router.post("/:id/commit", requireAuth, (req, res) => {
  const { startup_id, note } = req.body;
  const problem = db.prepare("SELECT * FROM problems WHERE id = ?").get(req.params.id);
  if (!problem) return res.status(404).json({ error: "Problem not found." });

  const startup = db.prepare("SELECT * FROM startups WHERE id = ?").get(startup_id);
  if (!startup) return res.status(404).json({ error: "Startup not found." });
  if (startup.owner_user_id !== req.userId) {
    return res.status(403).json({ error: "You can only commit on behalf of your own startup." });
  }

  const existing = db
    .prepare("SELECT * FROM commitments WHERE problem_id = ? AND startup_id = ?")
    .get(req.params.id, startup_id);
  if (existing) return res.status(409).json({ error: "This startup already committed to this problem." });

  db.prepare("INSERT INTO commitments (problem_id, startup_id, note) VALUES (?, ?, ?)").run(
    req.params.id,
    startup_id,
    (note || "").trim()
  );
  if (problem.status === "open") {
    db.prepare("UPDATE problems SET status = 'building' WHERE id = ?").run(req.params.id);
  }

  notifyFollowers(
    problem.id,
    req.userId,
    "status",
    `${startup.name} is building a fix for "${problem.title}"`,
    `/problems/${problem.id}`
  );

  res.status(201).json({ problem: getFullProblem(req.params.id, req.userId) });
});

// Mark a commitment as shipped. The problem is now solved and followers are
// the launch audience: everyone who declared this exact pain gets pinged.
router.post("/:id/ship", requireAuth, (req, res) => {
  const { startup_id } = req.body;
  const problem = db.prepare("SELECT * FROM problems WHERE id = ?").get(req.params.id);
  if (!problem) return res.status(404).json({ error: "Problem not found." });

  const startup = db.prepare("SELECT * FROM startups WHERE id = ?").get(startup_id);
  if (!startup) return res.status(404).json({ error: "Startup not found." });
  if (startup.owner_user_id !== req.userId) {
    return res.status(403).json({ error: "You can only ship on behalf of your own startup." });
  }

  const commitment = db
    .prepare("SELECT * FROM commitments WHERE problem_id = ? AND startup_id = ?")
    .get(req.params.id, startup_id);
  if (!commitment) return res.status(404).json({ error: "Commit to this problem before shipping." });
  if (commitment.status === "shipped") {
    return res.status(409).json({ error: "Already marked as shipped." });
  }

  db.prepare("UPDATE commitments SET status = 'shipped' WHERE id = ?").run(commitment.id);
  db.prepare("UPDATE problems SET status = 'solved' WHERE id = ?").run(req.params.id);

  notifyFollowers(
    problem.id,
    req.userId,
    "status",
    `${startup.name} shipped a fix for "${problem.title}". Try it and leave a review.`,
    `/problems/${problem.id}`
  );

  res.json({ problem: getFullProblem(req.params.id, req.userId) });
});

export default router;
