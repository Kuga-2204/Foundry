# Foundry: your problem, matched to the startup solving it

A full-stack app where people describe real-life problems and get matched with
startups already solving them. If no startup solves it yet, the problem is
listed publicly: others vote and follow it, startups discover it as a lead,
commit to building a fix, and ship to an audience that was already waiting.
Reviews are stake-gated (only people who posted or voted on the problem) and
outcome-based (solved / partial / unsolved).

See PRODUCT.md for the full product spec.

## Stack
- **Backend**: Node + Express + SQLite (via `better-sqlite3`, zero setup, no
  external DB server needed), JWT auth, bcrypt password hashing.
- **Frontend**: React 18 + Vite + React Router. Plain CSS with design tokens
  (no Tailwind), inline styles per component for simplicity.

## Project structure
```
backend/
  server.js             Express app entrypoint
  db/index.js           SQLite connection + schema (auto-created on first run)
  db/seed.js            seeds sample unclaimed startup profiles (npm run seed)
  lib/match.js          problem-to-startup text matching engine
  lib/notify.js         notifications + problem followers
  lib/stake.js          shared review-eligibility rule
  middleware/auth.js    JWT auth middleware
  routes/
    auth.js             register / login / me
    problems.js         post/browse/vote/follow, live matching, commit/ship
    solutions.js        post solutions (personally or as a startup)
    reviews.js          stake-gated, outcome-based reviews
    startups.js         directory, profiles, claiming, lead feed
    notifications.js    in-app notification feed
frontend/
  src/
    pages/              Home, Login, Register, Problems, ProblemDetail,
                        PostProblem (with live matching), Startups,
                        StartupDetail, StartupForm, Dashboard
    components/         NavBar, NotificationsBell, VoteControl, ProblemCard,
                        StartupCard, StatusBadge, Stars
    context/            AuthContext (JWT stored in localStorage)
    api.js              thin fetch wrapper for the backend API
    utils.js            date parsing + status/outcome labels
```

## Running it locally

**1. Backend** (port 4000, creates `problemhub.sqlite` automatically):
```
cd backend
npm install
npm run seed   # optional: sample startups so matching works out of the box
npm start
```

**2. Frontend** (port 5173, proxies `/api/*` to the backend):
```
cd frontend
npm install
npm run dev
```

Set `JWT_SECRET` in `backend/.env` before deploying anywhere real.
