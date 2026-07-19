import db from "../db/index.js";

// Lightweight analytics for startup dashboards. One event per viewer per
// startup per 30 minutes: a user retyping their problem five times while the
// live match panel refreshes is one interested person, not five.
export async function track(type, startupId, userId = null) {
  if (!startupId) return;
  if (userId) {
    const recent = await db
      .prepare(
        `SELECT id FROM events
         WHERE type = ? AND startup_id = ? AND user_id = ?
           AND created_at > now() - interval '30 minutes'`
      )
      .get(type, startupId, userId);
    if (recent) return;
  }
  await db.prepare("INSERT INTO events (type, startup_id, user_id) VALUES (?, ?, ?)").run(
    type,
    startupId,
    userId
  );
}

export async function statsFor(startupId) {
  const count = async (type, sinceModifier = null) => {
    let sql = "SELECT COUNT(*) AS c FROM events WHERE type = ? AND startup_id = ?";
    if (sinceModifier) sql += ` AND created_at > now() - ?::interval`;
    const stmt = db.prepare(sql);
    return sinceModifier
      ? (await stmt.get(type, startupId, sinceModifier)).c
      : (await stmt.get(type, startupId)).c;
  };
  return {
    profileViews: { total: await count("profile_view"), week: await count("profile_view", "7 days") },
    searchAppearances: { total: await count("search_match"), week: await count("search_match", "7 days") },
  };
}
