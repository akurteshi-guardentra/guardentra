// NexusGRC Main Server - Deployment Revision 2026-04-29-1952-v3
import "dotenv/config";
import express from "express";
import path from "path";
import cors from "cors";

import aiRoutes from "./server/routes/ai.ts";
import stripeRoutes from "./server/routes/stripe.ts";

async function startServer() {
  const app = express();
  const appEnv = process.env.APP_ENV || process.env.NODE_ENV || "development";
  
  // Support Cloud Run / production PORT environment variable with fallback to 3000 for dev environment
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

  console.log(`[BOOT] Starting server...`);
  console.log(`[BOOT] APP_ENV: ${appEnv}`);
  console.log(`[BOOT] NODE_ENV: ${process.env.NODE_ENV}`);
  console.log(`[BOOT] process.env.PORT: ${process.env.PORT}`);
  console.log(`[BOOT] Resolved PORT to listen: ${PORT}`);
  console.log(`[BOOT] GEMINI_API_KEY set: ${Boolean(process.env.GEMINI_API_KEY)}`);

  app.use(cors());
  
  // Stripe webhook requires raw body for signature verification
  app.use("/api/stripe/webhook", express.raw({ type: 'application/json' }));
  
  app.use(express.json());

  // API routes FIRST
  app.get("/api/health", (req, res) => {
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
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('/', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("[FATAL STARTUP ERROR] server failed to start:", err);
  process.exit(1);
});
