
import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import db from "./db.js";

import authRouter from "./routes/auth.js";
import scansRouter from "./routes/scans.js";
import quizzesRouter from "./routes/quizzes.js";
import adminRouter from "./routes/admin.js";

const app = express();
const port = Number(process.env.PORT) || 5000;

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  throw new Error(
    "Set a random JWT_SECRET of at least 32 characters in server/.env."
  );
}

app.disable("x-powered-by");
app.use(helmet());

app.use(cors({
  origin: process.env.CLIENT_ORIGIN || "http://localhost:5173"
}));

app.use(express.json({ limit: "10kb" }));

app.use("/api", rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 150,
  standardHeaders: "draft-7",
  legacyHeaders: false
}));

app.use("/api/auth/login", rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false
}));

app.use("/api/auth/register", rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: "draft-7",
  legacyHeaders: false
}));

app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "PhishShield API",
    database: db.open ? "connected" : "disconnected"
  });
});

app.use("/api/auth", authRouter);
app.use("/api/scans", scansRouter);
app.use("/api/quizzes", quizzesRouter);
app.use("/api/admin", adminRouter);

app.use((req, res) => {
  res.status(404).json({ error: "API endpoint not found." });
});

app.use((error, _req, res, _next) => {
  if (error.type === "entity.parse.failed") {
    return res.status(400).json({ error: "Invalid JSON request body." });
  }

  console.error(error);
  res.status(500).json({
    error: "An unexpected server error occurred."
  });
});

app.listen(port, () => {
  console.log(`PhishShield API running at http://localhost:${port}`);
  console.log("SQLite database connected.");
});