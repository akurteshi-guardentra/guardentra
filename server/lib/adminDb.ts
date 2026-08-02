import fs from 'fs';
import path from 'path';
import { getApp } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';

/**
 * Same "which Firestore database" lookup already duplicated twice in
 * server/routes/stripe.ts (named database via firebase-applet-config.json,
 * falling back to (default)) — pulled out so a third route doesn't copy it again.
 */
export function getAdminDb(): Firestore {
  const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
  if (fs.existsSync(configPath)) {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    if (config.firestoreDatabaseId && config.firestoreDatabaseId !== '(default)') {
      return getFirestore(getApp(), config.firestoreDatabaseId);
    }
  }
  return getFirestore();
}
