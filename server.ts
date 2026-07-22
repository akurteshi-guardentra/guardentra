// NexusGRC Main Server - Deployment Revision 2026-04-29-1952-v3
import "dotenv/config";
import express from "express";
import path from "path";
import cors from "cors";
import type { Server } from "http";

import aiRoutes from "./server/routes/ai.ts";
import stripeRoutes from "./server/routes/stripe.ts";

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
    res.json({ status: "ok", message: "NexusGRC API is online." });
  });

  app.use("/api/ai", aiRoutes);
  app.use("/api/stripe", stripeRoutes);

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
    app.use(express.static(distPath));
    app.get("/", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
    app.get("*all", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
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
      resolve(server);
    });
    server.on("error", reject);
  });
}

// Allow tests to import createApp/startServer without auto-listen
if (process.env.SKIP_LISTEN !== "1") {
  startServer().catch((err) => {
    console.error("[FATAL STARTUP ERROR] server failed to start:", err);
    process.exit(1);
  });
}
