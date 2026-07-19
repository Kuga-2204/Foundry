import { Router } from "express";
import db from "../db/index.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

router.get("/", requireAuth, async (req, res) => {
  const notifications = await db
    .prepare(
      "SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC, id DESC LIMIT 50"
    )
    .all(req.userId);
  const unread = (await db
    .prepare("SELECT COUNT(*) AS c FROM notifications WHERE user_id = ? AND read = 0")
    .get(req.userId)).c;
  res.json({ notifications, unread });
});

router.post("/read-all", requireAuth, async (req, res) => {
  await db.prepare("UPDATE notifications SET read = 1 WHERE user_id = ?").run(req.userId);
  res.json({ ok: true });
});

export default router;
