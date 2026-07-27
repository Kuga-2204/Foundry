import { Router } from "express";
import db from "../db/index.js";
import { optionalAuth } from "../middleware/auth.js";
import { hideIfReported } from "../lib/moderation.js";

const router = Router();

// User-submitted reports. Write-time moderation only catches profanity; this
// is how anything else objectionable gets surfaced for review. Anyone can
// report (auth optional) but we record the reporter when we know them.
router.post("/", optionalAuth, async (req, res) => {
  const { target_type, target_id, reason } = req.body;
  if (!["problem", "comment"].includes(target_type)) {
    return res.status(400).json({ error: "Invalid report target." });
  }
  const id = Number(target_id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: "Invalid report target." });

  const table = target_type === "problem" ? "problems" : "comments";
  const target = await db.prepare(`SELECT id, user_id FROM ${table} WHERE id = ?`).get(id);
  if (!target) return res.status(404).json({ error: "That content no longer exists." });
  if (req.userId && target.user_id === req.userId) {
    return res.status(400).json({ error: "You can't report your own content." });
  }

  if (req.userId) {
    const already = await db
      .prepare("SELECT id FROM reports WHERE reporter_id = ? AND target_type = ? AND target_id = ?")
      .get(req.userId, target_type, id);
    if (already) return res.status(409).json({ error: "You already reported this." });
  }

  await db.prepare(
    "INSERT INTO reports (reporter_id, target_type, target_id, reason) VALUES (?, ?, ?, ?)"
  ).run(req.userId || null, target_type, id, String(reason || "").slice(0, 500));

  // Moderation consequences must never block the reporter's confirmation.
  try {
    await hideIfReported(target_type, id);
  } catch (err) {
    console.error("moderation check failed:", err.message);
  }

  res.status(201).json({ ok: true, message: "Thanks for flagging this. We'll take a look." });
});

export default router;
