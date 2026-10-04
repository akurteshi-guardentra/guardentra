import fs from 'node:fs';

function valueAt(object, path) {
  let current = object;
  for (const segment of path) {
    if (!current || typeof current !== 'object') return undefined;
    current = current[segment];
  }
  return current;
}

export function extensionRows(payload) {
  if (!payload || typeof payload !== 'object' || !Object.prototype.hasOwnProperty.call(payload, 'result')) {
    throw new Error('firebase ext:list JSON missing result');
  }
  const result = payload.result;
  if (Array.isArray(result)) return result;
  if (result && typeof result === 'object' && Array.isArray(result.instances)) return result.instances;
  if (
    result &&
    typeof result === 'object' &&
    ('instanceId' in result || 'name' in result || 'extensionRef' in result)
  ) {
    return [result];
  }
  if (result == null) return [];
  return [];
}

function safeString(value) {
  return typeof value === 'string' ? value : '';
}

export function isSendEmailExtension(row) {
  const values = [
    row?.instanceId,
    row?.name,
    row?.extensionRef,
    row?.ref,
    valueAt(row, ['config', 'source', 'spec', 'name']),
    valueAt(row, ['config', 'source', 'spec', 'displayName']),
  ].map(safeString);

  return values.some((value) => /(^|[\/_-])firestore-send-email($|[\/_-])|trigger email/i.test(value));
}

export function sanitizeExtensionInventory(payload, projectId, observedUtc = new Date().toISOString()) {
  const rows = extensionRows(payload).filter(isSendEmailExtension);
  const instances = rows.map((row) => {
    const name = safeString(row.instanceId) || safeString(row.name).split('/').pop() || 'unknown';
    const state = safeString(row.state) || safeString(valueAt(row, ['config', 'source', 'state'])) || 'UNKNOWN';
    const extensionRef =
      safeString(row.extensionRef) ||
      safeString(row.ref) ||
      safeString(valueAt(row, ['config', 'source', 'spec', 'name'])) ||
      'unknown';
    const version =
      safeString(row.version) ||
      safeString(valueAt(row, ['config', 'source', 'spec', 'version'])) ||
      'unknown';
    return { instanceId: name, state, extensionRef, version };
  });

  let state = 'absent';
  if (instances.length > 1) state = 'ambiguous';
  else if (instances.length === 1) state = instances[0].state === 'ACTIVE' ? 'active' : 'installed_not_active';

  return {
    schema: 'guardentra.firebase_extension_inventory.v1',
    project_id: projectId,
    observed_utc: observedUtc,
    send_email: {
      state,
      instance_count: instances.length,
      instances,
    },
  };
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 2) {
    const key = argv[i];
    const value = argv[i + 1];
    if (!key?.startsWith('--') || value == null) throw new Error('expected --key value arguments');
    args[key.slice(2)] = value;
  }
  return args;
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1].replace(/\\/g, '/')}`).href) {
  const args = parseArgs(process.argv.slice(2));
  if (!args.input || !args.project) throw new Error('--input and --project are required');

  const raw = fs.readFileSync(args.input, 'utf8');
  const payload = JSON.parse(raw);
  const safe = sanitizeExtensionInventory(payload, args.project);
  const output = JSON.stringify(safe, null, 2);

  if (args.output) fs.writeFileSync(args.output, output + '\n', 'utf8');
  process.stdout.write(output + '\n');
}
