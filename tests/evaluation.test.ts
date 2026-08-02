import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { Agent, AgentWorkflow } from "../backend/lib/agentic.js";

test("AgentWorkflow runs agents in order and preserves shared context", async () => {
  const workflow = new AgentWorkflow({
    name: "evaluation-workflow",
    agents: [
      new Agent({
        name: "Planner",
        instructions: "Seed the plan.",
        run: async (context) => ({ ...context, steps: ["planned"] }),
      }),
      new Agent({
        name: "Worker",
        instructions: "Use prior context.",
        run: async (context) => ({ ...context, steps: [...context.steps, "worked"] }),
      }),
      new Agent({
        name: "Verifier",
        instructions: "Mark the workflow complete.",
        run: async (context) => ({ ...context, steps: [...context.steps, "verified"], ok: true }),
      }),
    ],
  });

  const result = await workflow.run({ requestId: "eval-1" });

  assert.equal(result.requestId, "eval-1");
  assert.equal(result.ok, true);
  assert.deepEqual(result.steps, ["planned", "worked", "verified"]);
  assert.equal(result.trace.workflow, "evaluation-workflow");
  assert.deepEqual(result.trace.steps.map((step) => step.agent), ["Planner", "Worker", "Verifier"]);
  assert.ok(result.trace.steps.every((step) => Number.isFinite(step.duration_ms)));
});

test("Agent and AgentWorkflow validate required construction inputs", () => {
  assert.throws(() => new Agent({ name: "MissingRun" } as never), /Agent needs a name and run function/);
  assert.throws(() => new AgentWorkflow({ name: "Empty", agents: [] }), /at least one agent/);
});

test("social posting workflow includes discovery, dedupe, and posting agents", async () => {
  const source = await readFile(new URL("../backend/lib/socialPostingAgent.js", import.meta.url), "utf8");

  assert.match(source, /DiscoverProblemsAgent/);
  assert.match(source, /DedupeAgent/);
  assert.match(source, /PostingAgent/);
  assert.match(source, /sourceUrlExists/);
  assert.match(source, /exactProblemExists/);
  assert.match(source, /Solvyard Radar/);
});

test("problem schema and UI preserve original source attribution", async () => {
  const dbSchema = await readFile(new URL("../backend/db/index.js", import.meta.url), "utf8");
  const problemCard = await readFile(new URL("../frontend/src/components/ProblemCard.jsx", import.meta.url), "utf8");
  const problemDetail = await readFile(new URL("../frontend/src/pages/ProblemDetail.jsx", import.meta.url), "utf8");

  for (const column of ["source_name", "source_url", "source_evidence", "source_posted_at", "source_imported_at"]) {
    assert.match(dbSchema, new RegExp(column));
  }
  assert.match(dbSchema, /idx_problems_source_url/);
  assert.match(problemCard, /Originally from/);
  assert.match(problemDetail, /Originally from/);
});
