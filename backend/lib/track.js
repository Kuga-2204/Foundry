import db from "../db/index.js";

// Lightweight analytics for startup dashboards. One event per viewer per
// startup per 30 minutes: a user retyping their problem five times while the
// live match panel refreshes is one interested person, not five.
export function track(type, startupId, userId = null) {
  if (!startupId) return;
  if (userId) {
    const recent = db
      .prepare(
        `SELECT id FROM events
         WHERE type = ? AND startup_id = ? AND user_id = ?
           AND created_at > strftime('%Y-%m-%dT%H:%M:%SZ','now','-30 minutes')`
      )
      .get(type, startupId, userId);
    if (recent) return;
  }
  db.prepare("INSERT INTO events (type, startup_id, user_id) VALUES (?, ?, ?)").run(
    type,
    startupId,
    userId
  );
}

export function statsFor(startupId) {
  const count = (type, sinceModifier = null) => {
    let sql = "SELECT COUNT(*) AS c FROM events WHERE type = ? AND startup_id = ?";
    if (sinceModifier) sql += ` AND created_at > strftime('%Y-%m-%dT%H:%M:%SZ','now',?)`;
    const stmt = db.prepare(sql);
    return sinceModifier ? stmt.get(type, startupId, sinceModifier).c : stmt.get(type, startupId).c;
  };
  return {
    profileViews: { total: count("profile_view"), week: count("profile_view", "-7 days") },
    searchAppearances: { total: count("search_match"), week: count("search_match", "-7 days") },
  };
}
