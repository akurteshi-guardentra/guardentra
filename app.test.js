/**
 * Server smoke test for Cloud Run / Firebase App Hosting port contract.
 * Mocks process.env.PORT = 8080, launches our server, GETs /api/health.
 */
import { spawn } from "node:child_process";
import http from "node:http";
import { setTimeout as delay } from "node:timers/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = 8080;

function getJson(port, urlPath) {
  return new Promise((resolve, reject) => {
    const req = http.get({ host: "127.0.0.1", port, path: urlPath, timeout: 3000 }, (res) => {
      let body = "";
      res.on("data", (chunk) => {
        body += chunk;
      });
      res.on("end", () => {
        try {
          resolve({ statusCode: res.statusCode, body: JSON.parse(body || "{}") });
        } catch (err) {
          reject(err);
        }
      });
    });
    req.on("error", reject);
    req.on("timeout", () => {
      req.destroy(new Error("request timeout"));
    });
  });
}

async function waitForHealth(timeoutMs = 25000) {
  const start = Date.now();
  let lastErr;
  while (Date.now() - start < timeoutMs) {
    try {
      const result = await getJson(PORT, "/api/health");
      if (result.statusCode === 200) return result;
    } catch (err) {
      lastErr = err;
    }
    await delay(300);
  }
  throw lastErr || new Error("Server did not become healthy on port 8080");
}

describe("Guardentra HTTP server", () => {
  let child;

  afterEach(async () => {
    if (child && child.exitCode === null) {
      child.kill("SIGTERM");
      await delay(400);
      if (child.exitCode === null) child.kill("SIGKILL");
    }
    child = undefined;
  });

  test("mocks PORT=8080, launches server, and serves /api/health", async () => {
    process.env.PORT = "8080";

    child = spawn(
      process.execPath,
      ["--import", "tsx", path.join(__dirname, "server.ts")],
      {
        cwd: __dirname,
        env: {
          ...process.env,
          PORT: "8080",
          NODE_ENV: "production",
        },
        stdio: ["ignore", "pipe", "pipe"],
      }
    );

    let stderr = "";
    let stdout = "";
    child.stderr.on("data", (d) => {
      stderr += d.toString();
    });
    child.stdout.on("data", (d) => {
      stdout += d.toString();
    });

    const bootError = new Promise((_, reject) => {
      child.on("exit", (code) => {
        if (code && code !== 0) {
          reject(new Error(`Server exited early (${code}): ${stderr || stdout}`));
        }
      });
      child.on("error", reject);
    });

    const health = await Promise.race([waitForHealth(), bootError]);

    expect(process.env.PORT).toBe("8080");
    expect(health.statusCode).toBe(200);
    expect(health.body.status).toBe("ok");
  }, 60000);
});
