/**
 * Child probe. The parent supplies cwd, env, and a mode.
 * loadenv modes import the real env loader before a sentinel route module.
 * vite modes import the real Vite config factory.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const mode = process.argv[2];
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

if (mode === 'loadenv') {
  await import(pathToFileURL(path.join(root, 'server/loadEnv.ts')).href);
  const route = await import(pathToFileURL(path.join(root, 'src/tests/fixtures/localDemoSentinelRoute.mjs')).href);
  process.stdout.write(`\n${JSON.stringify(route.observed)}\n`);
} else if (mode === 'vite') {
  const reads = [];
  const original = fs.readFileSync;
  fs.readFileSync = function patchedRead(file, ...rest) {
    const name = String(file);
    if (name.includes('.env')) reads.push(name);
    return original.call(fs, file, ...rest);
  };
  const { loadConfigFromFile } = await import('vite');
  const viteMode = process.env.PROBE_VITE_MODE || 'development';
  let thrown = null;
  let cfg = null;
  try {
    const loaded = await loadConfigFromFile(
      {
        mode: viteMode,
        command: viteMode === 'production' ? 'build' : 'serve',
      },
      path.join(root, 'vite.config.ts'),
      root,
      'error',
    );
    cfg = loaded?.config ?? null;
  } catch (err) {
    thrown = err instanceof Error ? err.message : String(err);
  }
  process.stdout.write(`${JSON.stringify({
    thrown,
    host: cfg?.server?.host ?? null,
    envDir: cfg && Object.prototype.hasOwnProperty.call(cfg, 'envDir') ? cfg.envDir : null,
    apiKey: cfg?.define?.['process.env.API_KEY'] ?? null,
    gemini: cfg?.define?.['process.env.GEMINI_API_KEY'] ?? null,
    reads,
  })}\n`);
} else {
  process.stderr.write(`unknown mode ${mode}\n`);
  process.exit(2);
}
