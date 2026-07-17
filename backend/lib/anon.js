// Anonymous problems keep their real user_id in the database (stake checks,
// dashboards, and notifications still work), but every API response must hide
// who posted them. Call this on any problem row that leaves the server.
export function maskAnonymous(problem, viewerId = null) {
  if (!problem || !problem.is_anonymous) return problem;
  return {
    ...problem,
    author_name: "Anonymous",
    user_id: null,
    isMine: !!viewerId && problem.user_id === viewerId,
  };
}
