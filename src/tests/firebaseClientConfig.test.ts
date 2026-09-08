import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  DEMO_FIREBASE_PROJECT_ID,
  resolveFirebaseClientConfig,
  type FirebaseDemoConfig,
} from '../lib/firebaseClientConfig';

const DEMO: FirebaseDemoConfig = {
  apiKey: '',
  projectId: DEMO_FIREBASE_PROJECT_ID,
  authDomain: 'guardentra-7f582.firebaseapp.com',
  storageBucket: 'guardentra-7f582.firebasestorage.app',
  messagingSenderId: '967769575761',
  appId: '1:967769575761:web:5f5ea9e666e0f314f64370',
};

const DEV_API_KEY = 'AIzaSyDummyLocalDevFirebaseKey01';
const STAGING_API_KEY = 'AIzaSyDummyStagingFirebaseKey01';
const PROD_API_KEY = 'AIzaSyDummyProdFirebaseKey00001';

const STAGING_ENV = {
  MODE: 'production',
  PROD: true,
  DEV: false,
  VITE_FIREBASE_API_KEY: STAGING_API_KEY,
  VITE_FIREBASE_PROJECT_ID: 'guardentra-staging',
  VITE_FIREBASE_AUTH_DOMAIN: 'guardentra-staging.firebaseapp.com',
  VITE_FIREBASE_STORAGE_BUCKET: 'guardentra-staging.firebasestorage.app',
  VITE_FIREBASE_MESSAGING_SENDER_ID: '965959469996',
  VITE_FIREBASE_APP_ID: '1:965959469996:web:25526a3a432460c6ef0809',
};

const PROD_ENV = {
  MODE: 'production',
  PROD: true,
  DEV: false,
  VITE_FIREBASE_API_KEY: PROD_API_KEY,
  VITE_FIREBASE_PROJECT_ID: 'guardentra-prod',
  VITE_FIREBASE_AUTH_DOMAIN: 'guardentra-prod.firebaseapp.com',
  VITE_FIREBASE_STORAGE_BUCKET: 'guardentra-prod.firebasestorage.app',
  VITE_FIREBASE_MESSAGING_SENDER_ID: '191663365586',
  VITE_FIREBASE_APP_ID: '1:191663365586:web:617ac1e2eeacc65d88bc0b',
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('resolveFirebaseClientConfig', () => {
  it('local DEV may use explicit demo config', () => {
    const cfg = resolveFirebaseClientConfig(
      { MODE: 'development', DEV: true, PROD: false, VITE_FIREBASE_API_KEY: DEV_API_KEY },
      DEMO,
    );
    expect(cfg.projectId).toBe(DEMO_FIREBASE_PROJECT_ID);
    expect(cfg.authDomain).toBe(DEMO.authDomain);
    expect(cfg.storageBucket).toBe(DEMO.storageBucket);
    expect(cfg.appId).toBe(DEMO.appId);
    expect(cfg.apiKey).toBe(DEV_API_KEY);
  });

  it('production build with all required env values succeeds', () => {
    const cfg = resolveFirebaseClientConfig(PROD_ENV, DEMO);
    expect(cfg.projectId).toBe('guardentra-prod');
    expect(cfg.appId).toBe(PROD_ENV.VITE_FIREBASE_APP_ID);
  });

  it('production build missing project ID fails', () => {
    const { VITE_FIREBASE_PROJECT_ID: _, ...rest } = PROD_ENV;
    expect(() => resolveFirebaseClientConfig(rest, DEMO)).toThrow(/VITE_FIREBASE_PROJECT_ID/);
  });

  it('production build missing app ID fails', () => {
    const { VITE_FIREBASE_APP_ID: _, ...rest } = PROD_ENV;
    expect(() => resolveFirebaseClientConfig(rest, DEMO)).toThrow(/VITE_FIREBASE_APP_ID/);
  });

  it('production build missing auth domain fails', () => {
    const { VITE_FIREBASE_AUTH_DOMAIN: _, ...rest } = PROD_ENV;
    expect(() => resolveFirebaseClientConfig(rest, DEMO)).toThrow(/VITE_FIREBASE_AUTH_DOMAIN/);
  });

  it('production build missing storage bucket fails', () => {
    const { VITE_FIREBASE_STORAGE_BUCKET: _, ...rest } = PROD_ENV;
    expect(() => resolveFirebaseClientConfig(rest, DEMO)).toThrow(/VITE_FIREBASE_STORAGE_BUCKET/);
  });

  it('partial env config never combines with demo config', () => {
    expect(() =>
      resolveFirebaseClientConfig(
        {
          MODE: 'development',
          DEV: true,
          PROD: false,
          VITE_FIREBASE_API_KEY: DEV_API_KEY,
          VITE_FIREBASE_PROJECT_ID: 'guardentra-staging',
          // deliberately omit other identifiers
        },
        DEMO,
      ),
    ).toThrow(/Partial Firebase client env/);

    expect(() =>
      resolveFirebaseClientConfig(
        {
          MODE: 'production',
          PROD: true,
          VITE_FIREBASE_API_KEY: STAGING_API_KEY,
          VITE_FIREBASE_PROJECT_ID: 'guardentra-staging',
        },
        DEMO,
      ),
    ).toThrow(/Incomplete Firebase client config/);
  });

  it('staging config resolves only guardentra-staging', () => {
    const cfg = resolveFirebaseClientConfig(STAGING_ENV, DEMO);
    expect(cfg.projectId).toBe('guardentra-staging');
    expect(cfg.authDomain).toContain('guardentra-staging');
    expect(cfg.storageBucket).toContain('guardentra-staging');
    expect(cfg.projectId).not.toBe(DEMO_FIREBASE_PROJECT_ID);
    expect(cfg.appId).not.toContain('967769575761');
  });

  it('production config resolves only guardentra-prod', () => {
    const cfg = resolveFirebaseClientConfig(PROD_ENV, DEMO);
    expect(cfg.projectId).toBe('guardentra-prod');
    expect(cfg.authDomain).toContain('guardentra-prod');
    expect(cfg.storageBucket).toContain('guardentra-prod');
    expect(cfg.projectId).not.toBe(DEMO_FIREBASE_PROJECT_ID);
    expect(cfg.projectId).not.toBe('guardentra-staging');
  });

  it('no secret/API-key value is logged', () => {
    const logs: string[] = [];
    resolveFirebaseClientConfig(STAGING_ENV, DEMO, {
      log: (message) => logs.push(message),
    });
    expect(logs.length).toBe(1);
    expect(logs[0]).toContain('projectId=guardentra-staging');
    expect(logs[0]).toContain('environment=production');
    expect(logs.join('\n')).not.toContain(STAGING_API_KEY);
    expect(logs.join('\n')).not.toMatch(/AIza/);
  });

  it('production build with only API key does not fall back to demo', () => {
    expect(() =>
      resolveFirebaseClientConfig(
        {
          MODE: 'production',
          PROD: true,
          VITE_FIREBASE_API_KEY: DEV_API_KEY,
        },
        DEMO,
      ),
    ).toThrow(/Incomplete Firebase client config/);
  });
});
