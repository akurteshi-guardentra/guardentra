import { describe, expect, it } from 'vitest';
import {
  extensionRows,
  isSendEmailExtension,
  sanitizeExtensionInventory,
} from '../../scripts/release/firebase-ext-evidence.mjs';

describe('#72 Firebase extension evidence sanitizer', () => {
  it('supports the direct read-only Extensions API instances response', () => {
    const evidence = sanitizeExtensionInventory(
      {
        instances: [
          {
            name: 'projects/guardentra-staging/instances/firestore-send-email',
            state: 'ACTIVE',
            config: {
              source: {
                spec: {
                  name: 'firestore-send-email',
                  version: '0.2.4',
                },
              },
              params: { SMTP_PASSWORD: 'must-never-appear' },
            },
          },
        ],
      },
      'guardentra-staging',
      '2026-10-04T12:00:00Z'
    );

    expect(evidence.send_email.state).toBe('active');
    expect(evidence.send_email.instance_count).toBe(1);
    expect(JSON.stringify(evidence)).not.toContain('must-never-appear');
    expect(JSON.stringify(evidence)).not.toContain('SMTP_PASSWORD');
  });

  it('supports current CLI result arrays without copying configuration params', () => {
    const payload = {
      status: 'success',
      result: [
        {
          instanceId: 'firestore-send-email',
          extensionRef: 'firebase/firestore-send-email',
          state: 'ACTIVE',
          version: '0.2.4',
          params: { SMTP_PASSWORD: 'must-never-appear' },
        },
      ],
    };

    const evidence = sanitizeExtensionInventory(payload, 'guardentra-staging', '2026-10-04T12:00:00Z');
    expect(evidence.send_email.state).toBe('active');
    expect(evidence.send_email.instance_count).toBe(1);
    expect(JSON.stringify(evidence)).not.toContain('must-never-appear');
    expect(JSON.stringify(evidence)).not.toContain('SMTP_PASSWORD');
  });

  it('supports legacy result.instances and nested spec identity', () => {
    const payload = {
      result: {
        instances: [
          {
            name: 'projects/p/instances/mail-prod',
            state: 'ACTIVE',
            config: {
              source: {
                state: 'ACTIVE',
                spec: {
                  name: 'firestore-send-email',
                  version: '0.1.0',
                  displayName: 'Trigger Email',
                },
              },
              params: { SMTP_CONNECTION_URI: 'smtps://secret' },
            },
          },
        ],
      },
    };

    const evidence = sanitizeExtensionInventory(payload, 'guardentra-staging');
    expect(evidence.send_email.state).toBe('active');
    expect(evidence.send_email.instances[0]).toMatchObject({
      instanceId: 'mail-prod',
      state: 'ACTIVE',
      extensionRef: 'firestore-send-email',
      version: '0.1.0',
    });
    expect(JSON.stringify(evidence)).not.toContain('smtps://secret');
  });

  it('reports absent when no send-email instance is listed', () => {
    expect(
      sanitizeExtensionInventory({ result: [] }, 'guardentra-staging').send_email
    ).toMatchObject({ state: 'absent', instance_count: 0 });
  });

  it('reports installed_not_active instead of calling an errored instance disabled', () => {
    const evidence = sanitizeExtensionInventory(
      {
        result: [
          {
            instanceId: 'firestore-send-email',
            extensionRef: 'firebase/firestore-send-email',
            state: 'ERRORED',
          },
        ],
      },
      'guardentra-staging'
    );
    expect(evidence.send_email.state).toBe('installed_not_active');
  });

  it('reports multiple send-email instances as ambiguous', () => {
    const row = {
      extensionRef: 'firebase/firestore-send-email',
      state: 'ACTIVE',
    };
    const evidence = sanitizeExtensionInventory(
      { result: [{ ...row, instanceId: 'mail-a' }, { ...row, instanceId: 'mail-b' }] },
      'guardentra-staging'
    );
    expect(evidence.send_email.state).toBe('ambiguous');
    expect(evidence.send_email.instance_count).toBe(2);
  });

  it('refuses malformed JSON shape', () => {
    expect(() => extensionRows({ status: 'success' })).toThrow(/missing instances\/result/);
  });

  it('does not misclassify unrelated extension names', () => {
    expect(isSendEmailExtension({ instanceId: 'storage-resize-images' })).toBe(false);
  });
});
