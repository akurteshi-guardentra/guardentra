// Guardentra Main Server - Deployment Revision 2026-04-29-1952-v3
// MUST stay first: route modules read process.env at import time, and ESM evaluates
// imports before any statement below them. See server/loadEnv.ts.
import "./server/loadEnv.ts";
import express from "express";
import path from "path";
import cors from "cors";
import type { Server } from "http";

import aiRoutes from "./server/routes/ai.ts";
import stripeRoutes from "./server/routes/stripe.ts";
import notifyRoutes from "./server/routes/notify.ts";
import portalRoutes from "./server/routes/portal.ts";
import auditRoutes from "./server/routes/audit.ts";
import { requireFirebaseAuth } from "./server/middleware/requireFirebaseAuth.ts";
import { startAuditWorker } from "./server/lib/audit/worker.ts";
import { closeAuditPool } from "./server/lib/audit/pool.ts";
import { startAssessmentReminderWorker } from "./server/lib/reminders/worker.ts";

/** Cloud Run / Firebase App Hosting: always prefer process.env.PORT, fallback 8080. */
export function resolvePort(): number {
  return parseInt(String(process.env.PORT || 8080), 10);
}

export async function createApp() {
  const app = express();
  const appEnv = process.env.APP_ENV || process.env.NODE_ENV || "development";

  console.log(`[BOOT] Creating app...`);
  console.log(`[BOOT] APP_ENV: ${appEnv}`);
  console.log(`[BOOT] NODE_ENV: ${process.env.NODE_ENV}`);
  console.log(`[BOOT] GEMINI_API_KEY set: ${Boolean(process.env.GEMINI_API_KEY)}`);

  app.use(cors());

  // Stripe webhook requires raw body for signature verification
  app.use("/api/stripe/webhook", express.raw({ type: "application/json" }));

  app.use(express.json());

  // API routes FIRST
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", message: "Guardentra API is online." });
  });

  app.use("/api/ai", requireFirebaseAuth, aiRoutes);
  app.use("/api/notify", requireFirebaseAuth, notifyRoutes);
  app.use("/api/audit", requireFirebaseAuth, auditRoutes);
  app.use("/api/stripe", stripeRoutes);
  // Intentionally NOT behind requireFirebaseAuth — this endpoint is what mints the
  // vendor portal's session, so requiring one would be circular. It rate-limits and
  // verifies the assessment is open itself. See server/routes/portal.ts.
  app.use("/api/portal", portalRoutes);

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    // Vite hashed assets under /assets — cache forever; index.html stays no-cache below.
    app.use(
      "/assets",
      express.static(path.join(distPath, "assets"), {
        maxAge: "1y",
        immutable: true,
        setHeaders(res) {
          res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
        },
      })
    );
    app.use(
      express.static(distPath, {
        setHeaders(res, filePath) {
          if (filePath.endsWith("index.html")) {
            res.setHeader("Cache-Control", "no-cache");
          }
        },
      })
    );
    const sendIndex = (_req: express.Request, res: express.Response) => {
      res.setHeader("Cache-Control", "no-cache");
      res.sendFile(path.join(distPath, "index.html"));
    };
    app.get("/", sendIndex);
    app.get("*all", sendIndex);
  }

  return app;
}

export async function startServer(): Promise<Server> {
  const app = await createApp();
  const PORT = resolvePort();

  console.log(`[BOOT] process.env.PORT: ${process.env.PORT}`);
  console.log(`[BOOT] Resolved PORT to listen: ${PORT}`);
  console.log(`[BOOT] Binding host: 0.0.0.0`);

  return await new Promise<Server>((resolve, reject) => {
    const server = app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on http://0.0.0.0:${PORT}`);
      startAuditWorker();
      startAssessmentReminderWorker();
      resolve(server);
    });
    server.on("error", reject);
    const shutdown = () => {
      void closeAuditPool();
    };
    process.once("SIGTERM", shutdown);
    process.once("SIGINT", shutdown);
  });
}

// Allow tests to import createApp/startServer without auto-listen
if (process.env.SKIP_LISTEN !== "1") {
  startServer().catch((err) => {
    console.error("[FATAL STARTUP ERROR] server failed to start:", err);
    process.exit(1);
  });
}
