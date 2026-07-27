import jwt from "jsonwebtoken";
import db from "../db/index.js";

const SECRET = process.env.JWT_SECRET || "dev-secret-change-me";

// Blocks write/action routes for accounts under a moderation consequence.
// Reads go through optionalAuth instead, so browsing is never affected.
export async function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Not authenticated" });
  let payload;
  try {
    payload = jwt.verify(token, SECRET);
  } catch {
    return res.status(401).json({ error: "Invalid or expired session" });
  }

  const user = await db.prepare("SELECT banned, suspended_until FROM users WHERE id = ?").get(payload.userId);
  if (!user) return res.status(401).json({ error: "Invalid or expired session" });
  if (user.banned) {
    return res.status(403).json({ error: "Your account has been permanently banned." });
  }
  if (user.suspended_until && new Date(user.suspended_until) > new Date()) {
    const until = new Date(user.suspended_until).toLocaleDateString();
    return res.status(403).json({ error: `Your account is suspended until ${until}.` });
  }

  req.userId = payload.userId;
  next();
}

// Attaches req.userId if a valid token is present, but doesn't block the request.
export function optionalAuth(req, _res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (token) {
    try {
      const payload = jwt.verify(token, SECRET);
      req.userId = payload.userId;
    } catch {
      // ignore invalid token, treat as anonymous
    }
  }
  next();
}

export { SECRET };
