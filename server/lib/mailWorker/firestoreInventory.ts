import { FieldPath, type Firestore } from 'firebase-admin/firestore';
import { MAIL_COLLECTION } from '../mailQueue';
import { ReconcileError, type MailInventoryEntry } from './reconcile';

/**
 * Read-only inventory of `mail` for the reconcile script.
 *
 * Firestore cannot query on a missing field or on document create time, so
 * this pages through the whole collection by document id. `select('delivery')`
 * is a projection: recipients, subjects and bodies are never fetched.
 */
export async function listMailInventory(db: Firestore, opts: {
  pageSize?: number; maxDocs?: number;
} = {}): Promise<MailInventoryEntry[]> {
  const pageSize = opts.pageSize ?? 300;
  const maxDocs = opts.maxDocs ?? 20_000;
  const out: MailInventoryEntry[] = [];
  let last: string | null = null;
  for (;;) {
    let query = db.collection(MAIL_COLLECTION).select('delivery')
      .orderBy(FieldPath.documentId()).limit(pageSize);
    if (last !== null) query = query.startAfter(last);
    const page = await query.get();
    for (const doc of page.docs) {
      const data = doc.data();
      out.push({
        id: doc.id,
        createdAtMs: doc.createTime.toMillis(),
        delivery: Object.prototype.hasOwnProperty.call(data, 'delivery') ? data.delivery : undefined,
      });
    }
    if (out.length > maxDocs) throw new ReconcileError('INVENTORY_TOO_LARGE', `more than ${maxDocs} mail docs; nothing was processed`);
    if (page.size < pageSize) return out;
    last = page.docs[page.docs.length - 1].id;
  }
}
