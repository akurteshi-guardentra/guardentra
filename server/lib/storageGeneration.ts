/**
 * Cloud Storage generation binding.
 *
 * The authoritative value is the exact decimal string observed from object
 * metadata. Callers must not substitute a request parameter or a JavaScript
 * number: integers above 2^53-1 are not exact as numbers.
 */

const GENERATION_STRING = /^[1-9][0-9]*$/;

export function authoritativeGeneration(value: unknown): string | null {
  if (typeof value === 'string' && GENERATION_STRING.test(value)) return value;
  if (typeof value === 'number' && Number.isSafeInteger(value) && value > 0) {
    return String(value);
  }
  return null;
}

/** Pinned read failed because that generation is gone or the precondition failed. */
export function isPinnedGenerationMiss(err: unknown): boolean {
  const code = (err as { code?: unknown } | null)?.code;
  return code === 404 || code === 412;
}

/**
 * Select one object generation for a later media or signing request.
 *
 * `@google-cloud/storage` 7.21.0 copies `options.generation` through `Number()`,
 * which rounds integers above `Number.MAX_SAFE_INTEGER`. The original string is
 * written back onto the handle before any request is built.
 */
export function fileAtGeneration<T extends { generation?: unknown }>(
  bucket: {
    file: (name: string, options?: { generation?: string | number }) => T;
  },
  storagePath: string,
  generation: string,
): T {
  const file = bucket.file(storagePath, { generation });
  file.generation = generation;
  return file;
}
