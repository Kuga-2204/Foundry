import { Router } from "express";
import db from "../db/index.js";
import { requireAuth, optionalAuth } from "../middleware/auth.js";
import { matchStartups, matchSimilarProblems } from "../lib/match.js";
import { notify, notifyFollowers, follow } from "../lib/notify.js";
import {
  anonymousHandleCandidates,
  maskAnonymous,
  normaliseAnonymousHandle,
  validateAnonymousHandle,
} from "../lib/anon.js";
import { upload, uploadProblemMedia } from "../lib/uploads.js";
import { moderate } from "../lib/moderate.js";
import { track } from "../lib/track.js";

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

async function attachMeta(problem, userId) {
  const votes = await db
    .prepare(
      `SELECT
         COALESCE(SUM(CASE WHEN vote_type = 1 THEN 1 ELSE 0 END), 0) AS up,
         COALESCE(SUM(CASE WHEN vote_type = -1 THEN 1 ELSE 0 END), 0) AS down
       FROM votes WHERE problem_id = ?`
    )
    .get(problem.id);

  const solutionCount = (await db
    .prepare("SELECT COUNT(*) AS c FROM solutions WHERE problem_id = ?")
    .get(problem.id)).c;

  const followerCount = (await db
    .prepare("SELECT COUNT(*) AS c FROM problem_followers WHERE problem_id = ?")
    .get(problem.id)).c;

  const commentCount = (await db
    .prepare("SELECT COUNT(*) AS c FROM comments WHERE problem_id = ?")
    .get(problem.id)).c;

  const mediaCount = (await db
    .prepare("SELECT COUNT(*) AS c FROM problem_media WHERE problem_id = ?")
    .get(problem.id)).c;

  let myVote = null;
  let hasStake = false;
  let isFollowing = false;
  if (userId) {
    const v = await db
      .prepare("SELECT vote_type FROM votes WHERE problem_id = ? AND user_id = ?")
      .get(problem.id, userId);
    myVote = v ? v.vote_type : null;
    hasStake = myVote !== null || problem.user_id === userId;
    isFollowing = !!(await db
      .prepare("SELECT id FROM problem_followers WHERE problem_id = ? AND user_id = ?")
      .get(problem.id, userId));
  }

  return {
    ...problem,
    upvotes: votes.up,
    downvotes: votes.down,
    // Demand is the number of people who say they have the problem. A downvote
    // is useful feedback, but must never turn one person's demand into -1.
    score: votes.up,
    solutionCount,
    followerCount,
    commentCount,
    mediaCount,
    myVote,
    hasStake, // eligible to review solutions
    isFollowing,
    isMine: !!userId && problem.user_id === userId,
  };
}

async function getFullProblem(id, userId) {
  const row = await db
    .prepare(
      `SELECT p.*, u.name AS author_name, u.anon_handle
       FROM problems p JOIN users u ON u.id = p.user_id WHERE p.id = ?`
    )
    .get(id);
  if (!row) return null;
  const meta = await attachMeta(row, userId);
  meta.media = await db
    .prepare("SELECT id, file, kind FROM problem_media WHERE problem_id = ? ORDER BY id")
    .all(id);
  return maskAnonymous(meta, userId);
}

router.get("/categories", (_req, res) => {
  res.json({ categories: CATEGORIES });
});

// Live matching while a user types a problem: "does a startup already solve
// this?" This powers the post-a-problem flow and the problem detail panel.
router.post("/match", optionalAuth, async (req, res) => {
  const { text } = req.body;
  if (!text || String(text).trim().length < 8) {
    return res.json({ strong: [], adjacent: [] });
  }
  const { strong, adjacent } = await matchStartups(String(text));

  // Startup analytics: someone just searched language this startup covers.
  // Only for logged-in users; track() dedupes repeat hits while they type.
  if (req.userId) {
    for (const m of strong) await track("search_match", m.startup.id, req.userId);
  }
  const shape = (m) => ({
    ...m.startup,
    claimed: !!m.startup.claimed,
    matchScore: m.score,
    matchedTerms: m.matchedTerms,
  });
  res.json({ strong: strong.map(shape), adjacent: adjacent.map(shape) });
});

// Browse / feed
router.get("/", optionalAuth, async (req, res) => {
  const { sort = "top", category, search, status, mine } = req.query;

  let sql = `
    SELECT p.*, u.name AS author_name, u.anon_handle
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

  const rows = await db.prepare(sql).all(...params);
  let withMeta = [];
  for (const r of rows) {
    withMeta.push(maskAnonymous(await attachMeta(r, req.userId), req.userId));
  }

  // Trending: recent activity beats stale popularity. Engagement (votes,
  // followers, comments, solutions) decays with age so last week's hot
  // problem doesn't sit on top forever.
  if (sort === "trending") {
    const now = Date.now();
    for (const p of withMeta) {
      const ageDays = Math.max(0, (now - Date.parse(p.created_at)) / 86400000);
      p.trendScore =
        (p.upvotes * 2 + p.followerCount + p.commentCount * 1.5 + p.solutionCount + 1) *
        Math.exp(-ageDays / 10);
    }
    withMeta.sort((a, b) => b.trendScore - a.trendScore);
  } else if (sort === "top") withMeta.sort((a, b) => b.score - a.score);
  else if (sort === "new") withMeta.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  else if (sort === "followed") withMeta.sort((a, b) => b.followerCount - a.followerCount);
  else if (sort === "unsolved")
    withMeta = withMeta
      .filter((p) => p.status === "open" && p.solutionCount === 0)
      .sort((a, b) => b.score - a.score);

  res.json({ problems: withMeta });
});

// Similar existing problems, checked live while the user types. Surfacing
// duplicates before posting keeps demand concentrated on one listing where
// votes and followers actually add up.
router.post("/similar", optionalAuth, async (req, res) => {
  const { text } = req.body;
  if (!text || String(text).trim().length < 8) return res.json({ similar: [] });
  const matches = await matchSimilarProblems(String(text));
  const similar = [];
  for (const m of matches) {
    similar.push(maskAnonymous(await attachMeta(m.problem, req.userId), req.userId));
  }
  res.json({
    similar,
  });
});

// Multer only touches multipart requests; JSON posts pass straight through.
const uploadMedia = (req, res, next) =>
  upload.array("media", 4)(req, res, (err) =>
    err ? res.status(400).json({ error: err.message }) : next()
  );

router.post("/", requireAuth, uploadMedia, async (req, res) => {
  const { title, description, category, anonymousHandle } = req.body;
  if (!title?.trim() || !description?.trim()) {
    return res.status(400).json({ error: "Title and description are required." });
  }
  const flagged = moderate(title, description);
  if (flagged) return res.status(400).json({ error: flagged });
  // Multipart form fields arrive as strings, JSON as booleans; accept both.
  const anonymous = req.body.anonymous === true || req.body.anonymous === "true" ? 1 : 0;
  const cat = CATEGORIES.includes(category) ? category : "General";
  if (anonymous) {
    const user = await db.prepare("SELECT anon_handle FROM users WHERE id = ?").get(req.userId);
    const requested = validateAnonymousHandle(anonymousHandle);
    if (requested.error) return res.status(400).json({ error: requested.error });

    const current = normaliseAnonymousHandle(user?.anon_handle);
    if (current && requested.handle && current.toLowerCase() !== requested.handle.toLowerCase()) {
      return res.status(409).json({
        error: `Your anonymous name is already set as ${current}. It stays the same to protect your anonymous identity.`,
      });
    }

    if (!current) {
      const candidates = requested.handle ? [requested.handle] : anonymousHandleCandidates();
      let handle = null;
      for (const candidate of candidates) {
        const taken = await db
          .prepare("SELECT id FROM users WHERE lower(anon_handle) = lower(?) AND id != ?")
          .get(candidate, req.userId);
        if (!taken) {
          handle = candidate;
          break;
        }
      }
      if (!handle) {
        return res.status(409).json({ error: "That anonymous name is already taken. Try another one." });
      }
      try {
        await db.prepare("UPDATE users SET anon_handle = ? WHERE id = ?").run(handle, req.userId);
      } catch (err) {
        if (String(err.message).includes("UNIQUE")) {
          return res.status(409).json({ error: "That anonymous name is already taken. Try another one." });
        }
        throw err;
      }
    }
  }
  const info = await db
    .prepare(
      "INSERT INTO problems (user_id, title, description, category, is_anonymous) VALUES (?, ?, ?, ?, ?)"
    )
    .run(req.userId, title.trim(), description.trim(), cat, anonymous);
  const problemId = info.lastInsertRowid;

  const insertMedia = db.prepare(
    "INSERT INTO problem_media (problem_id, file, kind) VALUES (?, ?, ?)"
  );
  for (const f of req.files || []) {
    const media = await uploadProblemMedia(f, problemId);
    await insertMedia.run(problemId, media.url, media.kind);
  }

  // The poster follows their own problem so status changes reach them.
  await follow(problemId, req.userId);

  // Tell owners of matching startups that a new lead landed.
  const { strong } = await matchStartups(`${title} ${description}`);
  const seenOwners = new Set();
  for (const m of strong) {
    const ownerId = m.startup.owner_user_id;
    if (!ownerId || ownerId === req.userId || seenOwners.has(ownerId)) continue;
    seenOwners.add(ownerId);
    await notify(
      ownerId,
      "lead",
      `New problem matches what ${m.startup.name} solves: "${title.trim()}"`,
      `/problems/${problemId}`
    );
  }

  res.status(201).json({ problem: await getFullProblem(problemId, req.userId) });
});

router.get("/:id", optionalAuth, async (req, res) => {
  const problem = await getFullProblem(req.params.id, req.userId);
  if (!problem) return res.status(404).json({ error: "Problem not found." });

  const commitments = await db
    .prepare(
      `SELECT c.*, s.name AS startup_name, s.claimed AS startup_claimed
       FROM commitments c JOIN startups s ON s.id = c.startup_id
       WHERE c.problem_id = ? ORDER BY c.created_at DESC`
    )
    .all(req.params.id);

  res.json({ problem, commitments });
});

// Startups that likely already solve this problem.
router.get("/:id/matches", async (req, res) => {
  const problem = await db.prepare("SELECT * FROM problems WHERE id = ?").get(req.params.id);
  if (!problem) return res.status(404).json({ error: "Problem not found." });
  const { strong, adjacent } = await matchStartups(`${problem.title} ${problem.description}`);
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
router.post("/:id/vote", requireAuth, async (req, res) => {
  const { type } = req.body;
  if (![1, -1].includes(type)) return res.status(400).json({ error: "Vote type must be 1 or -1." });

  const problem = await db.prepare("SELECT * FROM problems WHERE id = ?").get(req.params.id);
  if (!problem) return res.status(404).json({ error: "Problem not found." });

  const existing = await db
    .prepare("SELECT * FROM votes WHERE problem_id = ? AND user_id = ?")
    .get(req.params.id, req.userId);

  if (existing && existing.vote_type === type) {
    await db.prepare("DELETE FROM votes WHERE id = ?").run(existing.id);
  } else if (existing) {
    await db.prepare("UPDATE votes SET vote_type = ? WHERE id = ?").run(type, existing.id);
  } else {
    await db.prepare("INSERT INTO votes (problem_id, user_id, vote_type) VALUES (?, ?, ?)").run(
      req.params.id,
      req.userId,
      type
    );
    await follow(req.params.id, req.userId);
  }

  res.json({ problem: await getFullProblem(req.params.id, req.userId) });
});

router.post("/:id/follow", requireAuth, async (req, res) => {
  const problem = await db.prepare("SELECT id FROM problems WHERE id = ?").get(req.params.id);
  if (!problem) return res.status(404).json({ error: "Problem not found." });

  const existing = await db
    .prepare("SELECT id FROM problem_followers WHERE problem_id = ? AND user_id = ?")
    .get(req.params.id, req.userId);
  if (existing) await db.prepare("DELETE FROM problem_followers WHERE id = ?").run(existing.id);
  else await follow(req.params.id, req.userId);

  res.json({ problem: await getFullProblem(req.params.id, req.userId) });
});

// A startup commits to building a fix. Problem moves to "building" and every
// follower is notified. Shipping later moves it to "solved".
router.post("/:id/commit", requireAuth, async (req, res) => {
  const { startup_id, note } = req.body;
  const problem = await db.prepare("SELECT * FROM problems WHERE id = ?").get(req.params.id);
  if (!problem) return res.status(404).json({ error: "Problem not found." });

  const startup = await db.prepare("SELECT * FROM startups WHERE id = ?").get(startup_id);
  if (!startup) return res.status(404).json({ error: "Startup not found." });
  if (startup.owner_user_id !== req.userId) {
    return res.status(403).json({ error: "You can only commit on behalf of your own startup." });
  }

  const existing = await db
    .prepare("SELECT * FROM commitments WHERE problem_id = ? AND startup_id = ?")
    .get(req.params.id, startup_id);
  if (existing) return res.status(409).json({ error: "This startup already committed to this problem." });

  await db.prepare("INSERT INTO commitments (problem_id, startup_id, note) VALUES (?, ?, ?)").run(
    req.params.id,
    startup_id,
    (note || "").trim()
  );
  if (problem.status === "open") {
    await db.prepare("UPDATE problems SET status = 'building' WHERE id = ?").run(req.params.id);
  }

  await notifyFollowers(
    problem.id,
    req.userId,
    "status",
    `${startup.name} is building a fix for "${problem.title}"`,
    `/problems/${problem.id}`
  );

  res.status(201).json({ problem: await getFullProblem(req.params.id, req.userId) });
});

// Mark a commitment as shipped. The problem is now solved and followers are
// the launch audience: everyone who declared this exact pain gets pinged.
router.post("/:id/ship", requireAuth, async (req, res) => {
  const { startup_id } = req.body;
  const problem = await db.prepare("SELECT * FROM problems WHERE id = ?").get(req.params.id);
  if (!problem) return res.status(404).json({ error: "Problem not found." });

  const startup = await db.prepare("SELECT * FROM startups WHERE id = ?").get(startup_id);
  if (!startup) return res.status(404).json({ error: "Startup not found." });
  if (startup.owner_user_id !== req.userId) {
    return res.status(403).json({ error: "You can only ship on behalf of your own startup." });
  }

  const commitment = await db
    .prepare("SELECT * FROM commitments WHERE problem_id = ? AND startup_id = ?")
    .get(req.params.id, startup_id);
  if (!commitment) return res.status(404).json({ error: "Commit to this problem before shipping." });
  if (commitment.status === "shipped") {
    return res.status(409).json({ error: "Already marked as shipped." });
  }

  await db.prepare("UPDATE commitments SET status = 'shipped' WHERE id = ?").run(commitment.id);
  await db.prepare("UPDATE problems SET status = 'solved' WHERE id = ?").run(req.params.id);

  await notifyFollowers(
    problem.id,
    req.userId,
    "status",
    `${startup.name} shipped a fix for "${problem.title}". Try it and leave a review.`,
    `/problems/${problem.id}`
  );

  res.json({ problem: await getFullProblem(req.params.id, req.userId) });
});

// Discussion thread. Startups join in by commenting as their startup, which
// is how they ask clarifying questions before committing to build.
router.get("/:id/comments", optionalAuth, async (req, res) => {
  const problem = await db.prepare("SELECT id FROM problems WHERE id = ?").get(req.params.id);
  if (!problem) return res.status(404).json({ error: "Problem not found." });

  const rows = await db
    .prepare(
      `SELECT c.id, c.body, c.created_at, c.user_id, c.startup_id,
              u.name AS author_name, s.name AS startup_name, s.claimed AS startup_claimed
       FROM comments c
       JOIN users u ON u.id = c.user_id
       LEFT JOIN startups s ON s.id = c.startup_id
       WHERE c.problem_id = ? ORDER BY c.created_at ASC, c.id ASC`
    )
    .all(req.params.id);

  res.json({
    comments: rows.map((r) => ({
      id: r.id,
      body: r.body,
      created_at: r.created_at,
      author_name: r.author_name,
      author_id: r.user_id,
      isMine: !!req.userId && r.user_id === req.userId,
      startup: r.startup_id
        ? { id: r.startup_id, name: r.startup_name, claimed: !!r.startup_claimed }
        : null,
    })),
  });
});

router.post("/:id/comments", requireAuth, async (req, res) => {
  const problem = await db.prepare("SELECT * FROM problems WHERE id = ?").get(req.params.id);
  if (!problem) return res.status(404).json({ error: "Problem not found." });

  const body = String(req.body.body || "").trim();
  if (!body) return res.status(400).json({ error: "Comment can't be empty." });
  if (body.length > 2000) return res.status(400).json({ error: "Comment is too long (2000 characters max)." });
  const flagged = moderate(body);
  if (flagged) return res.status(400).json({ error: flagged });

  let startup = null;
  if (req.body.startup_id) {
    startup = await db.prepare("SELECT * FROM startups WHERE id = ?").get(req.body.startup_id);
    if (!startup) return res.status(404).json({ error: "Startup not found." });
    if (startup.owner_user_id !== req.userId) {
      return res.status(403).json({ error: "You can only comment as a startup you own." });
    }
  }

  await db.prepare(
    "INSERT INTO comments (problem_id, user_id, startup_id, body) VALUES (?, ?, ?, ?)"
  ).run(req.params.id, req.userId, startup ? startup.id : null, body);

  if (problem.user_id !== req.userId) {
    const actor = startup
      ? startup.name
      : (await db.prepare("SELECT name FROM users WHERE id = ?").get(req.userId)).name;
    await notify(
      problem.user_id,
      "comment",
      `${actor} commented on "${problem.title}"`,
      `/problems/${problem.id}`
    );
  }

  res.status(201).json({ ok: true });
});

export default router;
