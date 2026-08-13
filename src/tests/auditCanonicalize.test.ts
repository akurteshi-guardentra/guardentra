import { describe, expect, it } from 'vitest';
import { canonicalize } from '../../server/lib/audit/canonicalize';
import { redactAuditPayload } from '../../server/lib/audit/redact';
import { sha256Hex, GENESIS_HASH } from '../../server/lib/audit/types';

describe('audit canonicalize', () => {
  it('sorts object keys stably', () => {
    expect(canonicalize({ b: 1, a: 2 })).toBe(canonicalize({ a: 2, b: 1 }));
    expect(canonicalize({ a: 2, b: 1 })).toBe('{"a":2,"b":1}');
  });

  it('omits undefined and normalizes nested keys', () => {
    expect(canonicalize({ z: undefined, nested: { b: 1, a: null } })).toBe(
      '{"nested":{"a":null,"b":1}}'
    );
  });
});

describe('audit redact', () => {
  it('redacts sensitive keys and truncates long strings', () => {
    const out = redactAuditPayload({
      token: 'secret-value',
      note: 'x'.repeat(600),
      html: '<b>omit</b>',
      ok: 'fine',
    }) as Record<string, unknown>;
    expect(out.token).toBe('[redacted]');
    expect(out.html).toBe('[omitted]');
    expect(String(out.note).endsWith('…')).toBe(true);
    expect(out.ok).toBe('fine');
  });
});

describe('audit hash helpers', () => {
  it('hashes deterministically from previous + payload', () => {
    const body = canonicalize({ eventId: 'e1', seq: 1 });
    const h1 = sha256Hex(`${GENESIS_HASH}\n${body}`);
    const h2 = sha256Hex(`${GENESIS_HASH}\n${body}`);
    expect(h1).toBe(h2);
    expect(h1).toMatch(/^[a-f0-9]{64}$/);
  });
});
