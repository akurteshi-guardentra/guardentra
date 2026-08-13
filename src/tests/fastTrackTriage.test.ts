import { describe, expect, it } from 'vitest';
import {
  frameworksForTriage,
  frameworksToParam,
  isTriageComplete,
  parseFrameworksParam,
  recommendFromTriage,
  scoreTriage,
  tierFromScore,
  type TriageAnswers,
} from '../lib/vendor/fastTrackTriage';

const liteAnswers: TriageAnswers = {
  dataExposure: ['public'],
  accessLevel: 'none',
  businessCriticality: 'low',
  requirements: ['none'],
  reviewCadence: 'annual',
};

const standardAnswers: TriageAnswers = {
  dataExposure: ['internal', 'personal'],
  accessLevel: 'user',
  businessCriticality: 'medium',
  requirements: ['soc2_customers'],
  reviewCadence: 'semi_annual',
};

const enhancedAnswers: TriageAnswers = {
  dataExposure: ['personal', 'health', 'credentials'],
  accessLevel: 'production',
  businessCriticality: 'critical',
  requirements: ['hipaa', 'iso_buyers'],
  reviewCadence: 'continuous',
};

describe('fastTrackTriage', () => {
  it('requires all five answers before recommending', () => {
    expect(isTriageComplete({ ...liteAnswers, accessLevel: null })).toBe(false);
    expect(isTriageComplete(liteAnswers)).toBe(true);
    expect(recommendFromTriage({ ...liteAnswers, reviewCadence: null })).toBeNull();
  });

  it('maps low-risk relationships to Lite with a small framework set', () => {
    const score = scoreTriage(liteAnswers);
    expect(tierFromScore(score)).toBe('Lite');
    const rec = recommendFromTriage(liteAnswers);
    expect(rec?.tier).toBe('Lite');
    expect(rec?.frameworks).toEqual(['soc2']);
    expect(rec?.questionTarget).toMatch(/12/);
  });

  it('maps typical SaaS access to Standard', () => {
    const rec = recommendFromTriage(standardAnswers);
    expect(rec?.tier).toBe('Standard');
    expect(rec?.frameworks).toEqual(expect.arrayContaining(['nist_csf_2', 'soc2']));
  });

  it('maps regulated / privileged vendors to Enhanced and industry packs', () => {
    const rec = recommendFromTriage(enhancedAnswers);
    expect(rec?.tier).toBe('Enhanced');
    expect(rec?.frameworks).toEqual(
      expect.arrayContaining(['nist_csf_2', 'soc2', 'iso27001', 'hipaa', 'cis_controls'])
    );
  });

  it('adds PCI when payment data or pci obligation is selected', () => {
    const frameworks = frameworksForTriage(
      { ...standardAnswers, dataExposure: ['payment'], requirements: ['pci'] },
      'Standard'
    );
    expect(frameworks).toContain('pci_dss_4');
  });

  it('parses and serializes frameworks query params', () => {
    expect(parseFrameworksParam('nist_csf_2,soc2,custom,bogus')).toEqual(['nist_csf_2', 'soc2']);
    expect(frameworksToParam(['soc2', 'custom', 'hipaa'])).toBe('soc2,hipaa');
    expect(parseFrameworksParam(null)).toEqual([]);
  });
});
