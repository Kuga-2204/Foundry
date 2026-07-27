import db from "../db/index.js";
import { notify } from "./notify.js";

// Reports on one piece of content before it's auto-hidden pending review.
export const HIDE_THRESHOLD = 3;

// Checked highest-strikes-first; first match wins. Mirrors the escalation
// most community platforms use: a couple of strikes just warn, repeat
// offenses cost time, and a account that won't stop gets removed for good.
function consequenceForStrikes(strikes) {
  if (strikes >= 7) return { action: "ban" };
  if (strikes >= 5) return { action: "suspend", days: 14 };
  if (strikes >= 3) return { action: "suspend", days: 3 };
  return { action: "warn" };
}

// Add one strike to an account and apply whatever consequence that strike
// count now triggers. Always notifies the account directly - never anyone
// else - so the person responsible knows exactly what happened and why.
export async function applyStrike(userId) {
  if (!userId) return;
  const user = await db.prepare("UPDATE users SET strikes = strikes + 1 WHERE id = ? RETURNING strikes").get(userId);
  if (!user) return;

  const consequence = consequenceForStrikes(user.strikes);

  if (consequence.action === "ban") {
    await db.prepare("UPDATE users SET banned = 1 WHERE id = ?").run(userId);
    await notify(
      userId,
      "moderation",
      "Your account has been permanently banned after repeated reports of content that violated our guidelines.",
      "/"
    );
  } else if (consequence.action === "suspend") {
    const until = new Date(Date.now() + consequence.days * 86400000);
    await db.prepare("UPDATE users SET suspended_until = ? WHERE id = ?").run(until.toISOString(), userId);
    await notify(
      userId,
      "moderation",
      `Your account has been suspended for ${consequence.days} days after repeated reports of content that violated our guidelines. You'll be able to post and comment again after ${until.toLocaleDateString()}.`,
      "/"
    );
  } else {
    await notify(
      userId,
      "moderation",
      "Content you posted was reported and hidden for violating our guidelines. This is a warning - repeated reports will lead to a suspension.",
      "/"
    );
  }
}

// Called after every new report. If this report just pushed the target over
// the hide threshold, hide it, tell its author, and strike their account.
// Uses an UPDATE guarded by "hidden = 0" so the hide + strike only ever fire
// once per target, no matter how many more reports arrive afterward.
export async function hideIfReported(targetType, targetId) {
  const { count } = await db
    .prepare("SELECT COUNT(*)::int AS count FROM reports WHERE target_type = ? AND target_id = ?")
    .get(targetType, targetId);
  if (count < HIDE_THRESHOLD) return;

  const table = targetType === "problem" ? "problems" : "comments";
  const returning = targetType === "problem" ? "user_id" : "user_id, problem_id";
  const hidden = await db
    .prepare(`UPDATE ${table} SET hidden = 1 WHERE id = ? AND hidden = 0 RETURNING ${returning}`)
    .get(targetId);
  if (!hidden) return;

  const link = targetType === "problem" ? `/problems/${targetId}` : `/problems/${hidden.problem_id}`;
  await notify(
    hidden.user_id,
    "moderation",
    "Your " + (targetType === "problem" ? "post" : "comment") + " was hidden pending review after being reported multiple times.",
    link
  );
  await applyStrike(hidden.user_id);
}
