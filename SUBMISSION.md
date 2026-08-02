# Solvyard: submission guide

Solvyard answers one question: **is there already a startup solving my problem?**

You describe a frustration in your own words. Solvyard matches you to a startup
that solves it. If nothing does, the problem is listed publicly so others can
vote and follow it, startups can see the demand and commit to building a fix,
and everyone waiting gets notified when it ships. Reviews are restricted to
people who actually had the problem.

This file points to the code that matters, how to run it, and exactly what is
sample data or depends on an external service.

---

## Start here: the three files that carry the idea

### `backend/lib/agent.js`
The matching agent, and the most interesting file in the repo.

Keyword matching alone is too generous: it surfaced a design-to-code tool for a
rent-splitting problem because both texts contained "turn" and "about". This
file re-reads the keyword shortlist against the problem in context and rules on
each candidate as `solves`, `adjacent` or `unrelated`, then writes the
one-sentence reason shown on each match card.

It also handles the cold-start case. When nothing in the directory solves the
problem, `searchWeb()` runs a live web search and returns real products with
working links. It is prompted and filtered to return a company's own home page,
never a review site or a roundup, and `tidyUrl()` rejects the ones that slip
through.

Both paths degrade safely: with no `OPENAI_API_KEY` set, or on any API error,
every export no-ops and matching falls back to plain keyword ranking. The site
never breaks because the model is unavailable.

### `backend/routes/problems.js`
The core API, and where the two matching stages are wired together.

- `matchesForProblem()` runs keyword recall, then the agent, and caches the
  rulings in `problem_match_verdicts`.
- `GET /:id/web-matches` is the web fallback, on its own route so the page can
  render before a slow search finishes.
- `prefetchWebMatches()` starts that search in the background the moment a
  problem is posted, so nobody waits on it. A visitor gets cached results in
  under half a second instead of roughly twenty.
- The rest of the problem lifecycle: posting, voting, following, a startup
  committing to build, and marking it shipped.

### `frontend/src/pages/ProblemDetail.jsx`
Where all of it becomes visible: the matched startups with the agent's written
reasons, the separate "Also found on the web" section, solutions, stake-gated
reviews, and the discussion thread.

---

## The rest of the important code

| Path | What it contains |
| --- | --- |
| `backend/lib/match.js` | Stage one. Cheap keyword recall over startup problem statements, deliberately generous because the agent filters it afterwards. Runs on every keystroke; the agent never does. |
| `backend/db/index.js` | The full Postgres schema, created on first run. Also a small adapter that lets the app speak one query dialect over `pg`. |
| `backend/lib/stake.js` | The review eligibility rule: only people who posted or voted on a problem may review its solutions. This is what stops a startup reviewing itself. |
| `backend/lib/moderation.js` | Report escalation. Three reports hide a piece of content and give its author a strike; strikes escalate to a suspension and then a ban. |
| `backend/routes/reports.js` | Accepts reports, refuses self-reports and duplicates. |
| `backend/middleware/auth.js` | JWT auth, and the gate that blocks suspended or banned accounts from writing. |
| `backend/lib/anon.js` | Anonymous posting with a stable per-user handle, so an anonymous poster keeps one identity without revealing who they are. |
| `frontend/src/pages/PostProblem.jsx` | Posting, including the live check that searches the directory while you type and warns you if the problem is already listed. |
| `backend/db/seed.js` | The 12 sample startups. See the sample data note below. |
| `PRODUCT.md` | The full product specification. |

---

## Running it

Needs Node 18+ and a Supabase Postgres database.

**1. Backend, on port 4000.** Creates its schema automatically on first run.

```
cd backend
npm install
cp .env.example .env
```

Then edit `.env` and set `SUPABASE_DB_URL` and `JWT_SECRET`. Both are required.
`OPENAI_API_KEY` is optional; see the table below for what changes without it.

```
npm run seed    # optional, loads the 12 sample startups so matching has data
npm start
```

**2. Frontend, on port 5173.** Proxies `/api/*` to the backend.

```
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`.

### Seeing the matching agent work

1. Sign up, go to **Post**, and enter:
   *"Splitting rent with flatmates always turns into an argument. Every month we
   fight about who used what."*
   Expect a single match, **SplitFair**, with a sentence written about your
   specific problem. The suggestions shown while you are still typing are
   unfiltered keyword matches and will include a false positive; the agent
   removes it once the problem is posted. That difference is the point.
2. Now post:
   *"I keep forgetting which subscriptions I am paying for."*
   Nothing in the directory solves this, so the web fallback runs and returns
   real products such as Rocket Money or Copilot Money, in a clearly separated
   section.

---

## Sample data, external services, and what is not built

Stated plainly, as required.

### Sample data
- **The 12 startups in the directory are invented sample data**, loaded by
  `backend/db/seed.js`. Their `website` fields point at `example.com` and are
  not real companies. They exist so matching has something to match against.
  Real startups would sign up and list themselves through the app.
- Products returned in the **"Also found on the web"** section are the
  opposite: those are real companies found by a live search, and their links go
  to their actual sites.

### External services
| Service | Used for | Without it |
| --- | --- | --- |
| Supabase Postgres | All application data | The backend will not start. Required. |
| OpenAI API | The matching agent and web search | Everything still works. Matching silently falls back to keyword ranking, and the web section never appears. No crash, no error shown to the user. |
| Supabase Storage | Photo and video attachments on problems | Posting still works; attaching media does not. |
| SMTP | Password reset and digest emails | Not configured by default. `backend/lib/email.js` falls back to a transport that prints the message, including any reset link, to the server console. Nothing is sent over the network in local development. |

### Not built
- **There are no automated tests.** Nothing in this repo is test-covered.
  Everything was verified by hand against a live database and a live API.
- Notifications are in-app only and are polled once a minute. There is no
  push or websocket delivery.
- The web search runs about twenty seconds when cold. It is cached for 30 days
  per problem, and prefetched in the background at post time so a reader
  normally never waits on it. On a serverless host that cuts off work after the
  response is sent, the prefetch may not complete and the first reader falls
  back to waiting for the on-demand search.
- The keyword matcher is English-only and uses word overlap, not embeddings.

---

## A note on credentials

`backend/.env` holds all secrets and is gitignored. `backend/.env.example`
contains placeholders only and is the file to copy.

If you are reviewing the commit history rather than the current tree, note that
earlier commits of `backend/.env.example` contained real Supabase values that
have since been replaced with placeholders. Those credentials are being rotated.
