import db from "../db/index.js";

// A user has a stake in a problem when they posted it or voted on it.
// Only stakeholders can review solutions to that problem.
export async function hasStake(problemId, userId) {
  if (!userId) return false;
  const problem = await db.prepare("SELECT user_id FROM problems WHERE id = ?").get(problemId);
  if (!problem) return false;
  if (problem.user_id === userId) return true;
  const vote = await db
    .prepare("SELECT id FROM votes WHERE problem_id = ? AND user_id = ?")
    .get(problemId, userId);
  return !!vote;
}
