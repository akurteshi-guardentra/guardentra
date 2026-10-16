/** Only this non-live project may attach to the local emulators. */
export const LOCAL_EMULATOR_PROJECT_ID = 'demo-guardentra-local';

export const LOCAL_EMULATOR_ENDPOINTS = {
  authUrl: 'http://127.0.0.1:9099',
  firestoreHost: '127.0.0.1',
  firestorePort: 8080,
  storageHost: '127.0.0.1',
  storagePort: 9199,
} as const;

/**
 * Local synthetic emulator mode is opt-in for Vite dev only.
 * Returns false when the flag is off. Throws for every project other than
 * `demo-guardentra-local`, including empty and hosted ids.
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
  if (projectId !== LOCAL_EMULATOR_PROJECT_ID) {
    throw new Error(
      `VITE_USE_LOCAL_EMULATORS is refused for Firebase project "${projectId || '(empty)'}".`,
    );
  }
  return true;
}
