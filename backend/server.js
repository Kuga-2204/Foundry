// Load env first: ESM imports are hoisted, so a plain dotenv.config() call
// would run after imported modules already read process.env.
import "dotenv/config";
import "express-async-errors";

import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import { initDb } from "./db/index.js";
import authRoutes from "./routes/auth.js";
import problemRoutes from "./routes/problems.js";
import solutionRoutes from "./routes/solutions.js";
import reviewRoutes from "./routes/reviews.js";
import startupRoutes from "./routes/startups.js";
import notificationRoutes from "./routes/notifications.js";
import reportRoutes from "./routes/reports.js";
import userRoutes from "./routes/users.js";
import digestRoutes from "./routes/digest.js";
import badgeRoutes from "./routes/badge.js";
import { buildSitemap, buildRobots, injectMeta } from "./lib/seo.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

await initDb();

const app = express();
app.use(cors());
app.use(express.json());

app.get("/api/health", (_req, res) => res.json({ ok: true }));

app.use("/api/auth", authRoutes);
app.use("/api/problems", problemRoutes);
app.use("/api/solutions", solutionRoutes);
app.use("/api/reviews", reviewRoutes);
app.use("/api/startups", startupRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/users", userRoutes);
app.use("/api/digest", digestRoutes);
app.use("/badge", badgeRoutes);

// SEO endpoints. Served from the API so they always reflect live data.
app.get("/sitemap.xml", async (_req, res, next) => {
  try {
  res.setHeader("Content-Type", "application/xml");
  res.send(await buildSitemap());
  } catch (err) {
    next(err);
  }
});
app.get("/robots.txt", (_req, res) => {
  res.setHeader("Content-Type", "text/plain");
  res.send(buildRobots());
});

// Production only: serve the built SPA and inject per-page Open Graph tags so
// shared problem/startup links get their own preview card. Skipped in dev,
// where Vite serves the frontend on its own port. Build the frontend
// (npm run build) and this activates automatically.
const DIST = path.join(__dirname, "..", "frontend", "dist");
if (fs.existsSync(path.join(DIST, "index.html"))) {
  const template = fs.readFileSync(path.join(DIST, "index.html"), "utf-8");
  app.use(express.static(DIST, { index: false }));
  app.get("*", async (req, res, next) => {
    if (req.path.startsWith("/api") || req.path.startsWith("/uploads") || req.path.startsWith("/badge")) {
      return next();
    }
    try {
      res.setHeader("Content-Type", "text/html");
      res.send(await injectMeta(template, req.path));
    } catch (err) {
      next(err);
    }
  });
}

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: "Something went wrong on our end." });
});

export default app;

if (!process.env.VERCEL) {
  const PORT = process.env.PORT || 4000;
  app.listen(PORT, () => console.log(`Solvyard API running on http://localhost:${PORT}`));
}
