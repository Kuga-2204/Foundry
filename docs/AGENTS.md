# Solvyard Agent Framework

Solvyard uses a small in-repo agent framework for background workflows that need more structure than one model request. The framework lives in `backend/lib/agentic.js` and is intentionally dependency-light: it gives us named agents, ordered workflows, shared context, and trace output without hiding the database or product logic behind a black box.

## Why This Exists

The social problem radar should not be a frontend button that asks an LLM for a blob of text. It needs to behave like an operator:

1. Plan the search scope.
2. Scout multiple public sources.
3. Verify and dedupe findings.
4. Post valid problems into Solvyard.
5. Credit the original source with a link.

That is why the implementation is split into agents with explicit responsibilities.

## Core Framework

`backend/lib/agentic.js` exports two primitives.

`Agent` is a named worker with instructions and a `run(context)` function. Each agent receives the workflow context and returns the next context.

`AgentWorkflow` runs agents in sequence and records a trace for each step, including the agent name, instructions, and runtime in milliseconds.

Example shape:

```js
const workflow = new AgentWorkflow({
  name: "example-workflow",
  agents: [
    new Agent({
      name: "Planner",
      instructions: "Normalize inputs before work starts.",
      run: async (context) => ({ ...context, planned: true }),
    }),
  ],
});
```

## Social Discovery Workflow

Defined in `backend/lib/agent.js` as `socialDiscoveryWorkflow`.

Agents:

- `DiscoveryPlanner`: normalizes selected categories, source list, and per-category limits.
- `SourceScoutSwarm`: runs one scout per source in parallel. Each scout uses OpenAI web search, scoped to its assigned source.
- `EvidenceVerifier`: dedupes URLs and keeps clean, source-host-verified problem signals.

Sources currently searched:

- Reddit
- X / Twitter
- LinkedIn
- Hacker News
- Quora

The discovery workflow returns problem signals with:

- `category`
- `source`
- `title`
- `description`
- `evidence`
- `url`
- `posted_at`

Cached read endpoint:

```http
GET /api/problems/social-discovery?category=Productivity
```

Fresh command-driven import through the API:

```http
POST /api/problems/social-discovery/command
Content-Type: application/json

{
  "command": "Import the latest Productivity social problems, two per category."
}
```

The API route is still backend-owned. The frontend does not call OpenAI directly.

## Social Posting Workflow

Defined in `backend/lib/socialPostingAgent.js`.

Agents:

- `CommandInterpreterAgent`: converts a user/admin command into categories, limits, and posting intent.
- `DiscoverProblemsAgent`: calls the social discovery workflow and collects public problem signals.
- `DedupeAgent`: skips items already imported by original source URL or exact title/category.
- `PostingAgent`: inserts first-class Solvyard problem rows with attribution fields.

CLI command entrypoint:

```bash
cd backend
npm run agent:import-social -- --command="Import the latest Productivity social problems, two per category."
```

Imported problems are posted by the system user:

```text
Solvyard Radar <radar@solvyard.local>
```

The agent creates this user automatically if it does not exist.

## Source Credit

Imported problems are real `problems` records with extra attribution columns:

- `source_name`
- `source_url`
- `source_evidence`
- `source_posted_at`
- `source_imported_at`

There is a unique index on `source_url` so the same Reddit/X/LinkedIn/etc post is not imported twice.

Frontend display:

- Problem cards show `Originally from <source>`.
- Problem detail pages show the same source credit with the original link.

## Running Without The Frontend

This is the fully backend agent path. It discovers and posts problems without a browser or frontend API call.

```bash
cd backend
npm run agent:import-social -- --category=Productivity --per-category=1
```

All categories:

```bash
npm run agent:import-social -- --category=All --per-category=1
```

Multiple categories:

```bash
npm run agent:import-social -- --category=Productivity,Finance --per-category=1
```

This command prints a JSON summary with discovered, imported, skipped, failed, and agent trace counts.

## Environment

Required for the app:

```env
SUPABASE_DB_URL=...
JWT_SECRET=...
```

Required for agent workflows:

```env
OPENAI_API_KEY=...
OPENAI_MATCH_MODEL=gpt-5
AI_ASSIST_MODEL=gpt-4o-mini
```

`OPENAI_MATCH_MODEL` is used by the matching/web/social agents in `backend/lib/agent.js`. The social discovery agents rely on OpenAI web search, so they need a model that supports the Responses API web search tool.

## Caching

Social discovery results are cached in `social_problem_discoveries` for six hours.

The posting workflow also dedupes against existing problem rows, so rerunning the import is safe. Already-imported source URLs are returned as skipped items rather than duplicated posts.

## Important Limits

This is agentic orchestration, not browser automation. X and LinkedIn often restrict direct scraping, so the source scouts use OpenAI web search constrained to those domains instead of logging into accounts or bypassing platform controls.

The system does not copy full posts. It stores a short problem summary, a short evidence snippet, and a link to the original source. That keeps Solvyard useful while still crediting the original poster/source.
