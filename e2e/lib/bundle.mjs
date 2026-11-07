/**
 * Bundle isolation: which Firebase project the shipped client was built for.
 *
 * Vite inlines VITE_* values into the env object in one of three quote styles, and
 * the prod build uses backticks (`VITE_FIREBASE_PROJECT_ID:\`guardentra-prod\``).
 * Values set from Windows can carry a trailing \r\n escape, which is stripped here.
 *
 * Do not fail on a bare "guardentra-staging" or "guardentra-7f582" string: the app
 * source names both on purpose (hosted-project allowlist and the demo constant).
 * Only the inlined VITE_FIREBASE_* values decide the result.
 */
const ENV_VALUE = /["']?(VITE_FIREBASE_[A-Z_]+)["']?\s*:\s*(["'`])((?:\\.|(?!\2)[^\\])*)\2/g;

export function cleanValue(raw) {
  return raw.replace(/(?:\\r|\\n|\r|\n|\s)+$/g, '').trim();
}

/** Returns { NAME: Set(values) } for every VITE_FIREBASE_* found in the text. */
export function extractFirebaseEnv(text, into = {}) {
  for (const m of text.matchAll(ENV_VALUE)) {
    const name = m[1];
    (into[name] ||= new Set()).add(cleanValue(m[3]));
  }
  return into;
}

/** Relative chunk references inside an entry or chunk. */
export function chunkRefs(text) {
  const refs = new Set();
  for (const m of text.matchAll(/(?:\/assets\/|\.\/|assets\/)([A-Za-z0-9_.-]+\.js)\b/g)) {
    refs.add(`/assets/${m[1]}`);
  }
  return refs;
}

/**
 * Pure verdict, unit tested. env is the extractFirebaseEnv() result.
 * PASS needs exactly one PROJECT_ID, the expected one, and no
 * VITE_FIREBASE_* value anywhere naming another GuardEntra project.
 */
export function isolationVerdict(env, projectId, others = ['guardentra-prod', 'guardentra-staging', 'guardentra-7f582']) {
  const problems = [];
  const ids = [...(env.VITE_FIREBASE_PROJECT_ID || [])];
  if (ids.length !== 1 || ids[0] !== projectId) {
    problems.push(`VITE_FIREBASE_PROJECT_ID is [${ids.join(', ')}], expected ${projectId}`);
  }
  for (const [name, values] of Object.entries(env)) {
    if (name === 'VITE_FIREBASE_API_KEY') continue;
    for (const v of values) {
      const leak = others.find((o) => o !== projectId && v.includes(o));
      if (leak) problems.push(`${name} names ${leak}`);
    }
  }
  return { pass: problems.length === 0, problems: [...new Set(problems)] };
}

/** Crawl the live bundle from "/" (GET only) and return the verdict input. */
export async function crawlBundle(request, baseURL, limit = 400) {
  const home = await request.get(`${baseURL}/`);
  const html = await home.text();
  const queue = [...chunkRefs(html)].filter((p) => p.startsWith('/assets/'));
  for (const m of html.matchAll(/src="(\/assets\/[^"]+\.js)"/g)) queue.push(m[1]);
  const seen = new Set();
  const env = {};
  const failed = [];
  while (queue.length && seen.size < limit) {
    const path = queue.shift();
    if (seen.has(path)) continue;
    seen.add(path);
    const res = await request.get(`${baseURL}${path}`);
    if (!res.ok()) { failed.push(`${path} ${res.status()}`); continue; }
    const js = await res.text();
    extractFirebaseEnv(js, env);
    for (const ref of chunkRefs(js)) if (!seen.has(ref)) queue.push(ref);
  }
  return { chunks: seen.size, env, failed };
}
