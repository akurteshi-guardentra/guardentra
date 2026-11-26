// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { startProjectedTrustRefresh } from '../lib/vendor/projectedTrustRefresh';
import type { EvidenceTrustMap } from '../lib/vendor/evidenceTrust';
beforeEach(() => vi.useFakeTimers());
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

describe('projected trust refresh lifecycle', () => {
  it('bounds an unresolved scan to 60 non-overlapping requests', async () => {
    const read = vi.fn(async () => ({}));
    const onError = vi.fn();
    startProjectedTrustRefresh(read, vi.fn(), onError);
    await vi.advanceTimersByTimeAsync(700_000);
    expect(read).toHaveBeenCalledTimes(60);
    expect(onError).toHaveBeenCalledOnce();
    expect(onError).toHaveBeenCalledWith(expect.stringContaining('still pending'));
    expect(vi.getTimerCount()).toBe(0);
  });
  it('does not overlap a slow read or publish after disposal', async () => {
    let resolve!: (map: EvidenceTrustMap) => void;
    const read = vi.fn(() => new Promise<EvidenceTrustMap>(r => { resolve = r; }));
    const onMap = vi.fn();
    const onError = vi.fn();
    const stop = startProjectedTrustRefresh(read, onMap, onError);
    await vi.advanceTimersByTimeAsync(90_000);
    expect(read).toHaveBeenCalledOnce();
    stop();
    resolve({ file: 'clean' });
    await Promise.resolve();
    expect(onMap).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });
  it('stops on errors without manufacturing a clean state or retry loop', async () => {
    const read = vi.fn(async () => { throw new Error('synthetic failure'); });
    const onMap = vi.fn();
    const onError = vi.fn();
    startProjectedTrustRefresh(read, onMap, onError);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(read).toHaveBeenCalledOnce();
    expect(onMap).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledOnce();
  });
  it('lets the consumer stop immediately when a verdict resolves the pending state', async () => {
    let stop!: () => void;
    const read = vi.fn(async () => ({ file: 'clean' as const }));
    stop = startProjectedTrustRefresh(read, () => stop(), vi.fn());
    await vi.advanceTimersByTimeAsync(60_000);
    expect(read).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });
});
