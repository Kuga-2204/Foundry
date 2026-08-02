import db from "../db/index.js";
import { Agent, AgentWorkflow } from "./agentic.js";
import { discoverSocialProblems } from "./agent.js";

const RADAR_EMAIL = "radar@solvyard.local";
const CATEGORIES = [
  "General",
  "Health & Wellness",
  "Productivity",
  "Finance",
  "Sustainability",
  "Education",
  "Home & Living",
  "Transport",
  "Community",
  "Developer Tools",
];

function normalizeText(value) {
  return String(value || "").trim();
}

export function parseSocialImportCommand(command, defaults = {}) {
  const text = normalizeText(command);
  if (!text) throw new Error("Command is required.");

  const lower = text.toLowerCase();
  let categories = CATEGORIES.filter((category) => lower.includes(category.toLowerCase()));
  if (lower.includes("all categories") || lower.includes("every category")) categories = CATEGORIES;
  if (categories.length === 0 && Array.isArray(defaults.categories) && defaults.categories.length) {
    categories = defaults.categories.filter((category) => CATEGORIES.includes(category));
  }
  if (categories.length === 0) categories = CATEGORIES;

  const perCategoryMatch =
    lower.match(/(?:per[-\s]?category|each category)\D*(\d+)/) ||
    lower.match(/(\d+)\s*(?:per[-\s]?category|each category)/);
  const parsedLimit = perCategoryMatch ? Number(perCategoryMatch[1]) : NaN;
  const perCategory =
    Number.isFinite(parsedLimit) && parsedLimit > 0
      ? Math.min(parsedLimit, 5)
      : Number(defaults.perCategory || (categories.length === 1 ? 2 : 1));

  return {
    command: text,
    categories,
    perCategory,
    dryRun: /\b(dry run|preview only|do not post|don't post)\b/.test(lower),
  };
}

function postDescription(item) {
  const lines = [item.description];
  if (item.evidence) lines.push(`\nSignal from ${item.source}: ${item.evidence}`);
  return lines.join("\n").trim();
}

async function ensureRadarUser() {
  const existing = await db.prepare("SELECT id FROM users WHERE email = ?").get(RADAR_EMAIL);
  if (existing?.id) return existing.id;

  const created = await db
    .prepare(
      `INSERT INTO users (name, email, password_hash, bio)
       VALUES (?, ?, ?, ?)
       ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name
       RETURNING id`
    )
    .get(
      "Solvyard Radar",
      RADAR_EMAIL,
      "agentic-social-import",
      "Autonomous Solvyard agent that imports credited public problem signals from social sources."
    );
  return created.id;
}

async function sourceUrlExists(url) {
  const existing = await db.prepare("SELECT id FROM problems WHERE source_url = ?").get(url);
  return !!existing;
}

async function exactProblemExists(item) {
  const existing = await db
    .prepare("SELECT id FROM problems WHERE lower(title) = lower(?) AND category = ?")
    .get(item.title, item.category);
  return !!existing;
}

async function insertProblem(item, userId) {
  const info = await db
    .prepare(
      `INSERT INTO problems (
         user_id, title, description, category, is_anonymous,
         source_name, source_url, source_evidence, source_posted_at, source_imported_at
       ) VALUES (?, ?, ?, ?, 0, ?, ?, ?, ?, now())`
    )
    .run(
      userId,
      item.title,
      postDescription(item),
      item.category,
      item.source,
      item.url,
      item.evidence || "",
      item.posted_at || "Recent"
    );
  return info.lastInsertRowid;
}

const socialPostingWorkflow = new AgentWorkflow({
  name: "social-problem-posting",
  agents: [
    new Agent({
      name: "CommandInterpreterAgent",
      instructions: "Turn an admin/user command into a concrete social import plan.",
      run: async (context) => {
        const plan = context.command
          ? parseSocialImportCommand(context.command, context)
          : parseSocialImportCommand(
              `Import latest ${context.categories?.join(", ") || "all categories"} social problems, ${context.perCategory || 1} per category.`,
              context
            );
        return { ...context, ...plan, commandPlan: plan };
      },
    }),
    new Agent({
      name: "DiscoverProblemsAgent",
      instructions: "Run the social discovery workflow and collect current credited problem signals.",
      run: async (context) => {
        const discovery = await discoverSocialProblems(context.categories, {
          perCategory: context.perCategory,
          sources: context.sources,
        });
        return {
          ...context,
          discovered: discovery?.results || [],
          discoveryTrace: discovery?.trace || null,
        };
      },
    }),
    new Agent({
      name: "DedupeAgent",
      instructions: "Skip social signals already imported by original URL or exact title/category.",
      run: async (context) => {
        const candidates = [];
        const skipped = [];
        for (const item of context.discovered || []) {
          if (await sourceUrlExists(item.url)) {
            skipped.push({ ...item, reason: "source-url-exists" });
            continue;
          }
          if (await exactProblemExists(item)) {
            skipped.push({ ...item, reason: "exact-title-exists" });
            continue;
          }
          candidates.push(item);
        }
        return { ...context, candidates, skipped };
      },
    }),
    new Agent({
      name: "PostingAgent",
      instructions: "Create Solvyard problem posts with original source attribution fields.",
      run: async (context) => {
        if (context.dryRun) {
          return { ...context, imported: [], failed: [], radarUserId: null };
        }
        const userId = await ensureRadarUser();
        const imported = [];
        const failed = [];
        for (const item of context.candidates || []) {
          try {
            const id = await insertProblem(item, userId);
            imported.push({ ...item, id });
          } catch (err) {
            failed.push({ ...item, reason: err.message });
          }
        }
        return { ...context, imported, failed, radarUserId: userId };
      },
    }),
  ],
});

export async function importSocialProblems(categories, { perCategory = 1, sources } = {}) {
  const run = await socialPostingWorkflow.run({ categories, perCategory, sources });
  return {
    imported: run.imported || [],
    skipped: run.skipped || [],
    failed: run.failed || [],
    discovered: run.discovered || [],
    trace: {
      workflow: run.trace.workflow,
      steps: run.trace.steps,
      discovery: run.discoveryTrace,
    },
  };
}

export async function runSocialImportCommand(command, { sources } = {}) {
  const run = await socialPostingWorkflow.run({ command, sources });
  return {
    commandPlan: run.commandPlan,
    imported: run.imported || [],
    skipped: run.skipped || [],
    failed: run.failed || [],
    discovered: run.discovered || [],
    trace: {
      workflow: run.trace.workflow,
      steps: run.trace.steps,
      discovery: run.discoveryTrace,
    },
  };
}
