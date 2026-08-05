import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import type { FrameworkId } from './types';
import { FRAMEWORK_PACKS, getPack } from './frameworkPacks';

/** organizations/{id}.frameworkPackDefaults — admin-pinned pack per framework family. */
export type FrameworkPackDefaults = Partial<Record<FrameworkId, string>>;

export async function loadOrgFrameworkPackDefaults(
  organizationId: string
): Promise<FrameworkPackDefaults> {
  try {
    const snap = await getDoc(doc(db, 'organizations', organizationId));
    if (!snap.exists()) return {};
    const raw = snap.data()?.frameworkPackDefaults;
    if (!raw || typeof raw !== 'object') return {};
    const cleaned: FrameworkPackDefaults = {};
    for (const [fw, packId] of Object.entries(raw as Record<string, unknown>)) {
      if (typeof packId === 'string' && getPack(packId)) {
        cleaned[fw as FrameworkId] = packId;
      }
    }
    return cleaned;
  } catch {
    return {};
  }
}

export async function saveOrgFrameworkPackDefaults(
  organizationId: string,
  defaults: FrameworkPackDefaults
): Promise<void> {
  const cleaned: FrameworkPackDefaults = {};
  for (const [fw, packId] of Object.entries(defaults)) {
    if (packId && getPack(packId)) cleaned[fw as FrameworkId] = packId;
  }
  await updateDoc(doc(db, 'organizations', organizationId), {
    frameworkPackDefaults: cleaned,
    frameworkPackDefaultsUpdatedAt: new Date().toISOString(),
  });
}

/** Seed defaults to current packs for frameworks activated at onboarding. */
export function currentDefaultsForFrameworks(frameworkIds: FrameworkId[]): FrameworkPackDefaults {
  const defaults: FrameworkPackDefaults = {};
  for (const fw of frameworkIds) {
    if (fw === 'custom') continue;
    const current = FRAMEWORK_PACKS.find((p) => p.frameworkId === fw && p.status === 'current');
    if (current) defaults[fw] = current.packId;
  }
  return defaults;
}
