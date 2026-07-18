import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { OAuth2Client } from "google-auth-library";
import db from "../db/index.js";
import { requireAuth, SECRET } from "../middleware/auth.js";
import { sendMail } from "../lib/email.js";

const router = Router();

const APP_URL = process.env.APP_URL || "http://localhost:5173";
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "";
const googleClient = GOOGLE_CLIENT_ID ? new OAuth2Client(GOOGLE_CLIENT_ID) : null;

function signToken(userId) {
  return jwt.sign({ userId }, SECRET, { expiresIn: "30d" });
}

function publicUser(u) {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    bio: u.bio,
    anon_handle: u.anon_handle || null,
    created_at: u.created_at,
  };
}

router.post("/register", (req, res) => {
  const { name, email, password } = req.body;
  if (!name?.trim() || !email?.trim() || !password || password.length < 6) {
    return res.status(400).json({ error: "Name, email, and a password of 6+ characters are required." });
  }
  const hash = bcrypt.hashSync(password, 10);
  let info;
  try {
    info = db
      .prepare("INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)")
      .run(name.trim(), email.toLowerCase().trim(), hash);
  } catch (err) {
    if (String(err.message).includes("UNIQUE")) {
      return res.status(409).json({ error: "An account with that email already exists." });
    }
    throw err;
  }

  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(info.lastInsertRowid);
  res.status(201).json({ token: signToken(user.id), user: publicUser(user) });
});

router.post("/login", (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: "Email and password are required." });

  const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email.toLowerCase().trim());
  // Google-only accounts have an empty password_hash; bcrypt safely returns false.
  if (!user || !user.password_hash || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: "Incorrect email or password." });
  }
  res.json({ token: signToken(user.id), user: publicUser(user) });
});

// Sign in with Google. The frontend gets an ID token from Google Identity
// Services and posts it here; we verify it against Google's keys, then match
// or create a local account by email. New Google users have no password.
router.post("/google", async (req, res) => {
  if (!googleClient) {
    return res.status(501).json({ error: "Google sign-in isn't configured on this server." });
  }
  const { credential } = req.body;
  if (!credential) return res.status(400).json({ error: "Missing Google credential." });

  let payload;
  try {
    const ticket = await googleClient.verifyIdToken({ idToken: credential, audience: GOOGLE_CLIENT_ID });
    payload = ticket.getPayload();
  } catch {
    return res.status(401).json({ error: "Could not verify your Google sign-in. Please try again." });
  }
  if (!payload?.email || !payload.email_verified) {
    return res.status(401).json({ error: "Your Google account has no verified email." });
  }

  const email = payload.email.toLowerCase().trim();
  let user = db.prepare("SELECT * FROM users WHERE email = ?").get(email);
  if (!user) {
    const info = db
      .prepare("INSERT INTO users (name, email, password_hash, google_id) VALUES (?, ?, '', ?)")
      .run(payload.name || email.split("@")[0], email, payload.sub);
    user = db.prepare("SELECT * FROM users WHERE id = ?").get(info.lastInsertRowid);
  } else if (!user.google_id) {
    // Existing password account signing in with Google for the first time: link them.
    db.prepare("UPDATE users SET google_id = ? WHERE id = ?").run(payload.sub, user.id);
  }

  res.json({ token: signToken(user.id), user: publicUser(user) });
});

router.get("/me", requireAuth, (req, res) => {
  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(req.userId);
  if (!user) return res.status(404).json({ error: "User not found." });
  res.json({ user: publicUser(user) });
});

// Request a reset link. Always responds the same way whether or not the email
// exists, so this endpoint can't be used to discover which emails have
// accounts. The raw token goes only in the email; the DB stores just its hash.
router.post("/forgot-password", async (req, res) => {
  const email = String(req.body.email || "").toLowerCase().trim();
  const generic = { ok: true, message: "If that email has an account, a reset link is on its way." };
  if (!email) return res.status(400).json({ error: "Enter your email." });

  const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email);
  if (!user) return res.json(generic);

  const rawToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString().replace(/\.\d+Z$/, "Z");

  db.prepare(
    "INSERT INTO password_resets (user_id, token_hash, expires_at) VALUES (?, ?, ?)"
  ).run(user.id, tokenHash, expiresAt);

  const link = `${APP_URL}/reset-password?token=${rawToken}`;
  try {
    await sendMail({
      to: user.email,
      subject: "Reset your Solvyard password",
      text: `Hi ${user.name},\n\nReset your password with this link (valid for 1 hour):\n${link}\n\nIf you didn't ask for this, you can ignore this email.`,
    });
  } catch (err) {
    console.error("reset email failed:", err.message);
  }
  res.json(generic);
});

router.post("/reset-password", (req, res) => {
  const { token, password } = req.body;
  if (!token || !password || password.length < 6) {
    return res.status(400).json({ error: "A valid reset link and a password of 6+ characters are required." });
  }
  const tokenHash = crypto.createHash("sha256").update(String(token)).digest("hex");
  const row = db
    .prepare(
      `SELECT * FROM password_resets
       WHERE token_hash = ? AND used = 0
         AND expires_at > strftime('%Y-%m-%dT%H:%M:%SZ','now')`
    )
    .get(tokenHash);
  if (!row) return res.status(400).json({ error: "This reset link is invalid or has expired." });

  const hash = bcrypt.hashSync(password, 10);
  db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(hash, row.user_id);
  db.prepare("UPDATE password_resets SET used = 1 WHERE id = ?").run(row.id);
  // Any other outstanding links for this account are now moot.
  db.prepare("UPDATE password_resets SET used = 1 WHERE user_id = ? AND used = 0").run(row.user_id);

  res.json({ ok: true, message: "Your password has been reset. You can log in now." });
});

export default router;
