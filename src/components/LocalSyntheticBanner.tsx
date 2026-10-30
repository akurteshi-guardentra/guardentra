/**
 * Visible label for the October 18 local rehearsal. Rendered only when the
 * opt-in emulator flag is on. This is not a staging or production banner.
 */
export function LocalSyntheticBanner() {
  if (import.meta.env.VITE_USE_LOCAL_EMULATORS !== '1') return null;
  return (
    <div
      data-testid="local-synthetic-banner"
      className="bg-amber-400 px-4 py-2 text-center text-sm font-semibold text-slate-950"
      role="status"
    >
      LOCAL SYNTHETIC DEMONSTRATION — emulator fixtures only. Not live staging, not email delivery, not an audit or scanner result.
    </div>
  );
}
