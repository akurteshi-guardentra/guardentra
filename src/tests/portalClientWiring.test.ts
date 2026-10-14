import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();

describe('portal client identity', () => {
  it('reads and writes assessments on the portal Firestore app', () => {
    const portal = readFileSync(path.join(root, 'src/pages/VendorPortal.tsx'), 'utf8');
    expect(portal).toContain('getPortalDb()');
    expect(portal).not.toContain("from '../firebase'");
    expect(portal).toContain('classifyPortalSessionFailure');
  });

  it('uploads portal evidence with the portal Storage app', () => {
    const upload = readFileSync(path.join(root, 'src/lib/vendor/evidenceUpload.ts'), 'utf8');
    expect(upload).toContain('ref(getPortalStorage(), path)');
    expect(upload).toContain('ref(storage, path)');
  });

  it('connects the separate portal app to the local emulators before use', () => {
    const auth = readFileSync(path.join(root, 'src/lib/vendor/portalAuth.ts'), 'utf8');
    expect(auth).toContain('connectAuthEmulator');
    expect(auth).toContain('connectFirestoreEmulator');
    expect(auth).toContain('connectStorageEmulator');
    expect(auth).toContain("PORTAL_APP_NAME = 'guardentra-portal'");
    expect(auth).toContain('assertLocalEmulatorAllowed');
  });
});
