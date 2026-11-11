import dotenv from "dotenv";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import express, { type Request, type Response, type NextFunction } from "express";
import { attachAuth, requireAuth } from "./middleware/auth.js";
import { apiRouter } from "./routes/api.js";
import { RbacService } from "./services/rbac.service.js";
import { businessService } from "./services/business.service.js";
const rbacService = new RbacService(); // singleton used by index.ts itself; route modules declare their own
import { ready, flush, dirtyKeysSnapshot, clearDirtyResource, resourceDirty, markResourceDirty } from "./database/index.new.js";
import { logger } from "./utils/logger.js";
import { addSseClient, removeSseClient, broadcastChange, resourcesFor, type ResourceKey } from "./services/live-events.js";
import { AuthService } from "./services/auth.service.js";
import { RESOURCE_KEYS as DBResKeys } from "./database/index.new.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from server/.env only (or real environment variables).
// DOTENV_PATH may still be used to point at an explicit file (e.g. local overrides).
if (process.env.DOTENV_PATH) {
  dotenv.config({ path: process.env.DOTENV_PATH });
} else {
  // Works from source (server/) and compiled output (server/dist/).
  for (const candidate of [
    path.resolve(__dirname, ".env"),
    path.resolve(__dirname, "..", ".env"),
    path.resolve(process.cwd(), ".env"),
  ]) {
    if (!fs.existsSync(candidate)) continue;
    const loaded = dotenv.config({ path: candidate, override: false });
    if (!process.env.DATABASE_URL?.trim() && loaded.parsed?.DATABASE_URL?.trim()) {
      process.env.DATABASE_URL = loaded.parsed.DATABASE_URL.trim();
    }
    if (process.env.DATABASE_URL?.trim()) break;
  }
}

const app = express();
const PORT = Number(process.env.PORT) || 4000;

// Database seeding is handled by `npm run db:seed` (see server/seeds/seed.ts).

// CORS allow-list (replaces wildcard)
const ALLOWED = (process.env.FRONTEND_ORIGIN ?? "")
  .split(",")
  .map((o) => o.trim().replace(/\/$/, ""))
  .filter(Boolean);
app.use((req, res, next) => {
  const origin = req.headers.origin as string | undefined;
  if (origin) {
    const normalizedOrigin = origin.replace(/\/$/, "");
    if (ALLOWED.includes(normalizedOrigin)) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Vary", "Origin");
      res.setHeader("Access-Control-Allow-Credentials", "true");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With, X-CSRF-Token, Idempotency-Key");
      res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
    }
  }
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});
// Public, read-only catalogue/blog endpoints may keep wildcard on /public/* only.

app.set("trust proxy", Number(process.env.TRUST_PROXY ?? 0));
// helmet was removed: package is unavailable in this environment. Equivalent
// CSP headers are injected manually so the frontend can still load images from
// data:/https: endpoints.
app.use((req, res, next) => {
  if (process.env.NODE_ENV !== "test") {
    res.setHeader("Content-Security-Policy", "default-src 'self'; img-src 'self' data: https:; connect-src 'self'");
  }
  next();
});

app.use(express.json({ limit: "100kb" }));
app.use(express.urlencoded({ extended: true }));
app.use(attachAuth);

// â”€â”€ Request log â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// ONE log line per HTTP request â€” exactly five fields, nothing more:
// source (`http`), endpoint (TypeScript route path, NOT the SQL query),
// method (GET/POST/PUT/PATCH/DELETE), response time, response code.
// Spec: IMPLEMENTATION_PLAN Â§7.1. Runs after attachAuth so the session is
// available when the response finishes.
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
app.use((req: Request, res: Response, next: NextFunction) => {
  const startedAt = process.hrtime.bigint();
  const { method, originalUrl } = req;

  res.on("finish", () => {
    const duration = `${(Number(process.hrtime.bigint() - startedAt) / 1e6).toFixed(1)}ms`;
    // Emit exactly five fields, nothing more: source (http), endpoint,
    // method (GET/POST), response time, response code.
    logger.request({ source: "http", endpoint: originalUrl, method, time: duration, status: res.statusCode });
  });

  next();
});

// â”€â”€ Durability gate â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Routes mutate the in-memory cache synchronously and queue a Postgres
// write-back. Hold every JSON response until that write-back has committed so
// a 2xx means "persisted" (and a failed persist surfaces as a 500 instead of
// silently diverging from the database).


// â”€â”€ Durability gate + live publish â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Routes mutate the in-memory cache synchronously and queue a Postgres
// write-back (server/services/live-events.ts). Hold every JSON response until
// that write-back has committed so a 2xx means "persisted", then publish a
// change event so every connected client re-reads the affected views â€” this
// is what makes state changes self-updating across sessions and tabs.
app.use((req, res, next) => {
  const originalJson = res.json.bind(res);
  res.json = ((body: unknown) => {
    // Flush the write-back, then publish a resource-level change event based on
    // what this request actually dirtied in the in-memory cache. Indices that
    // regenerate on read (e.g. physicalStock) are represented by their source
    // table key, not by a transient computed key.
    void flush()
      .then(() => {
        if (res.statusCode < 300 && req.method !== "GET") {
          const routeKeys = (req as any).__liveResources as ResourceKey[] | undefined;
          const merged = routeKeys ? new Set<string>([...dirtyKeysSnapshot(), ...routeKeys]) : Array.from(dirtyKeysSnapshot()) as string[];
          // DBResKeys is a const object keyed by resource names; index it as any for the lookup below.
          for (const k of merged) {
            try {
              // Prefer the canonical DB resource constant mapping, falling back
              // to the raw dirty key string when no explicit mapping exists.
              const mapped = (DBResKeys as Record<string, ResourceKey>)[k] ? [(DBResKeys as Record<string, ResourceKey>)[k]!] : [k];
              for (const m of mapped) broadcastChange(req.method, req.url, m);
            } catch {}
          }
          for (const k of merged) clearDirtyResource(k);
        }
        if (!res.headersSent) originalJson(body);
      })
      .catch((err: unknown) => {
        console.error("WRITE-BACK ERROR 2:", err);
        logger.failure("server", "write-back failed, responding 500");
        if (!res.headersSent) res.status(500).json({ error: "Failed to persist changes" });
      });
    return res;
  }) as typeof res.json;
  next();
});






// â”€â”€ Health â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// â”€â”€ Live events (SSE) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// One stream per session; subscribes to every domain event and re-broadcasts
// as SSE. Mounted before the durability gate so it is never delayed.
app.get("/api/v1/events", (req: Request, res: Response) => {
  // Subscribe this client to change events
  addSseClient(res);

  // Set SSE headers
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  // Send an initial heartbeat so the client knows the connection is alive
  res.write(": connected\n\n");

  // Keep the connection alive with periodic heartbeats
  const heartbeat = setInterval(() => {
    if (!res.headersSent) {
      res.write(": hb\n\n");
    } else {
      clearInterval(heartbeat);
      removeSseClient(res);
    }
  }, 3000);

  // Clean up on client disconnect
  req.on("close", () => {
    clearInterval(heartbeat);
    removeSseClient(res);
  });
});

// â”€â”€ API v1 â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// One stream per session; subscribes to every domain event and re-broadcasts
// as SSE. Mounted before the durability gate so it is never delayed.


// â”€â”€ API v1 â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
app.use("/api/v1", apiRouter);

// â”€â”€ Serve static frontend (when built) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// ── Serve static frontend (optional) ─────────────────────────────
// Serve a built frontend only when STATIC_DIR is set and the folder exists.
// Default is API only. Keep SPA fallback and /api,/health exclusions.
const staticDir = process.env.STATIC_DIR;
if (staticDir && fs.existsSync(staticDir)) {
  const resolvedStaticDir = path.resolve(staticDir);
  app.use(express.static(resolvedStaticDir));
  // SPA fallback (version-proof): Express 5 rejects app.get("*") with a
  // PathError at boot, so use a plain middleware instead of a wildcard route.
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.method !== "GET") return next();
    if (req.path.startsWith("/api") || req.path.startsWith("/health")) return next();
    res.sendFile(path.resolve(resolvedStaticDir, "index.html"));
  });
}

// â”€â”€ 404 â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
app.use((req, res) => {
  res.status(404).json({ error: "Not found", path: req.path });
});

// â”€â”€ Global error handler â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
/* Express 5 only treats 4-arg middleware as an error handler. The previous
   3-arg version was silently ignored, so thrown route errors (e.g.
   NotFoundError) became uncaught exceptions and killed the tsx process
   (dev:api has no auto-restart). The 4th param MUST stay. */
app.use((err: unknown, req: Request, res: Response, _next: NextFunction) => {
  logger.failure("server", `unhandled route error on ${req.originalUrl} (${req.method})`);
  if (res.headersSent) return;
  const status = err && (err as { statusCode?: number }).statusCode ? (err as { statusCode: number }).statusCode : 500;
  res.status(status).json({
    error: err && (err as { message?: string }).message ? (err as { message: string }).message : "Internal server error",
  });
});

void ready
  .catch((err) =>
    logger.failure("store", "initial load failed"),
  )
  .finally(() => {
    // â”€â”€ Crash guards â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    // tsx does NOT auto-restart: any uncaught exception / unhandled rejection
    // kills the API silently. Log loudly instead of vanishing.
    process.on("uncaughtException", (err: unknown) => {
      const e = err as Error;
      logger.failure("server", `uncaughtException - ${String(e?.message ?? err)}`);
    });
    process.on("unhandledRejection", (reason: unknown) => {
      const e = reason as Error;
      logger.failure("server", `unhandledRejection - ${String(e?.message ?? reason)}`);
    });
    // â”€â”€ Backfill: pipeline orders must own a Production Job â”€â”€â”€â”€â”€â”€â”€â”€
    // Orders stranded before job auto-creation existed (status reading
    // Confirmed / In production with no job) would leave the Jobs board
    // empty. Idempotent, runs on every boot.
    try {
      const backfilled = businessService.reconcileProductionJobs("system");
      if (backfilled > 0) logger.boot(`backfilled ${backfilled} production job(s) for pipeline orders`);
    } catch (err) {
      logger.failure("server", `production job reconcile failed: ${String((err as Error)?.message ?? err)}`);
    }
    const server = app.listen(PORT, () => {
      logger.boot(`Twin Cakery ERP API running on http://localhost:${PORT}`);
      logger.boot(`API docs: http://localhost:${PORT}/api/v1`);
    });
    // A second `dev:api` / stale node on the same port throws EADDRINUSE and â€”
    // without this â€” the process dies instantly. Name the culprit instead.
    server.on("error", (err: NodeJS.ErrnoException) => {
      if (err.code === "EADDRINUSE") {
        logger.failure("server", `port ${PORT} in use - another API instance is running; refusing to start`);
        process.exit(1);
      }
      logger.failure("server", "listen failed - exiting");
      process.exit(1);
    });
  });
