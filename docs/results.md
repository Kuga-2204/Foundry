# Benchmark Results

This document records the methodology and results used to support the current Solvyard agent performance claims. The goal is not to claim production-scale load testing; it is to show that the main workflow is automated, reproducible, and fast enough for local review while expensive agent work is kept off the normal page-load path.

## Environment

- Machine: local Windows development machine
- Date: 2026-08-03
- Node: v24.12.0
- Branch: `skandesh`
- Backend: `http://127.0.0.1:4000`
- Frontend: Vite dev server on `http://127.0.0.1:5173`
- Database: Supabase Postgres through backend `.env`
- Agent provider: OpenAI API with web search enabled

## Methodology

The benchmark focuses on the main shipped workflow:

1. Run deterministic evaluation tests for the in-repo agent framework and social posting integration.
2. Run backend syntax checks for agent and route modules.
3. Build the production frontend bundle.
4. Read cached social discovery results through the public backend endpoint.
5. Run the backend social posting agent once for a single category to confirm that discoveries become credited Solvyard posts.

The tests are intentionally deterministic. They do not call live OpenAI or Supabase. Live agent imports are measured separately because external search latency depends on network and provider behavior.

## Automated Evaluation

Command:

```bash
npm.cmd test
```

Result:

| Metric | Value |
| --- | ---: |
| Tests | 4 |
| Passed | 4 |
| Failed | 0 |
| Duration reported by Node test runner | 223.1854 ms |
| End-to-end command duration | 1662.7 ms |

Covered passing cases:

- `AgentWorkflow` runs agents in order and preserves shared context.
- `Agent` and `AgentWorkflow` reject invalid construction inputs.
- Social posting workflow includes discovery, dedupe, and posting agents.
- Problem schema and UI preserve original source attribution.

No failing evaluation cases are included in `tests/evaluation.test.ts`.

## Build And Static Checks

| Check | Command | Result | Duration |
| --- | --- | --- | ---: |
| Backend syntax checks | `node --check` across agent/route modules | Pass | 888.5 ms |
| Frontend production build | `npm.cmd run build --prefix frontend` | Pass | 1904.5 ms |

Frontend build output:

| Asset | Size | Gzip |
| --- | ---: | ---: |
| `dist/index.html` | 2.19 kB | 0.78 kB |
| `dist/assets/index-CP71KAYw.css` | 3.77 kB | 1.43 kB |
| `dist/assets/index-D90fJZw9.js` | 298.49 kB | 84.96 kB |

## Cached Social Discovery Read

Command:

```powershell
Invoke-RestMethod -Uri 'http://127.0.0.1:4000/api/problems/social-discovery?category=Productivity'
```

Result:

| Metric | Value |
| --- | ---: |
| Returned problem signals | 6 |
| Cache hit | true |
| Searched flag | true |
| Endpoint duration | 1829.2 ms |

Interpretation: normal page loads can read previously discovered social signals from the cache instead of rerunning the web-search agents. This keeps the browsing path responsive and avoids repeated metered search calls.

## Agentic Import Run

Command:

```bash
cd backend
npm.cmd run agent:import-social -- --category=Productivity --per-category=1
```

Result from the measured run:

| Metric | Value |
| --- | ---: |
| Categories | 1 |
| Discovered | 4 |
| Imported as Solvyard posts | 4 |
| Skipped | 0 |
| Failed | 0 |
| Total command time | 40.4 s |

Agent trace:

| Agent | Responsibility | Duration |
| --- | --- | ---: |
| `DiscoverProblemsAgent` | Run social discovery and collect credited public problem signals | 34406 ms |
| `DedupeAgent` | Skip already-imported source URLs and exact title/category duplicates | 2180 ms |
| `PostingAgent` | Create Solvyard problem posts with source attribution fields | 905 ms |

Nested discovery trace:

| Agent | Responsibility | Duration |
| --- | --- | ---: |
| `DiscoveryPlanner` | Normalize scope and limits | 0 ms |
| `SourceScoutSwarm` | Run source-scoped web-search scouts in parallel | 34406 ms |
| `EvidenceVerifier` | Deduplicate and keep source-host-verified items | 0 ms |

Interpretation: the slow part is the expected live public-source search. The actual database posting step completed in under one second for the measured import. The workflow is suitable for a backend job or cron, while cached results keep the frontend browse path fast.

## Imported Post Verification

After the import run, the Productivity feed returned credited Solvyard posts authored by `Solvyard Radar` with original source links:

| ID | Source | Example title |
| ---: | --- | --- |
| 29 | Reddit | Struggling to make to-do lists work for long-term planning |
| 30 | X | Burnout causing inability to get work done after years of overwork |
| 31 | LinkedIn | Tool overload is killing productivity |
| 32 | Hacker News | Post-burnout job search paralysis |

Each imported problem stores:

- `source_name`
- `source_url`
- `source_evidence`
- `source_posted_at`
- `source_imported_at`

## Performance Claims Supported

The current implementation supports these claims:

- The deterministic evaluation suite passes completely.
- The frontend production build completes in under 2 seconds locally.
- Backend syntax checks complete in under 1 second locally.
- Cached social discovery reads avoid rerunning live agents on ordinary page load.
- The social posting workflow is fully backend-run and can import credited posts without the frontend.
- The slow external-search portion is isolated to an explicit import job, while dedupe and posting are fast.

## Notes And Limits

These are local development measurements, not a distributed load test. Live social discovery latency will vary with OpenAI web search, network conditions, and public source availability. X and LinkedIn are accessed through web search scoped to their domains, not by logging into accounts or bypassing platform restrictions.
