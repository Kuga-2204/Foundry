export function optimisticVote(problem, type) {
  if (!problem || ![1, -1].includes(type)) return problem;

  const current = problem.myVote ?? null;
  const next = current === type ? null : type;
  let upvotes = Number(problem.upvotes ?? problem.score ?? 0);
  let downvotes = Number(problem.downvotes ?? 0);
  let followerCount = Number(problem.followerCount ?? 0);
  let isFollowing = !!problem.isFollowing;

  if (current === 1) upvotes -= 1;
  if (current === -1) downvotes -= 1;
  if (next === 1) upvotes += 1;
  if (next === -1) downvotes += 1;

  if (next === 1 && !isFollowing) {
    followerCount += 1;
    isFollowing = true;
  }

  return {
    ...problem,
    myVote: next,
    upvotes: Math.max(0, upvotes),
    downvotes: Math.max(0, downvotes),
    score: Math.max(0, upvotes),
    followerCount: Math.max(0, followerCount),
    isFollowing,
    hasStake: !!problem.isMine || next !== null,
  };
}