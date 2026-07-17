// Load env first: ESM imports are hoisted, so a plain dotenv.config() call
// would run after imported modules already read process.env.
import "dotenv/config";

import express from "express";
import cors from "cors";

import { UPLOADS_DIR } from "./lib/uploads.js";
import authRoutes from "./routes/auth.js";
import problemRoutes from "./routes/problems.js";
import solutionRoutes from "./routes/solutions.js";
import reviewRoutes from "./routes/reviews.js";
import startupRoutes from "./routes/startups.js";
import notificationRoutes from "./routes/notifications.js";

const app = express();
app.use(cors());
app.use(express.json());

app.get("/api/health", (_req, res) => res.json({ ok: true }));

// Problem photos and videos. Immutable filenames, so cache aggressively.
app.use("/uploads", express.static(UPLOADS_DIR, { maxAge: "30d", immutable: true }));

app.use("/api/auth", authRoutes);
app.use("/api/problems", problemRoutes);
app.use("/api/solutions", solutionRoutes);
app.use("/api/reviews", reviewRoutes);
app.use("/api/startups", startupRoutes);
app.use("/api/notifications", notificationRoutes);

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: "Something went wrong on our end." });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Solvyard API running on http://localhost:${PORT}`));
