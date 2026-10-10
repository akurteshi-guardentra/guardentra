import type { Firestore } from 'firebase-admin/firestore';
import { MAIL_COLLECTION } from '../mailQueue';
import type { MailStore } from './worker';

export function createFirestoreMailStore(db: Firestore): MailStore {
  const collection = db.collection(MAIL_COLLECTION);
  return {
    async transact(id, fn) {
      if (!id || id.includes('/')) throw new Error('MAIL_ID_INVALID');
      const ref = collection.doc(id);
      return db.runTransaction(async tx => {
        const snapshot = await tx.get(ref);
        const outcome = fn(snapshot.exists ? {
          data: snapshot.data()!, createdAtMs: snapshot.createTime!.toMillis(),
        } : null);
        if (outcome.delivery) tx.update(ref, { delivery: outcome.delivery });
        return outcome.value;
      });
    },
    async due(now, limit) {
      // One range field, using the default single-field index. Null is excluded.
      const snapshot = await collection.where('delivery.dueAt', '>=', 0)
        .where('delivery.dueAt', '<=', now).orderBy('delivery.dueAt').limit(limit).get();
      return snapshot.docs.map(doc => doc.id);
    },
  };
}
