import { Router } from "express";
import { sendAllDigests, buildDigestFor } from "../lib/digest.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

// Trigger the weekly send. Guarded by DIGEST_SECRET so only a scheduler (cron
// job hitting this with the header) can fire it in production. If the secret
// is unset (local dev), it's open so the flow can be tested.
router.post("/run", async (req, res) => {
  const secret = process.env.DIGEST_SECRET;
  if (secret && req.headers["x-digest-secret"] !== secret) {
    return res.status(403).json({ error: "Forbidden." });
  }
  const result = await sendAllDigests();
  res.json({ ok: true, ...result });
});

// Preview the signed-in user's own digest without sending, for a settings
// page or just to see what it would contain.
router.get("/preview", requireAuth, async (req, res) => {
  const digest = await buildDigestFor(req.userId);
  res.json({ hasContent: !!digest, text: digest ? digest.text : null });
});

export default router;
