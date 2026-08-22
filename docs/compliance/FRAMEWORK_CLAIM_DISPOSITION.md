# Framework claim disposition (P0-F2 / Issue #26)

Disposition record for every customer-facing claim row inventoried in [`FRAMEWORK_RIGHTS_REGISTER.md`](./FRAMEWORK_RIGHTS_REGISTER.md). No inventoried row is silently skipped.

| Field | Value |
|---|---|
| GitHub issue | [#26 — Correct unsupported framework claims and define safe product wording](https://github.com/akurteshi-guardentra/guardentra/issues/26) |
| Depends on | P0-F1 inventory merged at `f0f085d701340747963ef28e46ecd92eb9baf579` (PR #45) |
| Required baseline | GuardEntra-authored assessment packs aligned to selected security domains. |
| Rights evidence | All register rows remain **`unknown`**. This PR does not infer publisher permission or legal conclusions. |

## Disposition vocabulary

| Disposition | Meaning |
|---|---|
| `CORRECTED` | User-visible or active-fallback wording was changed to the safe baseline or a qualified equivalent. |
| `NEUTRAL_LABEL` | Pack/catalog `displayName` or domain label identifying which GuardEntra pack is selected. Not treated as a certification. |
| `KEEP_FEATURE` | Describes shipped product behavior (dedupe, stamps, SKU caps) without official/certified/guaranteed-compliance claims. |
| `KEEP_PROCESS` | Describes process facts (no auto-download of publisher standards; empty-snapshot rebuild). |
| `KEEP_STAMPED` | Displays historically stored assessment labels. Existing snapshots were **not** rewritten. |
| `KEEP_QUESTIONNAIRE` | Question-bank text. Issue #26 does **not** authorize deletion or replacement without owner approval. |
| `KEEP_GATED` | Frozen/legacy/unwired surface remains unpublished (`FEATURES.*` default `false`). Rights unknown. |
| `TEST_ONLY` | Test/fixture copy. Updated only when it asserts production labels this PR changed. |
| `ESCALATED` | Left for owner/counsel; engineering will not invent a rights conclusion. |

## Summary counts

| Disposition | Rows |
|---|---:|
| `CORRECTED` | 43 |
| `NEUTRAL_LABEL` | 1 |
| `KEEP_FEATURE` | 6 |
| `KEEP_PROCESS` | 2 |
| `KEEP_STAMPED` | 3 |
| `KEEP_QUESTIONNAIRE` | 4 |
| `KEEP_GATED` | 46 |
| `TEST_ONLY` | 4 |
| `ESCALATED` | 3 |
| **Total** | **112** |

Publication-class coverage: public-active **9**, authenticated-active **52**, frozen **37**, legacy **9**, test-only **4**, unknown **1**. All 112 inventoried IDs appear in the table below.

## Claim rows

| ID | Class | Disposition | Rationale |
|---|---|---|---|
| C-001 | public-active | CORRECTED | `index.html` title/meta no longer claim “Enterprise GRC” or autonomous compliance workflows. |
| C-002 | unknown | CORRECTED | `metadata.json` description now uses the safe pack baseline. |
| C-003a | public-active | CORRECTED | Partner strip no longer presents NYDFS Part 500 as a partner/cert. |
| C-003b | public-active | CORRECTED | NAIC CERT partner mark removed. |
| C-003c | public-active | CORRECTED | Lloyd’s READY partner mark removed. |
| C-003d | public-active | CORRECTED | SOC 2 Type II no longer shown as a partner/attestation badge. |
| C-003e | public-active | CORRECTED | NIST SP 800-53 partner mark removed (shipped pack is CSF, not 800-53). |
| C-004 | public-active | CORRECTED | Replaced NYDFS/NAIC “instant mapping” copy with questionnaire wording + safe baseline. |
| C-005 | public-active | CORRECTED | “Detect compliance gaps” replaced with questionnaire-gap language + safe baseline. |
| C-007 | authenticated-active | CORRECTED | Onboarding heading no longer asks what the org “reports against”; pack-selection copy retained as product behavior. |
| C-008 | authenticated-active | CORRECTED | ISO onboarding blurb no longer calls the pack a certification. |
| C-009 | authenticated-active | CORRECTED | SOC 2 onboarding label/blurb no longer claim Type II audited proof. |
| C-010 | authenticated-active | CORRECTED | NIST onboarding blurb uses the safe baseline instead of “control baseline.” |
| C-011 | authenticated-active | CORRECTED | HIPAA onboarding blurb no longer states a legal obligation. |
| C-012 | authenticated-active | ESCALATED | Implementation comment qualified as not a rights record. Ownership/license still unknown — owner/counsel. |
| C-012b | authenticated-active | CORRECTED | “Official packs.” comment replaced with “Shipped packs.” |
| C-013 | authenticated-active | CORRECTED | NIST CSF 1.1 changelog qualified as GuardEntra-authored labelled pack. **displayName kept** as pack identifier. |
| C-014 | authenticated-active | CORRECTED | NIST CSF 2.0 changelog qualified. **displayName kept.** |
| C-015 | authenticated-active | CORRECTED | Removed “Annex A baseline” changelog claim. **displayName kept.** |
| C-016 | authenticated-active | CORRECTED | ISO 2022 changelog no longer claims official control coverage. **displayName kept.** |
| C-017 | authenticated-active | CORRECTED | SOC 2 changelog no longer says Type II questionnaire pack. **displayName `SOC 2` kept.** |
| C-018 | authenticated-active | CORRECTED | HIPAA changelog no longer says Security Rule questionnaire pack. **displayName kept.** |
| C-019 | authenticated-active | CORRECTED | PCI changelog qualified as GuardEntra-authored labelled pack. **displayName kept.** |
| C-020 | authenticated-active | CORRECTED | CIS changelog qualified. **displayName kept.** |
| C-021 | authenticated-active | NEUTRAL_LABEL | Catalog names/domain descriptions identify packs. Custom row no longer says “standard framework pack.” |
| C-022 | authenticated-active | CORRECTED | Wizard copy now says “Select assessment packs” and keeps shipped dedup behavior. |
| C-023 | authenticated-active | KEEP_FEATURE | Unique-vs-source question counts are product arithmetic, not a certification. |
| C-023b | authenticated-active | CORRECTED | Wizard error no longer says “standard framework.” |
| C-024 | authenticated-active | KEEP_STAMPED | Invite email uses the assessment’s stored `frameworkName`. Historical snapshots not rewritten. |
| C-025 | authenticated-active | ESCALATED | Bank implementation comment / provenance. Owner/counsel must attest authorship. Questions unchanged. |
| C-026 | authenticated-active | KEEP_QUESTIONNAIRE | Vendor-facing question about *their* attestations. Content replacement not authorized. |
| C-027 | authenticated-active | KEEP_QUESTIONNAIRE | Vendor-facing HIPAA timing question. Unchanged. |
| C-028 | authenticated-active | KEEP_QUESTIONNAIRE | Vendor-facing SOC 2 report-maturity choices. Unchanged. |
| C-029 | authenticated-active | KEEP_QUESTIONNAIRE | Vendor-facing certification-choice labels (including FedRAMP/HITRUST as answers, not packs). Unchanged. |
| C-030 | authenticated-active | CORRECTED | Settings card no longer says “official templates.” Uses safe baseline. |
| C-031 | authenticated-active | KEEP_PROCESS | “Standards are never auto-downloaded” is a process fact consistent with pack publishing. |
| C-032 | authenticated-active | CORRECTED | Button now “AI suggest pack mapping” (suggest-only; not a publisher catalog map). |
| C-033 | authenticated-active | ESCALATED | `/api/ai/framework-map` still suggest-only. Gemini processing rights remain unknown — owner/counsel. |
| C-034 | authenticated-active | KEEP_PROCESS | Portal empty-snapshot copy asks the org to stamp a pack. Process, not a certification. |
| C-035 | authenticated-active | KEEP_FEATURE | Deduplicated source-question count is persisted product math. |
| C-036 | authenticated-active | CORRECTED | AI review prompt no longer analyzes “against” a framework as an official assessment. |
| C-037 | authenticated-active | KEEP_STAMPED | Tracker shows stored framework labels. Snapshots not rewritten. |
| C-038 | authenticated-active | KEEP_STAMPED | Decision-packet export includes stored `frameworksLabel`. Historical wording unchanged. |
| C-039 | authenticated-active | KEEP_FEATURE | Triage options describe the *customer’s* stated obligations, not GuardEntra certification. |
| C-040 | authenticated-active | KEEP_FEATURE | Fast-track recommends shipped pack IDs only. |
| C-041 | authenticated-active | CORRECTED | Audit Lab fallback list and selected-framework state use current shipped pack display names. Empty-compliance tenants cannot initialize, scan, or persist NYDFS Part 500. Existing tenant compliance names are still listed when present. |
| C-042 | authenticated-active | CORRECTED | AI prompt is a readiness reviewer, not a “strict regulatory auditor.” |
| C-043 | authenticated-active | CORRECTED | UI label is “Estimated coverage,” not control-coverage as a certification result. |
| C-044 | authenticated-active | CORRECTED | “Official Auditor Opinion” / “AI Auditor” replaced with readiness notes / estimate. |
| C-045 | authenticated-active | CORRECTED | Pricing SKU copy now says assessment pack(s). Still a plan cap, not a rights claim. |
| C-046 | authenticated-active | CORRECTED | Growth plan blurb now “assessment packs.” |
| C-047 | authenticated-active | CORRECTED | `/docs` copy uses GuardEntra-authored questionnaires and readiness estimates. |
| C-048 | authenticated-active | CORRECTED | Dashboard quick-start no longer implies framework certification tracking. |
| C-049 | authenticated-active | CORRECTED | UserGuide Draftsman no longer claims ISO/SOC 2 cross-reference. |
| C-050 | frozen | KEEP_GATED | `/compliance` default `COMPLIANCE=false`. Rights unknown. |
| C-051a | frozen | KEEP_GATED | Unpublished NYDFS library row. No shipped pack. |
| C-051b | frozen | KEEP_GATED | Unpublished NAIC library row. No shipped pack. |
| C-051c | frozen | KEEP_GATED | Unpublished ISO library row behind compliance flag. |
| C-051d | frozen | KEEP_GATED | Unpublished SOC 2 Type II library row behind compliance flag. |
| C-051e | frozen | KEEP_GATED | Unpublished Solvency II row. No shipped pack. |
| C-051f | frozen | KEEP_GATED | Unpublished NIST CSF library row behind compliance flag. |
| C-051g | frozen | KEEP_GATED | Unpublished GDPR library row. No shipped pack. |
| C-051h | frozen | KEEP_GATED | Unpublished DORA library row. No shipped pack. |
| C-051i | frozen | KEEP_GATED | Unpublished CCPA/CPRA library row. No shipped pack. |
| C-051j | frozen | KEEP_GATED | Unpublished ESG library row. No shipped pack. |
| C-052 | frozen | KEEP_GATED | Auto-mapping promise remains unpublished. Contradicts spine no-auto-download policy if enabled. |
| C-053 | legacy | KEEP_GATED | `/vendors/legacy` default `VENDORS_LEGACY=false`. Demo SOC 2 “Verified” artifact unpublished. |
| C-054 | frozen | KEEP_GATED | GovIntel `FRAMEWORK_MAP` unpublished (`GOV_INTEL=false`). |
| C-055 | frozen | KEEP_GATED | GovIntel scoring copy unpublished. |
| C-056 | frozen | KEEP_GATED | Trust Intelligence unpublished (`TRUST_INTELLIGENCE=false`). |
| C-057 | frozen | KEEP_GATED | Policy Draftsman unpublished (`POLICIES=false`). |
| C-057b | frozen | KEEP_GATED | Draftsman framework dropdown unpublished. |
| C-058 | frozen | KEEP_GATED | Contract Negotiator unpublished (`CONTRACT_AUDIT=false`). |
| C-058b | frozen | KEEP_GATED | Contract Negotiator ISO/GDPR UI unpublished. |
| C-059 | frozen | KEEP_GATED | Policies AI prompt unpublished. |
| C-060a | frozen | KEEP_GATED | Gmail audit demo unpublished (`GMAIL_AUDIT=false`). |
| C-060b | frozen | KEEP_GATED | Gmail HIPAA demo unpublished. |
| C-061 | authenticated-active | KEEP_FEATURE | Attachment hint “SOC reports, contracts” is evidence-type guidance, not a pack claim. |
| C-062 | authenticated-active | CORRECTED | New optional demo seeds no longer create NYDFS/NAIC “Compliant” rows. Existing tenant data not mutated. |
| C-063 | test-only | TEST_ONLY | Dev/test fixtures in `seedData.ts`; not production UI. Unchanged. |
| C-068 | test-only | TEST_ONLY | Pack version assertions; not user-visible product copy. |
| C-068b | test-only | TEST_ONLY | Exception fixture “SOC 2 CC6.1 evidence” is not a bank mapping. |
| C-068c | test-only | TEST_ONLY | Onboarding test still clicks pack displayName `ISO 27001:2022`; heading assertion updated. |
| C-069 | frozen | KEEP_GATED | AI Copilot default `AI_COPILOT=false`. |
| C-070 | frozen | KEEP_GATED | Copilot shortcut chips unpublished. |
| C-071 | frozen | KEEP_GATED | Copilot offline NAIC/SOC 2 fallback unpublished. |
| C-072 | frozen | KEEP_GATED | Copilot evidence fallbacks unpublished. |
| C-073 | frozen | KEEP_GATED | Copilot framework advisor (DORA/NIS2/EPA/etc.) unpublished. |
| C-074 | frozen | KEEP_GATED | Trust Vault unpublished (`TRUST_VAULT=false`). |
| C-075 | frozen | KEEP_GATED | “Verified Frameworks” public-preview copy unpublished. |
| C-076 | legacy | KEEP_GATED | ActivityFeed unwired in current app; ISO placeholder unpublished. |
| C-077 | frozen | KEEP_GATED | TrustScoreEngine fallback insights unpublished. |
| C-078 | frozen | KEEP_GATED | Audit Calendar unpublished (`AUDIT_CALENDAR=false`). |
| C-079 | authenticated-active | CORRECTED | Optional sample seed titles no longer claim NYDFS certification drift, NAIC alignment, or SOC 2 external audit. Existing tenant data not mutated. |
| C-080 | frozen | KEEP_GATED | SystemHealth seed titles unpublished (`HEALTH_LAB=false`). |
| C-081 | legacy | KEEP_GATED | Legacy vendor ISO “Verified” demo unpublished. |
| C-082 | legacy | KEEP_GATED | Legacy NAIC/NYDFS drift banner unpublished. |
| C-083 | legacy | KEEP_GATED | Legacy SOC 2 verification briefing unpublished. |
| C-084 | legacy | KEEP_GATED | Legacy NYDFS/NAIC AI prompts unpublished. |
| C-085 | frozen | KEEP_GATED | GovIntel demo recommended actions unpublished. |
| C-086 | frozen | KEEP_GATED | GovIntel default NIST 800-53/FedRAMP/CISA string unpublished. |
| C-087 | frozen | KEEP_GATED | EPA/DHS demo rebrand (`DemoContext` + GovIntel) unpublished. |
| C-088 | public-active | CORRECTED | Landing card no longer claims EPA civil penalties or Clean Water Act reporting. |
| C-089 | authenticated-active | CORRECTED | Active `/api/ai/generate` mock no longer initiates an “emergency SOC 2 control review.” |
| C-090 | frozen | KEEP_GATED | Gov-intel/grant mocks served only to frozen GovIntel. |
| C-091 | legacy | KEEP_GATED | Evidence-review mocks consumed by unpublished `VendorRisk.tsx`. |
| C-092 | frozen | KEEP_GATED | Gmail-analyze SDO-style demo IDs unpublished. |
| C-093 | authenticated-active | CORRECTED | Empty-snapshot recovery copy no longer tells users to pick a “standard framework.” |
| C-094 | legacy | KEEP_GATED | EvidenceSummaryCard imported by unpublished VendorRisk. |
| C-095 | legacy | KEEP_GATED | EvidenceFindingCard imported by unpublished VendorRisk. |
| C-096 | authenticated-active | KEEP_FEATURE | Pack-upgrade banner is factual version notice; stamped assessments stay pinned. |
| C-097 | authenticated-active | CORRECTED | Validator message no longer says “standard framework.” |

## Unchanged rows (non-gated)

These remain visible but were not rewritten as authority claims:

- **Neutral pack identifiers:** C-021 display names; C-013–C-020 `displayName` values (NIST CSF 2.0, ISO 27001:2022, SOC 2, HIPAA, PCI DSS 4.0, CIS Controls, and superseded labelled versions).
- **Product behavior:** C-023, C-031, C-034, C-035, C-039, C-040, C-061, C-096.
- **Stamped history:** C-024, C-037, C-038 — do not mutate stored assessments.
- **Question bank:** C-026–C-029 — owner approval required to replace content.
- **Escalations:** C-012 (ownership comment vs rights), C-025 (bank authorship), C-033 (Gemini mapping rights).

## Feature-gated / unpublished rows

All frozen and legacy rows above (`KEEP_GATED`, 46 rows) remain unpublished under default `src/lib/featureFlags.ts` values. They are **not** deleted. Enabling those flags without a later rights/wording pass would re-expose unsupported claims (NYDFS, NAIC, GDPR, DORA, NIST 800-53, FedRAMP, EPA, “Verified Frameworks,” demo SOC 2 attestations).

## Safety constraints honored

- No new publisher/standards catalog text was copied.
- Existing assessment snapshots were not rewritten.
- Question-bank items were not deleted or replaced.
- No legal conclusion or publisher-permission inference.
- No Firebase/rules/IAM/App Hosting change.
- Not deployed.

## Remaining owner/counsel blockers

1. Provenance attestation for the 54 `controlKey` texts (C-025–C-029).
2. Trademark/name-use basis for pack labels (NIST, ISO, SOC 2, HIPAA, PCI, CIS).
3. Gemini processing rights for `/api/ai/framework-map` and assessment review (C-033, C-036).
4. Whether frozen modules may be enabled before a further wording pass.
5. Whether optional sample-data seeds should be removed entirely rather than neutralized for new tenants.
