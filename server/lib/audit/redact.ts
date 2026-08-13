const SENSITIVE_KEY =
  /password|token|secret|authorization|apikey|api_key|private_key|credential|cookie|session/i;

/** Deep-clone payload with secrets stripped and oversized strings truncated. */
export function redactAuditPayload(input: unknown, depth = 0): unknown {
  if (depth > 8) return '[truncated]';
  if (input == null) return input;
  if (typeof input === 'string') {
    if (input.length > 500) return `${input.slice(0, 500)}…`;
    return input;
  }
  if (typeof input !== 'object') return input;
  if (Array.isArray(input)) {
    return input.slice(0, 50).map((v) => redactAuditPayload(v, depth + 1));
  }
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
    if (SENSITIVE_KEY.test(k)) {
      out[k] = '[redacted]';
      continue;
    }
    if (k === 'html' || k === 'fileBytes' || k === 'base64' || k === 'content') {
      out[k] = '[omitted]';
      continue;
    }
    out[k] = redactAuditPayload(v, depth + 1);
  }
  return out;
}
