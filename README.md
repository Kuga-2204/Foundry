# Foundry — Problem → Product marketplace

A full-stack app where people post real-life problems, the crowd validates them with
upvotes/downvotes, builders submit their products as solutions, and only people with a
stake in the problem (the poster, or anyone who voted) can view-and-approve a solution
with a star rating + written review.

## Stack
- **Backend**: Node + Express + SQLite (via `better-sqlite3`, zero setup — no external DB
  server needed), JWT auth, bcrypt password hashing.
- **Frontend**: React 18 + Vite + React Router. Plain CSS with design tokens (no Tailwind),
  inline styles per component for simplicity.

## Project structure
```
problemhub/
  backend/
    server.js          Express app entrypoint
    db/index.js         SQLite connection + schema (auto-created on first run)
    middleware/auth.js  JWT auth middleware
    routes/
      auth.js            register / login / me
      problems.js        post/browse/vote on problems
      solutions.js        provide/view solutions to a problem
      reviews.js          submit/view reviews (stake-gated)
  frontend/
    src/
      pages/            Home (marketing), Login, Register, Problems (feed),
                          ProblemDetail (vote + solutions + reviews), PostProblem
      components/       NavBar, VoteControl, ProblemCard, Stars
      context/          AuthContext (JWT stored in localStorage)
      api.js             thin fetch wrapper for the backend API
```

## Running it locally

**1. Backend** (starts on port 4000, creates `problemhub.sqlite` automatically):
```
cd backend
npm install
npm start
```

**2. Frontend** (starts on port 5173, proxies `/api/*` to the backend):
```
cd frontend
npm install
npm run dev
```

Open http://localhost:5173

## How the core rules are implemented

- **Upvote/downvote**: one vote per user per problem (`votes` table, unique on
  `problem_id, user_id`). Clicking the same arrow again removes your vote (toggle).
  The problem's score = upvotes − downvotes, and the feed can be sorted by it.
- **Provide Solution**: any logged-in user can submit a solution to any problem —
  title, description, and an optional link to the actual product.
- **View / Approve Solution**: solutions are visible to everyone, but the **review
  form** (star rating + written feedback) is only shown to users who either posted
  the original problem or cast a vote (up or down) on it — the backend enforces this
  with a 403 on the `/api/reviews` endpoint too, so it can't be bypassed by calling
  the API directly.
- **Homepage**: pure marketing page — a blueprint-style schematic diagram of the
  problem → validation → build → review pipeline, a four-step feature walkthrough,
  and a two-sided pitch (for people posting problems, and for builders).

## Notes for production use
This is a working MVP, not production-hardened:
- Swap the hardcoded JWT secret (`middleware/auth.js`) for a real env var.
- Add rate limiting / input sanitization beyond the current basic validation.
- SQLite is fine for an MVP; move to Postgres if you expect concurrent write load.
- Add pagination to the problems feed once volume grows.
