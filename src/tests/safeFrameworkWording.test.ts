import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { FRAMEWORK_CATALOG, ONBOARDING_FRAMEWORKS } from '../lib/vendor/constants';
import {
  FRAMEWORK_PACKS,
  currentPackDisplayNames,
} from '../lib/vendor/frameworkPacks';
import {
  PUBLIC_PACK_DOMAIN_LABELS,
  SAFE_CUSTOM_UNAVAILABLE,
  SAFE_EMPTY_RECOVERY_NO_PACKS,
  SAFE_NO_QUESTIONS,
  SAFE_PACK_BASELINE,
  UNSUPPORTED_AUTHORITY_CLAIM_RE,
} from '../lib/vendor/safePackWording';
import { validateAssessmentWizard } from '../lib/vendor/validators';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

function readRepo(relativePath: string): string {
  return readFileSync(resolve(repoRoot, relativePath), 'utf8');
}

function claimIdsFromRegister(markdown: string): string[] {
  const ids: string[] = [];
  for (const match of markdown.matchAll(/^\| (C-\d+[a-z]?) \|/gm)) {
    ids.push(match[1]);
  }
  return ids;
}

describe('Issue #26 safe pack wording', () => {
  it('exports the required baseline sentence', () => {
    expect(SAFE_PACK_BASELINE).toBe(
      'GuardEntra-authored assessment packs aligned to selected security domains.'
    );
  });

  it('keeps onboarding and catalog copy free of unsupported authority claims', () => {
    for (const fw of ONBOARDING_FRAMEWORKS) {
      expect(fw.desc).toBe(SAFE_PACK_BASELINE);
      expect(fw.desc).not.toMatch(UNSUPPORTED_AUTHORITY_CLAIM_RE);
    }
    for (const item of FRAMEWORK_CATALOG) {
      expect(item.description).not.toMatch(UNSUPPORTED_AUTHORITY_CLAIM_RE);
      expect(item.description).not.toMatch(/standard framework/i);
    }
    for (const pack of FRAMEWORK_PACKS) {
      expect(pack.changelog).toMatch(/GuardEntra-authored assessment pack/i);
      expect(pack.changelog).not.toMatch(UNSUPPORTED_AUTHORITY_CLAIM_RE);
      expect(pack.changelog).not.toMatch(/Annex A/i);
      expect(pack.changelog).not.toMatch(/Type II questionnaire/i);
      expect(pack.changelog).not.toMatch(/Security Rule questionnaire/i);
    }
  });

  it('uses shipped pack labels for public domains and Audit Lab fallback', () => {
    const currentNames = currentPackDisplayNames();
    expect(currentNames).toEqual([
      'NIST CSF 2.0',
      'ISO 27001:2022',
      'SOC 2',
      'HIPAA',
      'PCI DSS 4.0',
      'CIS Controls',
    ]);
    expect(PUBLIC_PACK_DOMAIN_LABELS).toEqual(currentNames);
    expect(currentNames).not.toEqual(expect.arrayContaining(['NYDFS Part 500', 'GDPR (Article 32)']));
  });

  it('replaces “standard framework” user-visible errors', () => {
    expect(validateAssessmentWizard({ vendorId: 'v1', frameworks: ['custom'] })).toBe(
      SAFE_CUSTOM_UNAVAILABLE
    );
    expect(SAFE_NO_QUESTIONS).not.toMatch(/standard framework/i);
    expect(SAFE_EMPTY_RECOVERY_NO_PACKS).not.toMatch(/standard framework/i);
  });

  it('removes unsupported public, settings, and Audit Lab authority copy', () => {
    const landing = readRepo('src/pages/Landing.tsx');
    expect(landing).not.toMatch(/NYDFS\s*PART\s*500|NYDFSPART500/i);
    expect(landing).not.toMatch(/NAICCERT/i);
    expect(landing).not.toMatch(/LloydsREADY/i);
    expect(landing).not.toMatch(/800-53/);
    expect(landing).not.toMatch(/Instantly map your entire control environment/);
    expect(landing).not.toMatch(/EPA Civil penalties/i);
    expect(landing).not.toMatch(/Clean Water Act reporting/i);
    expect(landing).not.toMatch(/detect compliance gaps/i);
    expect(landing).toContain('SAFE_PACK_BASELINE');

    expect(readRepo('index.html')).not.toMatch(/Enterprise GRC/i);
    expect(readRepo('src/components/FrameworkPacksCard.tsx')).not.toMatch(/official templates/i);
    expect(readRepo('src/components/FrameworkPacksCard.tsx')).toContain('SAFE_PACK_BASELINE');

    const audit = readRepo('src/pages/AuditReadiness.tsx');
    expect(audit).not.toMatch(/Official Auditor Opinion/);
    expect(audit).not.toMatch(/strict regulatory auditor/);
    expect(audit).toContain('Readiness notes');
    expect(audit).toContain('Estimated coverage');
    expect(audit).toContain('currentPackDisplayNames()');
  });

  it('disposes every P0-F1 claim row from the merged rights register', () => {
    const register = readRepo('docs/compliance/FRAMEWORK_RIGHTS_REGISTER.md');
    const disposition = readRepo('docs/compliance/FRAMEWORK_CLAIM_DISPOSITION.md');
    const ids = claimIdsFromRegister(register);
    expect(ids).toHaveLength(112);
    expect(new Set(ids).size).toBe(112);
    for (const id of ids) {
      expect(disposition, `missing disposition row for ${id}`).toMatch(new RegExp(`\\| ${id} \\|`));
    }
  });
});
