import db from "../db/index.js";

const insert = db.prepare(
  "INSERT INTO notifications (user_id, type, message, link) VALUES (?, ?, ?, ?)"
);

export function notify(userId, type, message, link = "") {
  if (!userId) return;
  insert.run(userId, type, message, link);
}

// Notify everyone following a problem, except the actor who caused the event.
export function notifyFollowers(problemId, exceptUserId, type, message, link = "") {
  const followers = db
    .prepare("SELECT user_id FROM problem_followers WHERE problem_id = ?")
    .all(problemId);
  const seen = new Set();
  for (const f of followers) {
    if (f.user_id === exceptUserId || seen.has(f.user_id)) continue;
    seen.add(f.user_id);
    insert.run(f.user_id, type, message, link);
  }
}

export function follow(problemId, userId) {
  if (!userId) return;
  db.prepare(
    "INSERT OR IGNORE INTO problem_followers (problem_id, user_id) VALUES (?, ?)"
  ).run(problemId, userId);
}
