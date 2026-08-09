import { describe, expect, it } from 'vitest';
import { resolveFastTrackStage } from '../components/spine/FastTrackStageBar';

describe('resolveFastTrackStage', () => {
  it('maps spine routes', () => {
    expect(resolveFastTrackStage('/vendors')).toBe('vendors');
    expect(resolveFastTrackStage('/assessments/triage')).toBe('triage');
    expect(resolveFastTrackStage('/assessments/new')).toBe('wizard');
    expect(resolveFastTrackStage('/assessments')).toBe('review');
    expect(resolveFastTrackStage('/assessments', '?focus=monitor')).toBe('monitor');
    expect(resolveFastTrackStage('/portal/abc')).toBe('portal');
  });
});
