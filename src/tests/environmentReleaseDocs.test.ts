import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const environmentDoc = fs.readFileSync(path.join(root, 'docs', 'ENVIRONMENTS.md'), 'utf8');

describe('#126 legacy App Hosting rollout quarantine', () => {
  it('keeps named staging and production projects explicit', () => {
    expect(environmentDoc).toContain('staging: project `guardentra-staging`');
    expect(environmentDoc).toContain('production: project `guardentra-prod`');
    expect(environmentDoc).toContain('Issue #126');
  });

  it('does not publish legacy demo project as an active release command target', () => {
    const forbidden = [
      'firebase apphosting:backends:create --project guardentra-7f582',
      'firebase apphosting:secrets:set VITE_FIREBASE_API_KEY --project guardentra-7f582',
      'firebase deploy --only firestore:rules,storage --project guardentra-7f582',
      'apphosting:rollouts:list --backend guardentra --project guardentra-7f582',
    ];
    for (const command of forbidden) {
      expect(environmentDoc).not.toContain(command);
    }
  });

  it('classifies guardentra-7f582 as demo or legacy rather than release verification', () => {
    expect(environmentDoc).toContain('demo/legacy');
    expect(environmentDoc).toContain('never as staging or production verification');
  });
});
