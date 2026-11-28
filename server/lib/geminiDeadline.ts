import type { GenerateContentConfig, GenerateContentParameters } from '@google/genai';

/**
 * Bound every Gemini request so a stalled upstream call cannot hold a worker open.
 * The same deadline is applied as an HTTP client timeout and as an abort signal.
 */
export const GEMINI_TIMEOUT_MS = 30_000;

export function geminiCallConfig(
  config?: GenerateContentConfig,
  timeoutMs: number = GEMINI_TIMEOUT_MS,
): GenerateContentConfig {
  return {
    ...config,
    httpOptions: { ...config?.httpOptions, timeout: timeoutMs },
    abortSignal: AbortSignal.timeout(timeoutMs),
  };
}

export function geminiGenerateRequest(params: {
  model: string;
  contents: GenerateContentParameters['contents'];
  config?: GenerateContentConfig;
}): GenerateContentParameters {
  return {
    model: params.model,
    contents: params.contents,
    config: geminiCallConfig(params.config),
  };
}

function timeoutText(value: unknown): boolean {
  const text = String(value || '').toLowerCase();
  return text.includes('timeout') || text.includes('timed out');
}

/** Walk the SDK error and its cause. A deadline must not be treated as a model miss. */
export function isGeminiTimeoutError(err: unknown): boolean {
  const seen = new Set<unknown>();
  const walk = (value: unknown): boolean => {
    if (value == null || seen.has(value)) return false;
    if (typeof value !== 'object') return timeoutText(value);
    seen.add(value);
    const record = value as { name?: unknown; code?: unknown; message?: unknown; cause?: unknown };
    const name = String(record.name || '');
    if (name === 'TimeoutError' || name === 'AbortError') return true;
    const code = String(record.code ?? '');
    if (
      code === 'ABORT_ERR' ||
      code === '23' ||
      code === 'ETIMEDOUT' ||
      code === 'UND_ERR_CONNECT_TIMEOUT' ||
      code === 'UND_ERR_HEADERS_TIMEOUT' ||
      code === 'UND_ERR_BODY_TIMEOUT'
    ) {
      return true;
    }
    if (timeoutText(record.message)) return true;
    return walk(record.cause);
  };
  return walk(err);
}
