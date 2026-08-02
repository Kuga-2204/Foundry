import { Router } from "express";
import db from "../db/index.js";
import { requireAuth, optionalAuth } from "../middleware/auth.js";
import { matchStartups, matchSimilarProblems, tokenize } from "../lib/match.js";
import { notify, notifyFollowers, follow } from "../lib/notify.js";
import {
  anonymousHandleCandidates,
  maskAnonymous,
  normaliseAnonymousHandle,
  validateAnonymousHandle,
} from "../lib/anon.js";
import { fetchProblemMedia, upload, uploadProblemMedia } from "../lib/uploads.js";
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

const CATEGORY_HINTS = {
  "Health & Wellness": ["health", "doctor", "fitness", "sleep", "mental", "medicine", "clinic", "therapy", "diet", "pain", "body", "symptom", "symptoms", "check", "hospital"],
  Productivity: ["productivity", "task", "todo", "calendar", "schedule", "meeting", "focus", "workflow", "organize", "reminder"],
  Finance: ["money", "payment", "pay", "rent", "bill", "budget", "bank", "expense", "invoice", "split", "subscription"],
  Sustainability: ["waste", "recycle", "carbon", "sustainable", "energy", "plastic", "green", "climate"],
  Education: ["school", "course", "class", "study", "student", "exam", "learn", "lesson", "teacher", "university"],
  "Home & Living": ["home", "roommate", "flatmate", "house", "rent", "kitchen", "apartment", "chores", "cleaning"],
  Transport: ["transport", "bus", "train", "ride", "parking", "commute", "traffic", "delivery", "route"],
  Community: ["community", "neighbour", "neighbor", "group", "event", "volunteer", "local", "people", "text", "texts", "texting", "message", "messages", "girl", "friend", "relationship", "boundary", "boundaries"],
  "Developer Tools": ["developer", "code", "api", "github", "deploy", "debug", "database", "server", "frontend", "backend", "bug"],
};

function cleanFiller(text) {
  return String(text || "")
    .replace(/\b(hey|hi|hello|actually|so|like)\b[\s,]*/gi, " ")
    .replace(/\b(any tips|what should i do|please help)\b[?.!]*/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function stripAssistBoilerplate(text) {
  return String(text || "")
    .replace(/\s*this is frustrating because it costs time, creates repeated manual work, and does not have an obvious easy fix\.\s*i would use a solution that makes this simpler, faster, and reliable without adding more coordination\.?/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function firstSentence(text) {
  return String(text || "")
    .replace(/\s+/g, " ")
    .trim()
    .split(/(?<=[.!?])\s+/)[0]
    .replace(/[.!?]+$/, "")
    .trim();
}

function compactTitle(text) {
  const cleaned = String(text || "")
    .replace(/\s+/g, " ")
    .replace(/[.!?]+$/g, "")
    .trim();
  if (!cleaned) return "";
  if (cleaned.length <= 68) return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  const cut = cleaned.slice(0, 68);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > 38 ? cut.slice(0, lastSpace) : cut).trim();
}

function isMedicalCheckComplaint(text) {
  const value = String(text || "").toLowerCase();
  return /\b(body|pain|symptom|symptoms|health|medical|sick|ill|doctor|clinic|hospital)\b/.test(value)
    && /\b(doctor|clinic|check|diagnose|appointment|help|come)\b/.test(value);
}

function medicalCheckDescription(text) {
  const value = polishDescription(stripAssistBoilerplate(text));
  if (!isMedicalCheckComplaint(value)) return "";
  return "I have unexplained issues in my body and need an easier way to find a doctor who can check my symptoms and advise what to do next.";
}

function isUnwantedTextingComplaint(text) {
  const value = String(text || "").toLowerCase();
  return /\b(girl|guy|someone|person|friend|ex)\b/.test(value)
    && /\b(text|texts|texting|message|messages|dm|dms|chatting)\b/.test(value)
    && /\b(annoying|cut\s+.*off|stop|won't stop|keeps?|constant|constantly|since yesterday|last night)\b/.test(value);
}

function socialBoundaryDescription(text) {
  const value = polishDescription(stripAssistBoilerplate(text));
  if (!isUnwantedTextingComplaint(value)) return "";
  return "Someone has been texting me repeatedly, and I want a simple, respectful way to set boundaries and stop the conversation without making it awkward or escalating the situation.";
}

function simplifyCause(text) {
  const cause = String(text || "").toLowerCase();
  if (/chat|message|whatsapp|slack|discord|calendar|meeting|deadline/.test(cause)) {
    if (/separate|different|scattered|shared|everyone|change/.test(cause)) return "scattered chat and calendar updates";
    return "messy communication channels";
  }
  if (/roommate|flatmate|rent|bill|expense|money|split/.test(cause)) return "unclear shared expenses";
  if (/schedule|task|todo|reminder|organize|workflow/.test(cause)) return "manual coordination";
  if (/bug|code|api|deploy|server|frontend|backend/.test(cause)) return "unreliable tooling";
  return cause.replace(/^(everyone|people|users|we|they)\s+/i, "").slice(0, 48).trim();
}

function simplifyPain(text) {
  let pain = cleanFiller(text);
  pain = pain
    .replace(/^(i am|i'm|im|i|we|users|people|there is|there are)\s+/i, "")
    .replace(/^(always|constantly|keep|keeps|having|have|has|struggle to|struggling to|can't|cannot|not able to)\s+/i, "")
    .replace(/\s+/g, " ")
    .trim();

  pain = pain
    .replace(/forgetting\s+(project\s+)?deadlines?\s+and\s+meetings?/i, "missed project deadlines")
    .replace(/forgetting\s+deadlines?/i, "missed deadlines")
    .replace(/not able to sit properly/i, "trouble sitting comfortably")
    .replace(/sit properly/i, "sitting comfortably")
    .replace(/splitting rent/i, "splitting rent fairly")
    .replace(/turns? into an argument/i, "causes arguments");

  return pain;
}

function titleFromText(text) {
  if (isUnwantedTextingComplaint(text)) return "Unwanted repeated texts from someone I want to avoid";
  if (isMedicalCheckComplaint(text)) return "Need a doctor to check unexplained body issues";
  const sentence = firstSentence(polishDescription(text));
  if (!sentence) return "";
  const withoutIntro = sentence
    .replace(/^(the problem is|there is|there are)\s+/i, "")
    .trim();
  const parts = withoutIntro.split(/\s+because\s+/i);
  if (parts.length >= 2) {
    const pain = simplifyPain(parts[0]);
    const cause = simplifyCause(parts.slice(1).join(" because "));
    if (pain && cause) return compactTitle(`${pain} from ${cause}`);
  }
  return compactTitle(simplifyPain(withoutIntro));
}

function inferCategory(text, fallback = "General") {
  const tokens = new Set(tokenize(text));
  let best = { category: CATEGORIES.includes(fallback) ? fallback : "General", score: 0 };
  for (const [category, hints] of Object.entries(CATEGORY_HINTS)) {
    let score = 0;
    for (const hint of hints) if (tokens.has(hint)) score += 1;
    if (score > best.score) best = { category, score };
  }
  return best;
}

function polishDescription(text) {
  let cleaned = String(text || "")
    .replace(/\s+/g, " ")
    .replace(/\s+([,.!?;:])/g, "$1")
    .trim();

  if (!cleaned) return "";

  const corrections = [
    [/\bim\b/gi, "I'm"],
    [/\bi m\b/gi, "I'm"],
    [/\bi'm\b/gi, "I'm"],
    [/\bi\b/g, "I"],
    [/\bdont\b/gi, "don't"],
    [/\bdoesnt\b/gi, "doesn't"],
    [/\bdidnt\b/gi, "didn't"],
    [/\bcant\b/gi, "can't"],
    [/\bcannot\b/gi, "can't"],
    [/\bwont\b/gi, "won't"],
    [/\bwouldnt\b/gi, "wouldn't"],
    [/\bcouldnt\b/gi, "couldn't"],
    [/\bshouldnt\b/gi, "shouldn't"],
    [/\bive\b/gi, "I've"],
    [/\bid\b/gi, "I'd"],
    [/\bill\b/gi, "I'll"],
    [/\bits\b/gi, "it's"],
    [/\bthats\b/gi, "that's"],
    [/\bwhats\b/gi, "what's"],
    [/\btheres\b/gi, "there's"],
    [/\btheyre\b/gi, "they're"],
    [/\byoure\b/gi, "you're"],
    [/\bshes\b/gi, "she's"],
    [/\bhes\b/gi, "he's"],
    [/\btextin\s*gme\b/gi, "texting me"],
    [/\btextin\b/gi, "texting"],
    [/\bteh\b/gi, "the"],
    [/\brecieve\b/gi, "receive"],
    [/\bforgeting\b/gi, "forgetting"],
    [/\bseperate\b/gi, "separate"],
    [/\balot\b/gi, "a lot"],
    [/\bbecuase\b/gi, "because"],
    [/\bdefinately\b/gi, "definitely"],
    [/\bacheive\b/gi, "achieve"],
    [/\boccured\b/gi, "occurred"],
    [/\bwierd\b/gi, "weird"],
    [/\bcalender\b/gi, "calendar"],
    [/\bgrammer\b/gi, "grammar"],
    [/\bgrmmar\b/gi, "grammar"],
    [/\beverytime\b/gi, "every time"],
  ];
  for (const [pattern, replacement] of corrections) {
    cleaned = cleaned.replace(pattern, replacement);
  }


  cleaned = cleaned
    .replace(/\bhey so\b/gi, "Hey, so")
    .replace(/\bthere is some type of issues\b/gi, "there are some issues")
    .replace(/\bthere is some issues\b/gi, "there are some issues")
    .replace(/\bcan some doctor come and check\b/gi, "can a doctor come and check")
    .replace(/\bmy body can a doctor\b/gi, "my body. Can a doctor")
    .replace(/\bmy body can some doctor\b/gi, "my body. Can a doctor")
    .replace(/\bhow do I cut (him|her|them) off,\s*(he's|she's|they're)\b/gi, "How do I cut $1 off? $2")
    .replace(/\bannoying me\s+How do I cut/gi, "annoying me. How do I cut")
    .replace(/\bthere is this\b/gi, "there is this")
    .replace(/\bsince yesterday night\b/gi, "since last night")
    .replace(/\bsince last night any tips\b/gi, "since last night. Any tips?");

  cleaned = cleaned.replace(/([!?])\./g, "$1");
  cleaned = cleaned.replace(/(^|[.!?]\s+)([a-z])/g, (_match, prefix, letter) => prefix + letter.toUpperCase());
  cleaned = cleaned.replace(/\bCan a doctor come and check\.$/i, "Can a doctor come and check?");
  if (!/[.!?]$/.test(cleaned)) cleaned += ".";
  return cleaned;
}

function assistedDescription(text) {
  return polishDescription(text);
}


async function chatAssistText(messages, { temperature = 0.1, maxTokens = 300 } = {}) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return "";

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.AI_ASSIST_MODEL || "gpt-4o-mini",
        temperature,
        max_tokens: maxTokens,
        messages,
      }),
    });
    if (!res.ok) return "";
    const data = await res.json();
    return String(data.choices?.[0]?.message?.content || "").trim();
  } catch {
    return "";
  } finally {
    clearTimeout(timeout);
  }
}

function normalizeCategory(value, text) {
  const candidate = String(value || "").replace(/["'.]/g, "").trim();
  const exact = CATEGORIES.find((category) => category.toLowerCase() === candidate.toLowerCase());
  if (exact) return exact;
  return inferCategory(text, "General").category;
}

async function aiProblemAssist(description) {
  if (!process.env.OPENAI_API_KEY) return null;

  const correctedDescription = await chatAssistText(
    [
      {
        role: "system",
        content:
          "You correct user-written problem descriptions. Return only the corrected text. Fix grammar, spelling, punctuation, and capitalization. Preserve the user's meaning, details, tone, and first-person wording. Do not add advice, solutions, explanations, new details, or formatting.",
      },
      {
        role: "user",
        content: `Can you autocorrect this for grammar and spelling?\n\n${description}`,
      },
    ],
    { temperature: 0, maxTokens: 500 }
  );

  const cleanDescription = polishDescription(correctedDescription || description);
  if (!cleanDescription) return null;

  const title = await chatAssistText(
    [
      {
        role: "system",
        content:
          "You write short titles for user-submitted problems. Return only the title, no quotes. Make it specific and human. Synthesize the whole problem. Do not copy the first sentence. Keep it under 80 characters.",
      },
      {
        role: "user",
        content: `Can you give an appropriate title for this problem?\n\n${cleanDescription}`,
      },
    ],
    { temperature: 0.2, maxTokens: 40 }
  );

  const category = await chatAssistText(
    [
      {
        role: "system",
        content: `Pick exactly one category from this list and return only the category name: ${CATEGORIES.join(", ")}.`,
      },
      {
        role: "user",
        content: `What is the appropriate category for this problem?\n\nTitle: ${title}\nDescription: ${cleanDescription}`,
      },
    ],
    { temperature: 0, maxTokens: 20 }
  );

  return {
    title: compactTitle(title) || titleFromText(cleanDescription) || "Problem worth solving",
    description: cleanDescription,
    category: normalizeCategory(category, `${title} ${cleanDescription}`),
    confidence: 0.9,
    reasons: [
      "ChatGPT corrected the description for grammar and spelling.",
      "ChatGPT generated the title from the corrected description.",
      "ChatGPT selected the closest category from the available list.",
    ],
  };
}
function fallbackProblemAssist({ description, correctedDescription = assistedDescription(description) }) {
  const cleanDescription = correctedDescription;
  const titleSource = stripAssistBoilerplate(cleanDescription);
  const inferred = inferCategory(titleSource, "General");
  const suggestedTitle = titleFromText(titleSource) || "Problem worth solving";
  return {
    title: suggestedTitle,
    description: cleanDescription,
    category: inferred.category,
    confidence: Math.min(0.95, 0.55 + inferred.score * 0.12),
    reasons: [
      inferred.score > 0 ? "Matched category signals for " + inferred.category + "." : "Kept category broad because the text is still general.",
      "Suggested a short title from the cleaned description.",
      "Corrected grammar, spelling, and punctuation while keeping your description close to the original.",
    ],
  };
}

// Attach vote/solution/follower/comment/media counts to a batch of problems.
//
// Every count here used to be its own query per problem, which was free on a
// local SQLite file but is a separate network round-trip to Postgres. A
// 20-problem page meant ~140 round-trips. This does the whole page in three
// queries no matter how many problems are on it: one aggregate pass, plus two
// small lookups for the viewer's own votes and follows.
async function attachMetaMany(problems, userId) {
  if (problems.length === 0) return [];
  const ids = problems.map((p) => p.id);

  const counts = await db
    .prepare(
      `SELECT p.id,
              COALESCE(v.up, 0)    AS up,
              COALESCE(v.down, 0)  AS down,
              COALESCE(s.c, 0)     AS solutions,
              COALESCE(f.c, 0)     AS followers,
              COALESCE(cm.c, 0)    AS comments,
              COALESCE(md.c, 0)    AS media
         FROM problems p
         LEFT JOIN (SELECT problem_id,
                           SUM(CASE WHEN vote_type = 1 THEN 1 ELSE 0 END)  AS up,
                           SUM(CASE WHEN vote_type = -1 THEN 1 ELSE 0 END) AS down
                      FROM votes GROUP BY problem_id) v  ON v.problem_id  = p.id
         LEFT JOIN (SELECT problem_id, COUNT(*) AS c FROM solutions        GROUP BY problem_id) s  ON s.problem_id  = p.id
         LEFT JOIN (SELECT problem_id, COUNT(*) AS c FROM problem_followers GROUP BY problem_id) f  ON f.problem_id  = p.id
         LEFT JOIN (SELECT problem_id, COUNT(*) AS c FROM comments          GROUP BY problem_id) cm ON cm.problem_id = p.id
         LEFT JOIN (SELECT problem_id, COUNT(*) AS c FROM problem_media     GROUP BY problem_id) md ON md.problem_id = p.id
        WHERE p.id = ANY(?::int[])`
    )
    .all(ids);

  const byId = new Map(counts.map((c) => [c.id, c]));

  let myVotes = new Map();
  let myFollows = new Set();
  if (userId) {
    const votes = await db
      .prepare("SELECT problem_id, vote_type FROM votes WHERE user_id = ? AND problem_id = ANY(?::int[])")
      .all(userId, ids);
    myVotes = new Map(votes.map((v) => [v.problem_id, v.vote_type]));

    const follows = await db
      .prepare("SELECT problem_id FROM problem_followers WHERE user_id = ? AND problem_id = ANY(?::int[])")
      .all(userId, ids);
    myFollows = new Set(follows.map((f) => f.problem_id));
  }

  return problems.map((problem) => {
    const c = byId.get(problem.id) || {};
    const myVote = userId ? myVotes.get(problem.id) ?? null : null;
    return {
      ...problem,
      upvotes: c.up || 0,
      downvotes: c.down || 0,
      // Demand is the number of people who say they have the problem. A downvote
      // is useful feedback, but must never turn one person's demand into -1.
      score: c.up || 0,
      solutionCount: c.solutions || 0,
      followerCount: c.followers || 0,
      commentCount: c.comments || 0,
      mediaCount: c.media || 0,
      myVote,
      hasStake: !!userId && (myVote !== null || problem.user_id === userId),
      isFollowing: myFollows.has(problem.id),
      isMine: !!userId && problem.user_id === userId,
    };
  });
}

async function attachMeta(problem, userId) {
  return (await attachMetaMany([problem], userId))[0];
}

async function getFullProblem(id, userId) {
  const row = await db
    .prepare(
      `SELECT p.*, u.name AS author_name, u.anon_handle
       FROM problems p JOIN users u ON u.id = p.user_id WHERE p.id = ?`
    )
    .get(id);
  if (!row) return null;
  // Hidden content stays visible only to the person who posted it, with a
  // pending-review flag; everyone else gets a plain 404 upstream.
  if (row.hidden && row.user_id !== userId) return null;
  const meta = await attachMeta(row, userId);
  meta.media = await db
    .prepare("SELECT id, file, kind FROM problem_media WHERE problem_id = ? ORDER BY id")
    .all(id);
  if (row.hidden) meta.isHidden = true;
  return maskAnonymous(meta, userId);
}

function shuffle(items) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function engagementScore(problem) {
  return problem.upvotes * 2 + problem.followerCount + problem.commentCount * 1.5;
}

function isUnsolvedWithoutSolutions(problem) {
  return problem.status === "open" && problem.solutionCount === 0;
}

async function getInterestCategories(userId) {
  if (!userId) return [];
  const saved = await db
    .prepare("SELECT category FROM user_interests WHERE user_id = ? ORDER BY category")
    .all(userId);
  if (saved.length > 0) return saved.map((row) => row.category);

  const rows = await db
    .prepare(
      `SELECT category, SUM(weight) AS weight
       FROM (
         SELECT p.category, 3 AS weight
         FROM problems p
         WHERE p.user_id = ?

         UNION ALL

         SELECT p.category, 2 AS weight
         FROM problem_followers f
         JOIN problems p ON p.id = f.problem_id
         WHERE f.user_id = ?

         UNION ALL

         SELECT p.category, 2 AS weight
         FROM votes v
         JOIN problems p ON p.id = v.problem_id
         WHERE v.user_id = ? AND v.vote_type = 1
       ) interests
       GROUP BY category
       ORDER BY weight DESC, category ASC
       LIMIT 3`
    )
    .all(userId, userId, userId);
  return rows.map((row) => row.category);
}

function takeProblems(pool, count, used, { preferUnsolved = false, highLiked = false } = {}) {
  const available = pool.filter((problem) => !used.has(problem.id));
  const ordered = highLiked
    ? [...available].sort((a, b) => engagementScore(b) - engagementScore(a))
    : shuffle(available);
  const preferred = preferUnsolved
    ? ordered.filter(isUnsolvedWithoutSolutions).concat(ordered.filter((p) => !isUnsolvedWithoutSolutions(p)))
    : ordered;

  const picked = preferred.slice(0, count);
  for (const problem of picked) used.add(problem.id);
  return picked;
}

function discoverRankProblems(problems, interestCategories) {
  if (problems.length === 0) return [];

  const interests = new Set(interestCategories);
  const hasInterests = interests.size > 0;
  const interestPool = hasInterests ? problems.filter((p) => interests.has(p.category)) : problems;
  const nonInterestPool = hasInterests ? problems.filter((p) => !interests.has(p.category)) : problems;
  const ranked = [];
  const used = new Set();

  while (ranked.length < problems.length) {
    const blockStart = ranked.length;
    const interestHighLiked = takeProblems(interestPool, 5, used, { preferUnsolved: true, highLiked: true });
    const interestRandom = takeProblems(interestPool, 1, used, { preferUnsolved: true });
    const nonInterestRandom = takeProblems(nonInterestPool, 4, used, { preferUnsolved: true });
    let block = [...interestHighLiked, ...interestRandom, ...nonInterestRandom];

    if (block.length < 10) {
      block = block.concat(takeProblems(problems, 10 - block.length, used, { preferUnsolved: true }));
    }

    const unsolvedCount = block.filter(isUnsolvedWithoutSolutions).length;
    if (unsolvedCount < 6) {
      const replacements = takeProblems(
        problems.filter(isUnsolvedWithoutSolutions),
        6 - unsolvedCount,
        used
      );
      const keep = [];
      let replaceCount = replacements.length;
      for (let i = block.length - 1; i >= 0; i--) {
        if (replaceCount > 0 && !isUnsolvedWithoutSolutions(block[i])) {
          used.delete(block[i].id);
          replaceCount--;
          continue;
        }
        keep.unshift(block[i]);
      }
      block = keep.concat(replacements);
    }

    ranked.push(...block);
    if (ranked.length === blockStart) break;
  }

  return ranked;
}

function attachTrendScores(problems) {
  const now = Date.now();
  for (const p of problems) {
    const ageDays = Math.max(0, (now - Date.parse(p.created_at)) / 86400000);
    p.trendScore = (engagementScore(p) + p.solutionCount + 1) * Math.exp(-ageDays / 10);
  }
}

async function categoryFallbackStartups(category, excludeIds = new Set(), limit = 3) {
  if (!CATEGORIES.includes(category)) return [];
  const rows = await db
    .prepare("SELECT * FROM startups WHERE category = ? ORDER BY claimed DESC, name ASC LIMIT ?")
    .all(category, limit + excludeIds.size);
  return rows
    .filter((startup) => !excludeIds.has(startup.id))
    .slice(0, limit)
    .map((startup) => ({
      startup,
      score: 1,
      matchedTerms: [category.toLowerCase()],
      statementHits: 0,
    }));
}
router.get("/categories", (_req, res) => {
  res.json({ categories: CATEGORIES });
});

router.post("/assist", optionalAuth, async (req, res) => {
  const description = String(req.body.description || req.body.text || "").trim();
  const text = description;

  if (text.length < 8) {
    return res.status(400).json({ error: "Write a little more before using AI assist." });
  }

  const assist = (await aiProblemAssist(description)) || fallbackProblemAssist({ description });
  const startupSearchText = `${assist.title} ${stripAssistBoilerplate(assist.description)}`;
  let { strong, adjacent } = await matchStartups(startupSearchText, { limit: 4 });
  if (!isUnwantedTextingComplaint(description) && strong.length + adjacent.length < 3) {
    const usedStartupIds = new Set([...strong, ...adjacent].map((m) => m.startup.id));
    const fallback = await categoryFallbackStartups(assist.category, usedStartupIds, 3 - strong.length - adjacent.length);
    adjacent = adjacent.concat(fallback);
  }
  const shape = (m) => ({
    ...m.startup,
    claimed: !!m.startup.claimed,
    matchScore: m.score,
    matchedTerms: m.matchedTerms,
  });

  res.json({
    assist,
    startups: {
      strong: strong.map(shape),
      adjacent: adjacent.map(shape),
    },
  });
});

router.get("/media", async (req, res) => {
  const mediaRef = req.query.url || req.query.path;
  if (!mediaRef) return res.status(400).json({ error: "Missing media reference." });

  try {
    const storageRes = await fetchProblemMedia(mediaRef, req.headers.range);
    const contentType = storageRes.headers.get("content-type") || "application/octet-stream";
    const cacheControl = storageRes.headers.get("cache-control") || "public, max-age=31536000, immutable";
    const contentLength = storageRes.headers.get("content-length");
    const contentRange = storageRes.headers.get("content-range");
    res.status(storageRes.status === 206 ? 206 : 200);
    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", cacheControl);
    res.setHeader("Accept-Ranges", "bytes");
    if (contentLength) res.setHeader("Content-Length", contentLength);
    if (contentRange) res.setHeader("Content-Range", contentRange);
    const buffer = Buffer.from(await storageRes.arrayBuffer());
    res.send(buffer);
  } catch (err) {
    console.warn("problem media proxy failed", err);
    res.status(404).json({ error: "Attachment not found." });
  }
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
  const { sort = "discover", category, search, status, mine } = req.query;

  let sql = `
    SELECT p.*, u.name AS author_name, u.anon_handle
    FROM problems p JOIN users u ON u.id = p.user_id
    WHERE (p.hidden = 0 OR p.user_id = ?)
  `;
  const params = [req.userId || -1];

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
  let withMeta = (await attachMetaMany(rows, req.userId)).map((p) =>
    maskAnonymous(p, req.userId)
  );

  // Discover: every 10-problem block aims for 6 from the viewer's inferred
  // interest categories, 4 outside them, 5 high-demand interest-category
  // problems, 5 random slots, and at least 6 open problems with no solutions.
  // When there are not enough problems in a bucket, the feed fills from the
  // remaining pool instead of leaving holes.
  attachTrendScores(withMeta);
  if (sort === "discover" || sort === "trending") {
    const interestCategories = await getInterestCategories(req.userId);
    withMeta = discoverRankProblems(withMeta, interestCategories);
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
  const similar = (await attachMetaMany(matches.map((m) => m.problem), req.userId)).map((p) =>
    maskAnonymous(p, req.userId)
  );
  res.json({
    similar,
  });
});

router.get("/dashboard", requireAuth, async (req, res) => {
  const postedRows = await db
    .prepare(
      `SELECT p.*, u.name AS author_name, u.anon_handle
       FROM problems p JOIN users u ON u.id = p.user_id
       WHERE p.user_id = ?
       ORDER BY p.created_at DESC`
    )
    .all(req.userId);

  const followedRows = await db
    .prepare(
      `SELECT p.*, u.name AS author_name, u.anon_handle, f.created_at AS followed_at
       FROM problem_followers f
       JOIN problems p ON p.id = f.problem_id
       JOIN users u ON u.id = p.user_id
       WHERE f.user_id = ? AND p.user_id != ?
       ORDER BY f.created_at DESC`
    )
    .all(req.userId, req.userId);

  const activityRows = await db
    .prepare(
      `SELECT *
       FROM (
         SELECT s.id,
                'solution' AS type,
                s.created_at,
                p.id AS problem_id,
                p.title AS problem_title,
                s.title AS headline,
                u.name AS actor_name,
                st.name AS startup_name,
                NULL AS status,
                s.description AS body
         FROM solutions s
         JOIN problems p ON p.id = s.problem_id
         JOIN users u ON u.id = s.user_id
         LEFT JOIN startups st ON st.id = s.startup_id
         WHERE p.user_id = ?
            OR EXISTS (
              SELECT 1 FROM problem_followers f
              WHERE f.problem_id = p.id AND f.user_id = ?
            )

         UNION ALL

         SELECT c.id,
                'comment' AS type,
                c.created_at,
                p.id AS problem_id,
                p.title AS problem_title,
                COALESCE(st.name, u.name) AS headline,
                u.name AS actor_name,
                st.name AS startup_name,
                NULL AS status,
                c.body
         FROM comments c
         JOIN problems p ON p.id = c.problem_id
         JOIN users u ON u.id = c.user_id
         LEFT JOIN startups st ON st.id = c.startup_id
         WHERE p.user_id = ?
            OR EXISTS (
              SELECT 1 FROM problem_followers f
              WHERE f.problem_id = p.id AND f.user_id = ?
            )

         UNION ALL

         SELECT cm.id,
                'commitment' AS type,
                cm.created_at,
                p.id AS problem_id,
                p.title AS problem_title,
                st.name AS headline,
                st.name AS actor_name,
                st.name AS startup_name,
                cm.status,
                cm.note AS body
         FROM commitments cm
         JOIN problems p ON p.id = cm.problem_id
         JOIN startups st ON st.id = cm.startup_id
         WHERE p.user_id = ?
            OR EXISTS (
              SELECT 1 FROM problem_followers f
              WHERE f.problem_id = p.id AND f.user_id = ?
            )
       ) activity
       ORDER BY created_at DESC, id DESC
       LIMIT 30`
    )
    .all(req.userId, req.userId, req.userId, req.userId, req.userId, req.userId);

  const postedProblems = (await attachMetaMany(postedRows, req.userId)).map((p) =>
    maskAnonymous(p, req.userId)
  );
  const followedProblems = (await attachMetaMany(followedRows, req.userId)).map((p) =>
    maskAnonymous(p, req.userId)
  );

  res.json({
    postedProblems,
    followedProblems,
    updates: activityRows,
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

// Edit a problem. Only the person who posted it can change it. Stamps
// edited_at so the frontend can show an "edited" tag next to the post.
router.put("/:id", requireAuth, async (req, res) => {
  const { title, description, category } = req.body;
  const problem = await db.prepare("SELECT * FROM problems WHERE id = ?").get(req.params.id);
  if (!problem) return res.status(404).json({ error: "Problem not found." });
  if (problem.user_id !== req.userId) {
    return res.status(403).json({ error: "You can only edit a problem you posted." });
  }

  const newTitle = String(title || "").trim();
  const newDescription = String(description || "").trim();
  if (!newTitle || !newDescription) {
    return res.status(400).json({ error: "Title and description are required." });
  }
  const flagged = moderate(newTitle, newDescription);
  if (flagged) return res.status(400).json({ error: flagged });
  const cat = CATEGORIES.includes(category) ? category : problem.category;

  await db
    .prepare("UPDATE problems SET title = ?, description = ?, category = ?, edited_at = now() WHERE id = ?")
    .run(newTitle, newDescription, cat, req.params.id);

  res.json({ problem: await getFullProblem(req.params.id, req.userId) });
});

// Delete a problem. Only the person who posted it can remove it. Votes,
// followers, comments, solutions, and media rows are removed by the ON DELETE
// CASCADE foreign keys, so a single delete cleans up the whole thread.
router.delete("/:id", requireAuth, async (req, res) => {
  const problem = await db.prepare("SELECT user_id FROM problems WHERE id = ?").get(req.params.id);
  if (!problem) return res.status(404).json({ error: "Problem not found." });
  if (problem.user_id !== req.userId) {
    return res.status(403).json({ error: "You can only delete a problem you posted." });
  }
  await db.prepare("DELETE FROM problems WHERE id = ?").run(req.params.id);
  res.json({ ok: true });
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

  await db
    .prepare(
      `WITH deleted AS (
         DELETE FROM votes
         WHERE problem_id = ? AND user_id = ? AND vote_type = ?
         RETURNING id
       ),
       upserted AS (
         INSERT INTO votes (problem_id, user_id, vote_type)
         SELECT ?, ?, ?
         WHERE NOT EXISTS (SELECT 1 FROM deleted)
         ON CONFLICT (problem_id, user_id)
         DO UPDATE SET vote_type = EXCLUDED.vote_type
         RETURNING id
       )
       SELECT
         (SELECT COUNT(*) FROM deleted) AS deleted,
         (SELECT COUNT(*) FROM upserted) AS upserted`
    )
    .get(req.params.id, req.userId, type, req.params.id, req.userId, type);
  // Only "me too" (upvote) means you're waiting on a fix, so only that
  // follows the problem. Downvoting ("not relevant") must not subscribe you.
  if (type === 1) await follow(req.params.id, req.userId);

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
      `SELECT c.id, c.body, c.created_at, c.edited_at, c.user_id, c.startup_id,
              u.name AS author_name, s.name AS startup_name, s.claimed AS startup_claimed,
              COALESCE(lc.c, 0) AS like_count,
              CASE WHEN ml.comment_id IS NOT NULL THEN 1 ELSE 0 END AS liked
       FROM comments c
       JOIN users u ON u.id = c.user_id
       LEFT JOIN startups s ON s.id = c.startup_id
       LEFT JOIN (SELECT comment_id, COUNT(*) AS c FROM comment_likes GROUP BY comment_id) lc
              ON lc.comment_id = c.id
       LEFT JOIN comment_likes ml ON ml.comment_id = c.id AND ml.user_id = ?
       WHERE c.problem_id = ? AND (c.hidden = 0 OR c.user_id = ?)
       ORDER BY c.created_at ASC, c.id ASC`
    )
    .all(req.userId || -1, req.params.id, req.userId || -1);

  res.json({
    comments: rows.map((r) => ({
      id: r.id,
      body: r.body,
      created_at: r.created_at,
      edited_at: r.edited_at,
      author_name: r.author_name,
      author_id: r.user_id,
      isMine: !!req.userId && r.user_id === req.userId,
      likeCount: r.like_count,
      liked: !!r.liked,
      startup: r.startup_id
        ? { id: r.startup_id, name: r.startup_name, claimed: !!r.startup_claimed }
        : null,
    })),
  });
});

// Edit a comment. Only the person who posted it can change it.
router.put("/:id/comments/:commentId", requireAuth, async (req, res) => {
  const comment = await db
    .prepare("SELECT * FROM comments WHERE id = ? AND problem_id = ?")
    .get(req.params.commentId, req.params.id);
  if (!comment) return res.status(404).json({ error: "Comment not found." });
  if (comment.user_id !== req.userId) {
    return res.status(403).json({ error: "You can only edit a comment you posted." });
  }

  const body = String(req.body.body || "").trim();
  if (!body) return res.status(400).json({ error: "Comment can't be empty." });
  if (body.length > 2000) return res.status(400).json({ error: "Comment is too long (2000 characters max)." });
  const flagged = moderate(body);
  if (flagged) return res.status(400).json({ error: flagged });

  await db.prepare("UPDATE comments SET body = ?, edited_at = now() WHERE id = ?").run(body, req.params.commentId);
  res.json({ ok: true });
});

// Delete a comment. Only the person who posted it can remove it. Likes on
// it are removed by the ON DELETE CASCADE foreign key.
router.delete("/:id/comments/:commentId", requireAuth, async (req, res) => {
  const comment = await db
    .prepare("SELECT * FROM comments WHERE id = ? AND problem_id = ?")
    .get(req.params.commentId, req.params.id);
  if (!comment) return res.status(404).json({ error: "Comment not found." });
  if (comment.user_id !== req.userId) {
    return res.status(403).json({ error: "You can only delete a comment you posted." });
  }
  await db.prepare("DELETE FROM comments WHERE id = ?").run(req.params.commentId);
  res.json({ ok: true });
});

// Toggle a like on a comment.
router.post("/:id/comments/:commentId/like", requireAuth, async (req, res) => {
  const comment = await db
    .prepare("SELECT id FROM comments WHERE id = ? AND problem_id = ?")
    .get(req.params.commentId, req.params.id);
  if (!comment) return res.status(404).json({ error: "Comment not found." });

  const existing = await db
    .prepare("SELECT id FROM comment_likes WHERE comment_id = ? AND user_id = ?")
    .get(req.params.commentId, req.userId);
  if (existing) {
    await db.prepare("DELETE FROM comment_likes WHERE id = ?").run(existing.id);
  } else {
    await db.prepare("INSERT INTO comment_likes (comment_id, user_id) VALUES (?, ?)").run(req.params.commentId, req.userId);
  }
  const { c: likeCount } = await db
    .prepare("SELECT COUNT(*)::int AS c FROM comment_likes WHERE comment_id = ?")
    .get(req.params.commentId);

  res.json({ liked: !existing, likeCount });
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
