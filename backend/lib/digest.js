import db from "../db/index.js";
import { matchProblemsForStartup } from "./match.js";
import { sendMail } from "./email.js";

const APP_URL = process.env.APP_URL || "http://localhost:5173";

// Build one user's weekly digest: fresh problems matching startups they own,
// plus recent activity on problems they follow. Returns null when there's
// nothing worth an email, so we never send an empty "here's your nothing".
export function buildDigestFor(userId) {
  const user = db.prepare("SELECT id, name, email FROM users WHERE id = ?").get(userId);
  if (!user) return null;

  const sinceClause = "created_at > strftime('%Y-%m-%dT%H:%M:%SZ','now','-7 days')";
  const sections = [];

  // Startup owners: new matching problems posted this week.
  const startups = db.prepare("SELECT id, name FROM startups WHERE owner_user_id = ?").all(userId);
  for (const s of startups) {
    const { strong } = matchProblemsForStartup(s.id);
    const fresh = strong
      .map((m) => m.problem)
      .filter((p) => db.prepare(`SELECT 1 FROM problems WHERE id = ? AND ${sinceClause}`).get(p.id));
    if (fresh.length > 0) {
      sections.push({
        heading: `New problems matching ${s.name}`,
        items: fresh.slice(0, 5).map((p) => ({ title: p.title, url: `${APP_URL}/problems/${p.id}` })),
      });
    }
  }

  // Followed problems that got a solution or shipped fix this week.
  const followedUpdates = db
    .prepare(
      `SELECT DISTINCT p.id, p.title FROM problem_followers f
       JOIN problems p ON p.id = f.problem_id
       WHERE f.user_id = ?
         AND (
           EXISTS (SELECT 1 FROM solutions s WHERE s.problem_id = p.id AND s.${sinceClause})
           OR EXISTS (SELECT 1 FROM commitments c WHERE c.problem_id = p.id AND c.${sinceClause})
         )`
    )
    .all(userId);
  if (followedUpdates.length > 0) {
    sections.push({
      heading: "Updates on problems you follow",
      items: followedUpdates.slice(0, 8).map((p) => ({ title: p.title, url: `${APP_URL}/problems/${p.id}` })),
    });
  }

  if (sections.length === 0) return null;

  const text =
    `Hi ${user.name},\n\nHere's what moved on Solvyard this week:\n\n` +
    sections
      .map((sec) => `${sec.heading}:\n` + sec.items.map((i) => `  - ${i.title}\n    ${i.url}`).join("\n"))
      .join("\n\n") +
    `\n\nSee more: ${APP_URL}/problems?sort=trending\n`;

  return { user, sections, text };
}

// Send digests to everyone who has something waiting. Returns a summary of
// how many were sent vs. skipped (nothing to say).
export async function sendAllDigests() {
  const users = db.prepare("SELECT id FROM users").all();
  let sent = 0;
  let skipped = 0;
  for (const u of users) {
    const digest = buildDigestFor(u.id);
    if (!digest) {
      skipped++;
      continue;
    }
    await sendMail({
      to: digest.user.email,
      subject: "Your weekly Solvyard digest",
      text: digest.text,
    });
    sent++;
  }
  return { sent, skipped, total: users.length };
}
