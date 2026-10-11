import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const state = readFileSync(resolve(process.cwd(), 'docs/agent-ops/PROJECT_STATE.md'), 'utf8');

describe('#140 stale PROJECT_STATE dispatch quarantine', () => {
  it('marks the ledger historical and requires live authority reread', () => {
    expect(state).toContain('STALE DISPATCH QUARANTINE — Issue #140');
    expect(state).toContain('historical snapshot');
    expect(state).toContain('read protected `main` from the live GitHub branch API');
    expect(state).toContain('#116');
    expect(state).toContain('P0 #126');
    expect(state).toContain('do not reuse that SHA without rereading GitHub');
  });

  it('does not present the September repository tip or closed #53 as current dispatch truth', () => {
    expect(state).not.toContain('| Default branch/current commit |');
    expect(state).not.toContain('(merge of PR #52; repository tip)');
    expect(state).toContain('| Historical snapshot branch/commit |');
    expect(state).toContain('Issue #53 / Action #9A was later **CLOSED / completed**');
    expect(state).toContain('Historical next actions at snapshot time — DO NOT DISPATCH');
  });

  it('preserves lifecycle separation', () => {
    expect(state).toContain('MERGED != STAGING_LIVE_VERIFIED != PRODUCTION_LIVE_VERIFIED');
  });
});
