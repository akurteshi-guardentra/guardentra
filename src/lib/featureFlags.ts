/**
 * Product focus flags — freeze non-spine modules without deleting code.
 * Override with VITE_FEATURE_<KEY>=true|false when needed.
 */

function envOverride(key: string, fallback: boolean): boolean {
  const raw = (import.meta as ImportMeta & { env?: Record<string, string> }).env?.[
    `VITE_FEATURE_${key}`
  ];
  if (raw === 'true' || raw === '1') return true;
  if (raw === 'false' || raw === '0') return false;
  return fallback;
}

export const FEATURES = {
  dashboard: envOverride('DASHBOARD', true),
  vendorSpine: envOverride('VENDOR_SPINE', true),
  assessments: envOverride('ASSESSMENTS', true),
  auditReadiness: envOverride('AUDIT_READINESS', true),
  docs: envOverride('DOCS', true),
  pricing: envOverride('PRICING', true),
  settings: envOverride('SETTINGS', true),

  // Frozen until spine matches mockups 1–3
  trustIntelligence: envOverride('TRUST_INTELLIGENCE', false),
  govIntel: envOverride('GOV_INTEL', false),
  trustVault: envOverride('TRUST_VAULT', false),
  executiveReports: envOverride('EXECUTIVE_REPORTS', false),
  risks: envOverride('RISKS', false),
  incidents: envOverride('INCIDENTS', false),
  identitySurface: envOverride('IDENTITY_SURFACE', false),
  compliance: envOverride('COMPLIANCE', false),
  contractAudit: envOverride('CONTRACT_AUDIT', false),
  policies: envOverride('POLICIES', false),
  connectors: envOverride('CONNECTORS', false),
  gmailAudit: envOverride('GMAIL_AUDIT', false),
  auditCalendar: envOverride('AUDIT_CALENDAR', false),
  healthLab: envOverride('HEALTH_LAB', false),
  voiceStudio: envOverride('VOICE_STUDIO', false),
  aiCopilot: envOverride('AI_COPILOT', false),
  vendorsLegacy: envOverride('VENDORS_LEGACY', false),
} as const;

export type FeatureKey = keyof typeof FEATURES;

/** Path prefixes that require a feature flag. Longest match wins. */
const ROUTE_FLAGS: { prefix: string; flag: FeatureKey }[] = [
  { prefix: '/policies/draftsman', flag: 'policies' },
  { prefix: '/policies', flag: 'policies' },
  { prefix: '/vendors/legacy', flag: 'vendorsLegacy' },
  { prefix: '/vendors', flag: 'vendorSpine' },
  { prefix: '/assessments', flag: 'assessments' },
  { prefix: '/audit-readiness', flag: 'auditReadiness' },
  { prefix: '/trust-intelligence', flag: 'trustIntelligence' },
  { prefix: '/gov-intel', flag: 'govIntel' },
  { prefix: '/trust-vault', flag: 'trustVault' },
  { prefix: '/executive-reports', flag: 'executiveReports' },
  { prefix: '/risks', flag: 'risks' },
  { prefix: '/incidents', flag: 'incidents' },
  { prefix: '/devices', flag: 'identitySurface' },
  { prefix: '/compliance', flag: 'compliance' },
  { prefix: '/contract-negotiator', flag: 'contractAudit' },
  { prefix: '/connectors', flag: 'connectors' },
  { prefix: '/gmail-audit', flag: 'gmailAudit' },
  { prefix: '/calendar', flag: 'auditCalendar' },
  { prefix: '/health', flag: 'healthLab' },
  { prefix: '/ai-assistant', flag: 'voiceStudio' },
  { prefix: '/dashboard', flag: 'dashboard' },
  { prefix: '/docs', flag: 'docs' },
  { prefix: '/pricing', flag: 'pricing' },
  { prefix: '/settings', flag: 'settings' },
];

export function isFeatureEnabled(flag: FeatureKey): boolean {
  return FEATURES[flag];
}

export function isRouteEnabled(pathname: string): boolean {
  const hit = ROUTE_FLAGS.find(
    (r) => pathname === r.prefix || pathname.startsWith(`${r.prefix}/`)
  );
  if (!hit) return true;
  return FEATURES[hit.flag];
}

export function featureLabelForPath(pathname: string): string {
  const hit = ROUTE_FLAGS.find(
    (r) => pathname === r.prefix || pathname.startsWith(`${r.prefix}/`)
  );
  return hit?.flag || 'this module';
}
