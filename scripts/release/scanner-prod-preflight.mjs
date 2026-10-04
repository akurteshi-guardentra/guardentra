import fs from 'node:fs';

export const SCANNER_KEYS = [
  'EVIDENCE_SCANNER_ENABLED',
  'EVIDENCE_SCANNER_SECRET',
  'EVIDENCE_SCANNER_MODE',
  'CLAMAV_HOST',
  'CLAMAV_PORT',
  'EVIDENCE_SCANNER_DELIVERY',
  'EVIDENCE_SCANNER_TASK_PROJECT',
  'EVIDENCE_SCANNER_TASK_LOCATION',
  'EVIDENCE_SCANNER_TASK_QUEUE',
  'EVIDENCE_SCANNER_TASK_TARGET_URL',
  'EVIDENCE_SCANNER_TASK_AUDIENCE',
  'EVIDENCE_SCANNER_TASK_SERVICE_ACCOUNT',
];

function unquote(value) {
  const v = String(value ?? '').trim();
  if (
    (v.startsWith('"') && v.endsWith('"')) ||
    (v.startsWith("'") && v.endsWith("'"))
  ) {
    return v.slice(1, -1);
  }
  return v;
}

export function parseAppHostingEnv(text) {
  const entries = new Map();
  let current = null;

  for (const raw of String(text).split(/\r?\n/)) {
    const trimmed = raw.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const variable = /^-\s+variable:\s*([^\s#]+)\s*$/.exec(trimmed);
    if (variable) {
      current = { variable: unquote(variable[1]), value: undefined, secret: undefined };
      entries.set(current.variable, current);
      continue;
    }

    if (!current) continue;
    const value = /^value:\s*(.*?)\s*$/.exec(trimmed);
    if (value) {
      current.value = unquote(value[1]);
      continue;
    }
    const secret = /^secret:\s*(.*?)\s*$/.exec(trimmed);
    if (secret) {
      current.secret = unquote(secret[1]);
    }
  }

  return entries;
}

function enabled(value) {
  return ['1', 'true', 'yes', 'on'].includes(String(value || '').toLowerCase());
}

function validPort(value) {
  if (!/^\d+$/.test(String(value || ''))) return false;
  const n = Number(value);
  return Number.isInteger(n) && n >= 1 && n <= 65535;
}

function safeHttpsUrl(value) {
  try {
    const url = new URL(String(value || ''));
    return (
      url.protocol === 'https:' &&
      !url.username &&
      !url.password &&
      !url.hash &&
      !['localhost', '127.0.0.1'].includes(url.hostname)
    );
  } catch {
    return false;
  }
}

function isPrivateIpv4(value) {
  const host = String(value || '').trim();
  const parts = host.split('.').map(Number);
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) {
    return false;
  }
  return (
    parts[0] === 10 ||
    (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
    (parts[0] === 192 && parts[1] === 168)
  );
}

export function evaluateProductionScannerManifest(text) {
  const entries = parseAppHostingEnv(text);
  const errors = [];
  const scannerEntries = SCANNER_KEYS.filter((key) => entries.has(key));
  const enabledEntry = entries.get('EVIDENCE_SCANNER_ENABLED');

  if (!enabledEntry) {
    if (scannerEntries.length > 0) {
      errors.push(
        'scanner runtime variables are partially active while EVIDENCE_SCANNER_ENABLED is absent',
      );
    }
    return {
      ok: errors.length === 0,
      state: errors.length === 0 ? 'disabled' : 'invalid_partial',
      errors,
      liveProof: false,
    };
  }

  if (!enabled(enabledEntry.value)) {
    errors.push('EVIDENCE_SCANNER_ENABLED must be true when the production scanner block is active');
  }

  const appEnv = entries.get('APP_ENV')?.value;
  if (!['prod', 'production'].includes(String(appEnv || '').toLowerCase())) {
    errors.push('APP_ENV must be prod/production for production scanner activation');
  }

  if (entries.has('EVIDENCE_SCANNER_MODE')) {
    errors.push('EVIDENCE_SCANNER_MODE must not be set in production');
  }

  const secret = entries.get('EVIDENCE_SCANNER_SECRET');
  if (!secret?.secret || secret.secret !== 'EVIDENCE_SCANNER_SECRET' || secret.value) {
    errors.push('EVIDENCE_SCANNER_SECRET must use the Secret Manager reference, never a literal value');
  }

  const clamHost = entries.get('CLAMAV_HOST')?.value;
  if (!String(clamHost || '').trim()) errors.push('CLAMAV_HOST is required');
  if (!validPort(entries.get('CLAMAV_PORT')?.value)) errors.push('CLAMAV_PORT must be 1..65535');

  if (entries.get('EVIDENCE_SCANNER_DELIVERY')?.value !== 'cloud_tasks') {
    errors.push('EVIDENCE_SCANNER_DELIVERY must be cloud_tasks in production');
  }

  const required = [
    'EVIDENCE_SCANNER_TASK_LOCATION',
    'EVIDENCE_SCANNER_TASK_QUEUE',
    'EVIDENCE_SCANNER_TASK_TARGET_URL',
    'EVIDENCE_SCANNER_TASK_AUDIENCE',
    'EVIDENCE_SCANNER_TASK_SERVICE_ACCOUNT',
  ];
  for (const key of required) {
    if (!String(entries.get(key)?.value || '').trim()) errors.push(`${key} is required`);
  }

  if (entries.get('EVIDENCE_SCANNER_TASK_PROJECT')?.value !== 'guardentra-prod') {
    errors.push('EVIDENCE_SCANNER_TASK_PROJECT must be guardentra-prod');
  }

  const target = entries.get('EVIDENCE_SCANNER_TASK_TARGET_URL')?.value;
  const audience = entries.get('EVIDENCE_SCANNER_TASK_AUDIENCE')?.value;
  if (!safeHttpsUrl(target)) errors.push('EVIDENCE_SCANNER_TASK_TARGET_URL must be a safe https URL');
  if (!safeHttpsUrl(audience)) errors.push('EVIDENCE_SCANNER_TASK_AUDIENCE must be a safe https URL');
  if (target && audience && target !== audience) {
    errors.push('scanner Cloud Tasks target URL and audience must match exactly');
  }

  const serviceAccount = entries.get('EVIDENCE_SCANNER_TASK_SERVICE_ACCOUNT')?.value;
  if (
    serviceAccount &&
    !String(serviceAccount).endsWith('@guardentra-prod.iam.gserviceaccount.com')
  ) {
    errors.push('scanner task service account must belong to guardentra-prod');
  }

  if (isPrivateIpv4(clamHost)) {
    const hasVpc =
      /runConfig:\s*[\s\S]*?vpcAccess:\s*[\s\S]*?egress:\s*PRIVATE_RANGES_ONLY/.test(text) &&
      /networkInterfaces:\s*[\s\S]*?-\s+network:\s*[^\s#]+/.test(text);
    if (!hasVpc) {
      errors.push('private CLAMAV_HOST requires App Hosting PRIVATE_RANGES_ONLY VPC access');
    }
  }

  return {
    ok: errors.length === 0,
    state: errors.length === 0 ? 'config_ready' : 'invalid_activation',
    errors,
    liveProof: false,
  };
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1].replace(/\\/g, '/')}`).href) {
  const path = process.argv[2] || 'apphosting.prod.yaml';
  const text = fs.readFileSync(path, 'utf8');
  const result = evaluateProductionScannerManifest(text);
  console.log(
    JSON.stringify(
      {
        schema: 'guardentra.production_scanner_manifest_gate.v1',
        file: path,
        state: result.state,
        pass: result.ok,
        live_proof: false,
        errors: result.errors,
      },
      null,
      2,
    ),
  );
  if (!result.ok) process.exit(2);
}
