import type { EvidenceTrustMap } from './evidenceTrust';

/** Bounded, non-overlapping refresh for legacy records denied a raw document read. */
export function startProjectedTrustRefresh(
  read: () => Promise<EvidenceTrustMap>,
  onMap: (map: EvidenceTrustMap) => void,
  onError: (message: string) => void,
): () => void {
  let disposed = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let attempts = 0;
  const refresh = async () => {
    if (disposed) return;
    if (attempts++ >= 60) {
      onError('Scanning is still pending. Refresh this page to check again.');
      return;
    }
    try {
      const map = await read();
      if (disposed) return;
      onMap(map);
      if (!disposed) timer = setTimeout(() => void refresh(), 10_000);
    } catch {
      if (!disposed) onError('Scan status unavailable. Refresh this page to try again.');
    }
  };
  void refresh();
  return () => { disposed = true; if (timer !== undefined) clearTimeout(timer); };
}
