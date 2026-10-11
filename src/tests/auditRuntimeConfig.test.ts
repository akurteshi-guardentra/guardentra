import { describe, expect, it } from 'vitest';
import {
  assertAuditRuntimeConfig,
  isAuditSpineEnabled,
} from '../../server/lib/audit/pool';

describe('#150 audit runtime configuration', () => {
  it('allows disabled audit mode without a database URL', () => {
    const env = { AUDIT_SPINE_ENABLED: 'false' } as NodeJS.ProcessEnv;
    expect(isAuditSpineEnabled(env)).toBe(false);
    expect(() => assertAuditRuntimeConfig(env)).not.toThrow();
  });

  it('allows unset audit mode without a database URL', () => {
    const env = {} as NodeJS.ProcessEnv;
    expect(isAuditSpineEnabled(env)).toBe(false);
    expect(() => assertAuditRuntimeConfig(env)).not.toThrow();
  });

  it.each(['true', '1'])('fails closed when audit is enabled with no DB URL (%s)', (enabled) => {
    const env = { AUDIT_SPINE_ENABLED: enabled } as NodeJS.ProcessEnv;
    expect(isAuditSpineEnabled(env)).toBe(true);
    expect(() => assertAuditRuntimeConfig(env)).toThrow(
      'AUDIT_SPINE_ENABLED requires AUDIT_DATABASE_URL',
    );
  });

  it('fails closed when the database URL is blank', () => {
    const env = {
      AUDIT_SPINE_ENABLED: 'true',
      AUDIT_DATABASE_URL: '   ',
    } as NodeJS.ProcessEnv;
    expect(() => assertAuditRuntimeConfig(env)).toThrow(
      'AUDIT_SPINE_ENABLED requires AUDIT_DATABASE_URL',
    );
  });

  it('accepts enabled audit mode when durable database config is present', () => {
    const env = {
      AUDIT_SPINE_ENABLED: 'true',
      AUDIT_DATABASE_URL: 'postgresql://example.invalid/guardentra',
    } as NodeJS.ProcessEnv;
    expect(() => assertAuditRuntimeConfig(env)).not.toThrow();
  });
});
