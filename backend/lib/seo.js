import db from "../db/index.js";

const APP_URL = process.env.APP_URL || "http://localhost:5173";

function esc(s) {
  return String(s || "").replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[c]));
}

function truncate(s, n = 160) {
  const t = String(s || "").replace(/\s+/g, " ").trim();
  return t.length > n ? t.slice(0, n - 1) + "…" : t;
}

// Build the <meta> block for one page. Anonymous problems still get a preview,
// but the author is never named (matches masking everywhere else).
export async function metaForPath(pathname) {
  const site = "Solvyard";
  const defaultDesc = "Describe a problem from your daily life and Solvyard matches you with startups already solving it.";
  const image = `${APP_URL}/solvyard-og.png`;

  let title = `${site}: your problem, matched to the startup solving it`;
  let desc = defaultDesc;
  let url = `${APP_URL}${pathname}`;

  const problemMatch = pathname.match(/^\/problems\/(\d+)$/);
  if (problemMatch) {
    const p = await db
      .prepare("SELECT title, description FROM problems WHERE id = ?")
      .get(problemMatch[1]);
    if (p) {
      title = `${p.title} — ${site}`;
      desc = truncate(p.description);
    }
  }

  const startupMatch = pathname.match(/^\/startups\/(\d+)$/);
  if (startupMatch) {
    const s = await db
      .prepare("SELECT name, tagline, description FROM startups WHERE id = ?")
      .get(startupMatch[1]);
    if (s) {
      title = `${s.name} — ${site}`;
      desc = truncate(s.tagline || s.description);
    }
  }

  return `    <title>${esc(title)}</title>
    <meta name="description" content="${esc(desc)}" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="${site}" />
    <meta property="og:title" content="${esc(title)}" />
    <meta property="og:description" content="${esc(desc)}" />
    <meta property="og:url" content="${esc(url)}" />
    <meta property="og:image" content="${esc(image)}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${esc(title)}" />
    <meta name="twitter:description" content="${esc(desc)}" />
    <meta name="twitter:image" content="${esc(image)}" />`;
}

// Swap the default marker block in the built index.html for per-page tags.
// Falls back to the original html if the markers are missing.
export async function injectMeta(html, pathname) {
  const meta = await metaForPath(pathname);
  return html.replace(
    /<!--SSR_META_START-->[\s\S]*?<!--SSR_META_END-->/,
    `<!--SSR_META_START-->\n${meta}\n    <!--SSR_META_END-->`
  );
}

export async function buildSitemap() {
  const rows = await db
    .prepare("SELECT id, created_at FROM problems ORDER BY created_at DESC LIMIT 5000")
    .all();
  const startups = await db.prepare("SELECT id FROM startups ORDER BY id DESC LIMIT 5000").all();

  const urls = [
    { loc: `${APP_URL}/`, priority: "1.0" },
    { loc: `${APP_URL}/problems`, priority: "0.9" },
    { loc: `${APP_URL}/startups`, priority: "0.7" },
    ...rows.map((p) => ({ loc: `${APP_URL}/problems/${p.id}`, priority: "0.8", lastmod: p.created_at })),
    ...startups.map((s) => ({ loc: `${APP_URL}/startups/${s.id}`, priority: "0.6" })),
  ];

  const body = urls
    .map(
      (u) =>
        `  <url><loc>${esc(u.loc)}</loc>${u.lastmod ? `<lastmod>${esc(u.lastmod.slice(0, 10))}</lastmod>` : ""}<priority>${u.priority}</priority></url>`
    )
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
}

export function buildRobots() {
  return `User-agent: *\nAllow: /\n\nSitemap: ${APP_URL}/sitemap.xml\n`;
}
