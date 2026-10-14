/** Hosted and legacy cloud projects must never attach to a local emulator. */
const REFUSED_EMULATOR_PROJECTS = new Set([
  'guardentra-staging',
  'guardentra-prod',
  'guardentra-7f582',
]);

/**
 * Local synthetic emulator mode is opt-in for Vite dev only.
 * Returns false when the flag is off. Throws when the flag would point a
 * hosted or production-like project at localhost.
 */
export function assertLocalEmulatorAllowed(options: {
  dev: boolean;
  flag: string | undefined;
  projectId: string;
}): boolean {
  if (options.flag !== '1') return false;
  if (!options.dev) {
    throw new Error('VITE_USE_LOCAL_EMULATORS is refused outside Vite dev.');
  }
  const projectId = options.projectId.trim();
  if (!projectId || REFUSED_EMULATOR_PROJECTS.has(projectId)) {
    throw new Error(
      `VITE_USE_LOCAL_EMULATORS is refused for Firebase project "${projectId || '(empty)'}".`,
    );
  }
  return true;
}
