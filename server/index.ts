import dotenv from "dotenv";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import express, { type Request, type Response, type NextFunction } from "express";
import { attachAuth, requireAuth } from "./middleware/auth.js";
import { apiRouter } from "./routes/api.js";
import { rbacService } from "./services/rbac.service.js";
import { ready, flush } from "./database/index.new.js";
import { logger } from "./utils/logger.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Resolve .env robustly regardless of the cwd the process is launched from
// (npm --prefix / VS Code / manual `tsx server/index.ts` all differ).
// Precedence: explicit DOTENV_PATH > repo-root .env (../../.env from this file)
// > cwd/.env.
function resolveEnvPath(): string | undefined {
  if (process.env.DOTENV_PATH) return process.env.DOTENV_PATH;
  const rootEnv = path.resolve(__dirname, "..", ".env");
  if (fs.existsSync(rootEnv)) return rootEnv;
  return undefined; // fall back to dotenv default (cwd/.env)
}
dotenv.config({ path: resolveEnvPath() });

const app = express();
const PORT = Number(process.env.PORT) || 4000;
const IS_PRODUCTION = process.env.NODE_ENV === "production";

// Database seeding is handled by `npm run db:seed` (see server/seeds/seed.ts).

// Middleware
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With");
  next();
});

app.use(express.json({ limit: "100kb" }));
app.use(express.urlencoded({ extended: true }));
app.use(attachAuth);

// â”€â”€ Request log â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Logs every action that reaches the backend: method, path, status, duration
// and the authenticated user (when a token was supplied). Runs after
// attachAuth so the session is available when the response finishes.
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
app.use((req: Request, res: Response, next: NextFunction) => {
  const startedAt = process.hrtime.bigint();
  const { method, originalUrl } = req;

  res.on("finish", () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
    const session = (req as unknown as { auth?: { session?: { userId: string; username: string } } })
      .auth?.session;
    logger.info("http", `${method} ${originalUrl} -> ${res.statusCode}`, {
      durationMs: durationMs.toFixed(1),
      user: session ? session.username : "anonymous",
      ip: req.ip,
    });
  });

  next();
});

// ── Durability gate ─────────────────────────────────────────────────────────
// Routes mutate the in-memory cache synchronously and queue a Postgres
// write-back. Hold every JSON response until that write-back has committed so
// a 2xx means "persisted" (and a failed persist surfaces as a 500 instead of
// silently diverging from the database).
app.use((req, res, next) => {
  const originalJson = res.json.bind(res);
  res.json = ((body: unknown) => {
    void flush()
      .then(() => {
        if (!res.headersSent) originalJson(body);
      })
      .catch((err: unknown) => {
        logger.error("server", "write-back failed, responding 500", {
          error: err instanceof Error ? err.message : String(err),
          path: req.originalUrl,
        });
        if (!res.headersSent) res.status(500).json({ error: "Failed to persist changes" });
      });
    return res;
  }) as typeof res.json;
  next();
});

// ── Health ────────────────────────────────────────────────────────────────
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// ── API v1 ────────────────────────────────────────────────────────────────
app.use("/api/v1", apiRouter);

// ── Serve static frontend (when built) ─────────────────────────────────────
const distDir = path.resolve(__dirname, "..", "erp-interface-design", "dist");
if (IS_PRODUCTION && fs.existsSync(distDir)) {
  app.use(express.static(distDir));
  app.get("*", (req: Request, res: Response, next) => {
    if (req.path.startsWith("/api") || req.path.startsWith("/health")) return next();
    res.sendFile(path.resolve(distDir, "index.html"));
  });
}

// ── 404 ───────────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: "Not found", path: req.path });
});

// ── Global error handler ───────────────────────────────────────────────────
app.use((err: unknown, req: Request, res: Response) => {
  logger.error("server", "unhandled route error", {
    error: err instanceof Error ? err.message : String(err),
    path: req.originalUrl,
    method: req.method,
  });
  if (res.headersSent) return;
  const status = err && (err as { statusCode?: number }).statusCode ? (err as { statusCode: number }).statusCode : 500;
  res.status(status).json({
    error: err && (err as { message?: string }).message ? (err as { message: string }).message : "Internal server error",
  });
});

void ready
  .catch((err) =>
    logger.error("store", "initial load failed", {
      error: err instanceof Error ? err.message : String(err),
    }),
  )
  .finally(() => {
    app.listen(PORT, () => {
      logger.info("server", `Twin Cakery ERP API running on http://localhost:${PORT}`);
      logger.info("server", `API docs: http://localhost:${PORT}/api/v1`);
    });
  });
