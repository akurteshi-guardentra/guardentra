import { getAuditPool } from './pool.ts';

function sanitizeCsvCell(value: unknown): string {
  let s = value == null ? '' : String(value);
  // Formula injection: force text when cell starts with spreadsheet operators.
  if (/^[=+\-@]/.test(s)) s = `'${s}`;
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export async function exportTenantAudit(
  tenantId: string,
  format: 'json' | 'csv'
): Promise<{ body: string; contentType: string }> {
  const db = getAuditPool();
  if (!db) throw new Error('Audit database unavailable');

  const { rows } = await db.query(
    `SELECT e.event_id, e.event_type, e.actor_id, e.actor_type, e.object_type, e.object_id,
            e.payload, e.created_at, c.seq, c.hash, c.previous_hash
     FROM audit_events e
     LEFT JOIN audit_hash_chain c ON c.event_id = e.event_id
     WHERE e.tenant_id = $1
     ORDER BY COALESCE(c.seq, 0) ASC, e.created_at ASC`,
    [tenantId]
  );

  if (format === 'csv') {
    const header = [
      'seq',
      'event_id',
      'event_type',
      'actor_id',
      'object_type',
      'object_id',
      'created_at',
      'hash',
      'previous_hash',
      'payload_json',
    ];
    const lines = [header.join(',')];
    for (const r of rows) {
      lines.push(
        [
          sanitizeCsvCell(r.seq),
          sanitizeCsvCell(r.event_id),
          sanitizeCsvCell(r.event_type),
          sanitizeCsvCell(r.actor_id),
          sanitizeCsvCell(r.object_type),
          sanitizeCsvCell(r.object_id),
          sanitizeCsvCell(r.created_at?.toISOString?.() || r.created_at),
          sanitizeCsvCell(r.hash),
          sanitizeCsvCell(r.previous_hash),
          sanitizeCsvCell(JSON.stringify(r.payload)),
        ].join(',')
      );
    }
    return { body: lines.join('\n'), contentType: 'text/csv; charset=utf-8' };
  }

  return {
    body: JSON.stringify({ tenantId, count: rows.length, events: rows }, null, 2),
    contentType: 'application/json; charset=utf-8',
  };
}
