/**
 * Progressive first-vendor setup checklist derived from real tenant state.
 * Never invents completion from localStorage or optimistic flags.
 */

export type SetupChecklistItemId =
  | 'organizationProfile'
  | 'assessmentPacks'
  | 'firstVendor'
  | 'firstAssessment'
  | 'inviteTeammate';

export type SetupChecklistItem = {
  id: SetupChecklistItemId;
  label: string;
  done: boolean;
  /** When false, item is hidden (e.g. invite teammate for non-admins). */
  visible: boolean;
  href: string;
  primary?: boolean;
};

export type OrgSetupSnapshot = {
  name?: string | null;
  industry?: string | null;
  autoCreated?: boolean | null;
  frameworkPackDefaults?: Record<string, unknown> | null;
  seatCount?: number | null;
};

export type SetupProgressInput = {
  org: OrgSetupSnapshot | null;
  vendorCount: number;
  assessmentCount: number;
  /** Pending org_invites for this tenant (teammate invites). */
  pendingTeammateInviteCount: number;
  role?: string | null;
};

function hasPackDefaults(raw: unknown): boolean {
  if (!raw || typeof raw !== 'object') return false;
  return Object.values(raw as Record<string, unknown>).some(
    (v) => typeof v === 'string' && v.trim().length > 0,
  );
}

/** Organization profile is complete when name + industry are both set (Settings). */
export function isOrganizationProfileComplete(org: OrgSetupSnapshot | null): boolean {
  if (!org) return false;
  const name = String(org.name || '').trim();
  const industry = String(org.industry || '').trim();
  return name.length > 0 && industry.length > 0;
}

export function deriveSetupChecklist(input: SetupProgressInput): SetupChecklistItem[] {
  const org = input.org;
  const isAdmin = input.role === 'admin';
  const orgDone = isOrganizationProfileComplete(org);
  const packsDone = hasPackDefaults(org?.frameworkPackDefaults);
  const vendorDone = input.vendorCount > 0;
  const assessmentDone = input.assessmentCount > 0;
  const inviteDone =
    input.pendingTeammateInviteCount > 0 || (Number(org?.seatCount) || 1) > 1;

  const items: SetupChecklistItem[] = [
    {
      id: 'organizationProfile',
      label: 'Complete organization profile',
      done: orgDone,
      visible: true,
      href: '/settings',
    },
    {
      id: 'assessmentPacks',
      label: 'Choose assessment pack defaults',
      done: packsDone,
      visible: true,
      href: '/settings',
    },
    {
      id: 'firstVendor',
      label: 'Add your first vendor',
      done: vendorDone,
      visible: true,
      href: '/vendors',
      primary: !vendorDone,
    },
    {
      id: 'firstAssessment',
      label: 'Create your first assessment',
      done: assessmentDone,
      visible: true,
      href: '/assessments/new',
    },
    {
      id: 'inviteTeammate',
      label: 'Invite a teammate',
      done: inviteDone,
      visible: isAdmin,
      href: '/settings',
    },
  ];

  return items.filter((i) => i.visible);
}

/** True when every visible checklist item is done (hide the checklist). */
export function isSetupChecklistComplete(items: SetupChecklistItem[]): boolean {
  return items.length > 0 && items.every((i) => i.done);
}
