// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { aiErrorResponse, shouldTryNextGeminiModel } from '../../server/routes/ai';
import {
  GEMINI_TIMEOUT_MS,
  geminiCallConfig,
  geminiGenerateRequest,
  isGeminiTimeoutError,
} from '../../server/lib/geminiDeadline';

describe('Gemini request deadline', () => {
  it('sets a 30 second HTTP timeout and abort signal on every call', () => {
    const request = geminiGenerateRequest({
      model: 'gemini-3.5-flash',
      contents: 'hello',
      config: { responseMimeType: 'application/json', responseSchema: { type: 'OBJECT' } },
    });
    expect(request.model).toBe('gemini-3.5-flash');
    expect(request.contents).toBe('hello');
    expect(request.config?.responseMimeType).toBe('application/json');
    expect(request.config?.responseSchema).toEqual({ type: 'OBJECT' });
    expect(request.config?.httpOptions?.timeout).toBe(GEMINI_TIMEOUT_MS);
    expect(GEMINI_TIMEOUT_MS).toBe(30_000);
    expect(request.config?.abortSignal).toBeInstanceOf(AbortSignal);
    expect(request.config?.abortSignal?.aborted).toBe(false);
  });

  it('aborts the signal once the deadline passes', async () => {
    const signal = geminiCallConfig(undefined, 20).abortSignal;
    expect(signal?.aborted).toBe(false);
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(signal?.aborted).toBe(true);
  });

  it('recognizes a timeout wrapped as the cause of a fetch error', () => {
    const cause = new Error('The operation was aborted due to timeout');
    cause.name = 'TimeoutError';
    const wrapped = new Error('exception posting request');
    (wrapped as Error & { cause?: unknown }).cause = cause;
    expect(isGeminiTimeoutError(wrapped)).toBe(true);
    expect(isGeminiTimeoutError({ status: 404, message: 'models/gemini-3.5-flash is not found' })).toBe(false);
  });

  it('stops the model fallback chain on timeout and maps it to 504', () => {
    const timeout = Object.assign(new Error('The operation was aborted due to timeout'), {
      name: 'TimeoutError',
    });
    expect(shouldTryNextGeminiModel(timeout)).toBe(false);
    expect(aiErrorResponse(timeout)).toEqual({
      status: 504,
      error: 'AI request timed out. Please retry.',
    });
  });

  it('still tries the next model when the requested model is unavailable', () => {
    expect(shouldTryNextGeminiModel({ status: 404, message: 'not found' })).toBe(true);
    expect(shouldTryNextGeminiModel({ status: 500, message: 'backend error' })).toBe(false);
    expect(aiErrorResponse({ status: 429 })).toMatchObject({ status: 429 });
    expect(aiErrorResponse({ status: 500, message: 'backend error' })).toEqual({
      status: 502,
      error: 'AI generation failed',
    });
  });
});
