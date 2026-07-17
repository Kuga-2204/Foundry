# Solvyard: Product Spec (Startup Matching Model)

> One-liner: **"Is there a startup for that?"** People describe a problem from
> their daily life. Solvyard matches them with startups already solving it. If
> nothing exists, the problem gets listed publicly and the poster is first in
> line when a startup commits to a fix.

## Why this model

Idea boards die because upvotes are cheap, nothing transacts on the platform,
and posters get nothing back. This model fixes all three without adding
friction:

1. **Users arrive with natural intent.** "Does something solve my problem?" is
   a question people already ask constantly. Solvyard answers it in one search,
   so the demand signal (a listed problem) is exhaust from a failed search,
   not homework.
2. **Startups get paid in distribution.** Leads (users describing the exact
   pain they solve, in their own words), gap intelligence (adjacent problems
   in their space), and a launch audience (everyone following a problem is
   notified when the startup ships a fix).
3. **Trust comes from stake-gated, outcome-based reviews.** Only people who
   posted or voted on a problem can review its solutions, and every review
   answers "did it actually solve it: solved / partial / unsolved". Matches
   are never pay-ranked.

## The loop

```
describe problem -> match found?        -> yes: solution + verified reviews (startup gets a lead)
                                        -> no:  list it -> others vote/follow -> startup commits
                                                -> problem status: open -> building -> solved
                                                -> every transition notifies all followers
```

## What is implemented

### For people with problems
- Live matching while typing on the post-a-problem page: strong matches
  ("may already solve this") and adjacent startups shown side by side.
- The no-match state is a first-mover moment: "No startup solves this yet.
  You're the first to raise it."
- Follow any problem (auto-follow on posting and voting). Notification feed
  in the navbar: solutions posted, startups committing, fixes shipping.
- Problem lifecycle: open -> building (a startup committed) -> solved
  (the fix shipped). Status badges and filters across the feed.
- Outcome-based reviews (solved / partial / unsolved + stars + feedback),
  stake-gated, with self-review blocked.

### For startups
- Startup profiles: name, tagline, description, website, category, plus
  "problems we solve" statements written in plain user language. The
  statements are the matching corpus.
- Two-tier catalog: seeded unclaimed profiles (run `npm run seed` in
  backend/) and claimed profiles. Claiming currently needs no verification;
  production needs a work-email or manual review step.
- Dashboard with a lead feed: matched problems (with the matched terms and
  the user's raw phrasing) and adjacent problems as roadmap signal.
- Commit flow on any problem: "we're building this" (followers notified),
  then "mark as shipped" (followers notified again; they are the launch
  audience). Solutions can be posted as the startup, linked to its profile.
- Owners get notified when a newly posted problem matches their statements.

## Launch strategy (features cannot fix liquidity)

- Recruit the first 10 to 15 startups **in one vertical** so matches actually
  happen. Density beats coverage.
- Seed the directory by hand beyond the partners so search returns answers
  from day one (the seed script is a template for this).
- Pitch to startups: leads + voice-of-customer phrasing + beta audience,
  not "visibility".
- Metrics to watch: match rate per posted problem, week-2 return rate,
  percent of listed problems that get a commitment.

## Later phases

- Weekly email digest (newly solved problems you follow, trending gaps per
  category).
- Semantic matching (embeddings over statements) once keyword overlap stops
  being enough. AI stays plumbing over Solvyard's own data; the moat is the
  problem/match/review dataset, not the model.
- Monetization, off the user path: startup freemium (claimed profile free;
  paid tier for lead contact details, analytics, promoted-but-labeled
  placement). Users never pay.
