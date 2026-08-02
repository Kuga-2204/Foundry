import "dotenv/config";
import { initDb } from "../db/index.js";
import { runSocialImportCommand } from "../lib/socialPostingAgent.js";

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

function argValue(name, fallback = "") {
  const prefix = `--${name}=`;
  const hit = process.argv.find((arg) => arg.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : fallback;
}

function selectedCategories() {
  const requested = argValue("category", "All");
  if (requested === "All") return CATEGORIES;
  const categories = requested.split(",").map((c) => c.trim()).filter((c) => CATEGORIES.includes(c));
  if (categories.length === 0) throw new Error(`Unknown category: ${requested}`);
  return categories;
}

await initDb();

const categories = selectedCategories();
const perCategory = Number(argValue("per-category", categories.length === 1 ? "2" : "1"));
const command =
  argValue("command") ||
  `Import latest ${categories.length === CATEGORIES.length ? "all categories" : categories.join(", ")} social problems, ${perCategory} per category.`;
const result = await runSocialImportCommand(command);

console.log(
  JSON.stringify(
    {
      command,
      commandPlan: result.commandPlan,
      discovered: result.discovered.length,
      imported: result.imported.length,
      skipped: result.skipped.length,
      failed: result.failed.length,
      trace: result.trace,
    },
    null,
    2
  )
);

process.exit(result.failed.length > 0 ? 1 : 0);
