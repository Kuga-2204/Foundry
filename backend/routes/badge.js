import { Router } from "express";
import db from "../db/index.js";

const router = Router();

function esc(s) {
  return String(s).replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[c]));
}

// SVG demand badge for a problem, embeddable anywhere via <img>. A startup
// puts this on its own landing page to show live proof that N people want
// the thing it's building, and every view links back to Solvyard.
router.get("/problem/:id.svg", async (req, res) => {
  const problem = await db.prepare("SELECT id, title FROM problems WHERE id = ?").get(req.params.id);

  res.setHeader("Content-Type", "image/svg+xml");
  // Short cache so counts stay reasonably fresh without hammering the DB.
  res.setHeader("Cache-Control", "public, max-age=300");

  if (!problem) {
    return res.send(
      `<svg xmlns="http://www.w3.org/2000/svg" width="220" height="52"></svg>`
    );
  }

  const votes = (await db
    .prepare("SELECT COUNT(*) AS score FROM votes WHERE problem_id = ? AND vote_type = 1")
    .get(problem.id)).score;
  const followers = (await db
    .prepare("SELECT COUNT(*) AS c FROM problem_followers WHERE problem_id = ?")
    .get(problem.id)).c;
  const want = votes + followers;

  const label = want === 1 ? "person wants this" : "people want this";

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="54" role="img" aria-label="${want} ${label} on Solvyard">
  <rect width="240" height="54" rx="6" fill="#0f1626"/>
  <rect x="1" y="1" width="238" height="52" rx="5" fill="none" stroke="#ffb020" stroke-width="1.5"/>
  <circle cx="30" cy="27" r="13" fill="none" stroke="#3ddc97" stroke-width="2"/>
  <text x="30" y="32" text-anchor="middle" font-family="IBM Plex Mono, monospace" font-size="14" font-weight="700" fill="#3ddc97">${want}</text>
  <text x="54" y="23" font-family="Inter, Arial, sans-serif" font-size="12.5" font-weight="600" fill="#f4f5ef">${esc(label)}</text>
  <text x="54" y="40" font-family="IBM Plex Mono, monospace" font-size="10" fill="#ffb020">on solvyard</text>
</svg>`;

  res.send(svg);
});

export default router;
