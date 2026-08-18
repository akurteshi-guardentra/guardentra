# Framework rights register (P0-F1)

Evidence register for provenance and rights **states** of shipped framework-labelled content. This document records repository-visible evidence only.

| Field | Value |
|---|---|
| GitHub issue | [#25 — Inventory framework questions, mappings, provenance, and rights status](https://github.com/akurteshi-guardentra/guardentra/issues/25) |
| Baseline SHA | `0f07657620d853cd9228ed58cf29b7d7e9960b73` (`main`) |
| Investigation date | 2026-08-18 |
| Companion doc | [`FRAMEWORK_INVENTORY.md`](./FRAMEWORK_INVENTORY.md) |

## Important limitations

- **This is not legal advice.** Developers and AI must not infer publisher permission or IP ownership from this register.
- **Git authorship is implementation provenance**, not proof of content ownership or commercial rights.
- **Missing evidence ⇒ `unknown`.** Code comments (e.g. "Guardentra-owned") and product copy alone do not elevate a rights state.
- **Off-repository records** (counsel memos, publisher contracts, Drive ledgers) are out of scope for this file unless the owner attaches them and updates this register through a PR.

---

## Allowed rights states

| State | Meaning in this register |
|---|---|
| `verified-owned` | Documented GuardEntra ownership attestation or equivalent counsel-approved record **in the approved evidence chain** |
| `public-source-derived` | Cited public source + documented derivation path in repo or linked owner record |
| `licensed` | Executed publisher/license agreement referenced with locator |
| `permission-pending` | Documented request to publisher/counsel; decision not recorded |
| `unknown` | Insufficient evidence to assign any other state |
| `restricted` | Documented restriction (counsel or contract) prohibiting stated use |

---

## Rights dimensions tracked

Each inventory item is evaluated across:

| Dimension | Question |
|---|---|
| **Commercial use** | Sold or bundled as a paid product feature? |
| **Storage** | Persisted where (Firestore, localStorage, exports)? |
| **Customer display** | Shown to org users, vendors, or public site visitors? |
| **Derivative works** | Reworded controls, pack diffs, AI-suggested mappings? |
| **Mappings** | Claimed or implied alignment to official control catalogs? |
| **AI/LLM processing** | Sent to third-party models (e.g. Gemini)? |
| **License start/expiry** | Known permission window |

At baseline SHA, **all dimensions for all shipped bank content are `unknown`** unless noted below.

---

## Rollup counts (baseline SHA)

| State | controlKeys (54) | pack metadata (8) | mapping subsystems (3) |
|---|---:|---:|---:|
| verified-owned | 0 | 0 | 0 |
| public-source-derived | 0 | 0 | 0 |
| licensed | 0 | 0 | 0 |
| permission-pending | 0 | 0 | 0 |
| restricted | 0 | 0 | 0 |
| **unknown** | **54** | **8** | **3** |

**Repository licensing artifacts:** no root `LICENSE`, `NOTICE`, or content-license field in `package.json` (`"private": true` only).

---

## Pack-level register

Uniform profile applies to all eight packs unless a row notes otherwise. Full inventory: [`FRAMEWORK_INVENTORY.md`](./FRAMEWORK_INVENTORY.md).

| packId | Author/source evidence | Wording class | Cited public/licensed source | Mapping provenance | Commercial use | Storage | Display | Derivative / mapping | AI/LLM | License dates | Rights state |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `nist_csf_2@1.1` | Git `db30a76` (Atdhe Kurteshi); header comment "Guardentra-owned" | Guardentra pack metadata + bank text | None in repo | `frameworks: ['nist_csf_2']` tags; excludes CSF 2.0-only keys; **no NIST CSF subcategory IDs** | Pricing: framework packs | `frameworkPackIds` on assessments; org pins | Settings, wizard, portal | Pack diff / rebaseline by `controlKey` | `/api/ai/framework-map` may receive Q text | `releasedAt` is product metadata only | **unknown** |
| `nist_csf_2@2.0` | same | same | None | Full `nist_csf_2` tag set | same | same | same | same | same | same | **unknown** |
| `iso27001@2013` | same | Changelog cites "Annex A baseline" conceptually | None | Excludes ISO 2022-only keys; **no Annex A IDs** | same | same | same | same | same | same | **unknown** |
| `iso27001@2022` | same | same | None | Full `iso27001` tag set | same | same | same | same | same | same | **unknown** |
| `soc2@current` | same | Changelog: "Guardentra SOC 2 Type II questionnaire pack" | None | **No AICPA TSC/CC IDs** | same | same | same | same | same | same | **unknown** |
| `hipaa@current` | same | Changelog: "Guardentra HIPAA Security Rule questionnaire pack" | None | **No 45 CFR citation IDs** | same | same | same | same | same | same | **unknown** |
| `pci_dss_4@4.0` | same | Changelog: "PCI DSS v4.0 questionnaire pack" | None | **No PCI requirement numbers** | same | same | same | same | same | same | **unknown** |
| `cis_controls@current` | same | Changelog: "CIS Controls questionnaire pack" | None | **No CIS Safeguard IDs** | same | same | same | same | same | same | **unknown** |

### Product copy affecting rights posture (not license records)

| Location | Text | Rights impact |
|---|---|---|
| `src/lib/vendor/frameworkPacks.ts` L1–3 | "Guardentra-owned framework pack library" | Repository/implementation comment only; **not** a rights elevation |
| `src/lib/vendor/frameworkPacks.ts` L55 | "Official packs." | Repository/implementation comment only; **not** licensing or publisher-approval evidence |
| `src/components/FrameworkPacksCard.tsx` | "Guardentra ships **official templates**" | Customer-facing display claim; **no publisher permission on file** |
| `src/components/FrameworkPacksCard.tsx` | "standards are never auto-downloaded into your tenant" | Process claim; consistent with `frameworkPacks.ts` header |
| `src/lib/vendor/constants.ts` | Onboarding: ISO "certification enterprise buyers ask for most often" | Marketing framing vs questionnaire-pack reality |

---

## Question bank register

### Uniform bank profile (54 items: 48 yes/no + 6 choice)

The shipped bank size is **54** `controlKey` rows (`48` yes/no + `6` single/multiple-choice). That `48` is the yes/no *type* count only; it is not the stale “48-question bank” figure in `docs/PRODUCT_ROADMAP_2026.md` (historical drift; current size is 54).

The table below is the uniform rights profile for all 54 rows. Fourteen keys have extra wording notes in § Distinct controlKeys; they remain **unknown** on every rights dimension.

| Field | Evidence |
|---|---|
| Author/source | Evolved in-repo: `c178137` → `57750d8` → `db30a76` (Atdhe Kurteshi; early commits co-authored with Cursor). Comment: "Real, framework-tagged control bank." **No external paste attribution.** |
| Wording class | **unknown** (likely GuardEntra-authored plain English; not verified) |
| Cited source | None |
| Mapping | Manual `frameworks[]` tags in `questionBank.ts`; cross-framework dedup by shared `controlKey` |
| Commercial use | Included in subscription SKUs listing framework packs (`Pricing.tsx`) |
| Storage | Snapshotted on `assessments.questions[]`; answers in `answers` / `submittedSnapshot`; optional `localStorage` mirror |
| Display | Vendor portal, assessment wizard preview, org review, decision-packet export |
| Derivative works | Pack version diffs; rebaseline copies answers by `controlKey` |
| AI/LLM | `Assessments.tsx` review sends Q&A strings to `/api/ai/generate`; `/api/ai/framework-map` sends control text on pack upgrade |
| License start/expiry | Unknown |
| **Rights state (all dimensions)** | **unknown** |

Bank version stamp: `QUESTION_BANK_VERSION = '2026.1'`.

---

### Distinct controlKeys (additional notes)

| controlKey | Extra wording / claim evidence | Mapping note | Rights state |
|---|---|---|---|
| `breach_notification_meets_hipaa_60_day_requirement` | References "HIPAA's 60-day reporting requirement" | HIPAA-only tag; no HHS/OCR source URL | **unknown** |
| `is_a_business_associate_agreement_baa_executed_before_handli` | BAA / PHI handling | HIPAA-only | **unknown** |
| `is_access_to_protected_health_information_limited_strictly_t` | "Minimum necessary" PHI access | HIPAA-only | **unknown** |
| `is_the_cardholder_data_environment_cde_formally_scoped_and_d` | CDE scoping (PCI terminology) | PCI-only | **unknown** |
| `is_cardholder_data_prohibited_from_storage_after_authorizati` | Post-auth cardholder data storage | PCI-only | **unknown** |
| `soc2_report_maturity` | Type I / Type II / No SOC 2 report choices | SOC2-only `single_choice` | **unknown** |
| `which_of_the_following_third_party_certifications_does_your_` | Choices: ISO 27001, SOC 2, PCI DSS, HIPAA/HITRUST, **FedRAMP** | FedRAMP is label-only — **no FedRAMP pack** | **unknown** |
| `is_security_posture_reported_to_executives_or_the_board_at_l` | CSF 2.0 Govern theme | `CSF_2_ONLY_KEYS`; not in `@1.1` pack | **unknown** |
| `is_there_a_defined_incident_severity_classification_and_esca` | Severity / escalation | CSF 2.0-only | **unknown** |
| `do_you_run_an_annual_disaster_recovery_tabletop_exercise_wit` | DR tabletop | CSF 2.0-only | **unknown** |
| `are_data_loss_prevention_dlp_controls_in_place_to_monitor_fo` | DLP monitoring | ISO 2022-only | **unknown** |
| `is_there_a_documented_crisis_communication_plan_for_extended` | Crisis comms plan | ISO 2022-only | **unknown** |
| `which_of_the_following_data_protection_controls_are_implemen` | Encryption, tokenization, DLP multi-choice | ISO 2022-only | **unknown** |
| `do_you_maintain_current_soc_2_iso_27001_or_equivalent_third_` | Names SOC 2 and ISO 27001 in question text | Multi-tag attestation question | **unknown** |

---

## Mapping and AI subsystems

| Subsystem | Path | Operational fact | Documented permission | Rights state |
|---|---|---|---|---|
| Rule-based framework tags | `questionBank.ts` `frameworks[]` | Manual in-file tags for dedup | `docs/PRODUCT_ROADMAP_2026.md`: rule-based tagging chosen over embedding | **unknown** |
| Pack diff / rebaseline | `frameworkPacks.ts` | Maps by `controlKey`; stamps `frameworkPackIds`, `questionBankVersion` | Architecture: never auto-upgrade sent assessments | **unknown** |
| AI pack-upgrade mapping | `server/routes/ai.ts` `POST /framework-map` | Sends `{controlKey, text}` to Gemini when API configured; heuristic fallback otherwise; **never auto-applies** | No publisher AI-processing consent on file | **unknown** |
| Assessment AI review | `Assessments.tsx` → `/api/ai/generate` | Sends framework-labelled Q&A context | No documented basis | **unknown** |
| Audit Lab AI scan | `AuditReadiness.tsx` | AI generates coverage % and "Official Auditor Opinion" from framework **name** | Persisted to `audit_readiness`; not bank-backed mapping | **unknown** |
| Mock regulatory tags | `server/routes/ai.ts` (Gmail/demo mocks) | Strings like `SOC 2 CC6.1`, `ISO 27001 A.12.6.1`, `NIST PR.AC-1`, `HIPAA §164.312` | **Not linked to bank**; frozen/demo paths | **unknown** |

**Firestore snapshot lock:** `firestore.rules` prevents org mutation of stamped `questions`, `frameworkPackIds`, `frameworks`, `questionBankVersion`, `versionLocked` on sent assessments (storage governance; does not resolve content rights).

---

## Customer-facing claim surfaces

Issue #25 records **existing** claims and a provenance/rights state. Issue #26 later decides wording changes. Rows are **not** deferred to #26.

Unless a row cites other repository evidence, the rights state is **`unknown`**. Git authorship and code comments are not IP or publisher permission.

Publication class uses default `featureFlags.ts` reachability at baseline SHA (`VITE_FEATURE_*` overrides are unverified).

| ID | Path | Class | Claim (concise) | Frameworks named | Rights state | Evidence / notes | Follow-up |
|---|---|---|---|---|---|---|---|
| C-001 | `index.html` L5–6 | public-active | “Enterprise GRC & Risk Intelligence”; “autonomous risk assessment” | (generic GRC) | unknown | Public HTML title/meta | #26 wording |
| C-002 | `metadata.json` L3 | unknown | “automated compliance workflows” | (generic) | unknown | App metadata; not a routed page | #26 wording |
| C-003a | `src/pages/Landing.tsx` L123–124 | public-active | Partner strip: `NYDFSPART500` | NYDFS Part 500 | unknown | Public `/`; no NYDFS pack | #26 wording |
| C-003b | `src/pages/Landing.tsx` L126–127 | public-active | Partner strip: `NAICCERT` | NAIC | unknown | Public `/`; no NAIC pack | #26 wording |
| C-003c | `src/pages/Landing.tsx` L128–129 | public-active | Partner strip: `LloydsREADY` | Lloyd’s | unknown | Same strip; no Lloyd’s pack | #26 wording |
| C-003d | `src/pages/Landing.tsx` L131–133 | public-active | Partner strip: `SOC2 TYPE II` | SOC 2 Type II | unknown | Public `/`; questionnaire pack is `soc2@current`, not an attestation | #26 wording |
| C-003e | `src/pages/Landing.tsx` L134–136 | public-active | Partner strip: `NIST SP 800-53` | NIST SP 800-53 | unknown | Public `/`; shipped pack is NIST **CSF**, not 800-53 | #26 wording |
| C-004 | `src/pages/Landing.tsx` L177–178 | public-active | “Automated Regulatory Mapping”: “Instantly map your entire control environment to NYDFS Part 500 and NAIC Data Security mandates.” | NYDFS Part 500, NAIC | unknown | Mapping-completeness claim; no matching packs | #26 wording |
| C-005 | `src/pages/Landing.tsx` L91–94 | public-active | “detect compliance gaps” | (generic) | unknown | TPRM marketing copy | #26 wording |
| C-007 | `src/pages/Onboarding.tsx` L296–300 | authenticated-active | Vendors “answer it once instead of repeating” across frameworks | (multi-framework) | unknown | Dedup/coverage claim | #26 wording |
| C-008 | `src/lib/vendor/constants.ts` L58–59; `Onboarding.tsx` | authenticated-active | ISO 27001:2022: “The certification enterprise buyers ask for most often in security reviews.” | ISO 27001 | unknown | Certification framing; pack is a questionnaire | #26 wording |
| C-009 | `src/lib/vendor/constants.ts` L63–64; `Onboarding.tsx` | authenticated-active | Label “SOC 2 Type II”; “Audited proof of how you handle security, availability and confidentiality over time.” | SOC 2 Type II | unknown | Attestation framing | #26 wording |
| C-010 | `src/lib/vendor/constants.ts` L68–69; `Onboarding.tsx` | authenticated-active | “NIST CSF 2.0”; “A practical control baseline.” | NIST CSF 2.0 | unknown | Baseline/label | #26 wording |
| C-011 | `src/lib/vendor/constants.ts` L73–74; `Onboarding.tsx` | authenticated-active | “HIPAA”; “Required if you or your vendors touch protected health information.” | HIPAA | unknown | Regulatory-obligation framing | #26 wording |
| C-012 | `src/lib/vendor/frameworkPacks.ts` L1–3 | authenticated-active | Code comment: “Guardentra-owned framework pack library” / no auto-download of SDO standards | all shipped packs | unknown | Implementation wording, not a license record | Owner/counsel |
| C-012b | `src/lib/vendor/frameworkPacks.ts` L55 | authenticated-active | Code comment: “Official packs.” | all shipped packs | unknown | Repository wording only; **not** publisher approval | Owner/counsel |
| C-013 | `src/lib/vendor/frameworkPacks.ts` L63–67 | authenticated-active | Display/changelog: “NIST CSF 1.1” / “Baseline CSF 1.1 control set” | NIST CSF 1.1 | unknown | Shown in Settings pack picker | #26 wording |
| C-014 | `src/lib/vendor/frameworkPacks.ts` L74–77 | authenticated-active | Display/changelog: “NIST CSF 2.0” / Govern-oriented additions | NIST CSF 2.0 | unknown | Current default pack label | #26 wording |
| C-015 | `src/lib/vendor/frameworkPacks.ts` L84–86 | authenticated-active | Display/changelog: “ISO 27001:2013” / “ISO/IEC 27001:2013 Annex A baseline” | ISO 27001:2013 | unknown | Conceptual Annex A; **no A.x IDs** | #26 wording |
| C-016 | `src/lib/vendor/frameworkPacks.ts` L94–96 | authenticated-active | Display/changelog: “ISO 27001:2022” / expanded data-protection coverage | ISO 27001:2022 | unknown | Coverage wording | #26 wording |
| C-017 | `src/lib/vendor/frameworkPacks.ts` L103–105 | authenticated-active | “Guardentra SOC 2 Type II questionnaire pack.” | SOC 2 Type II | unknown | Product names the pack Guardentra-authored; rights still unknown | Owner/counsel |
| C-018 | `src/lib/vendor/frameworkPacks.ts` L112–114 | authenticated-active | “Guardentra HIPAA Security Rule questionnaire pack.” | HIPAA | unknown | Same as C-017 | Owner/counsel |
| C-019 | `src/lib/vendor/frameworkPacks.ts` L121–123 | authenticated-active | “PCI DSS v4.0 questionnaire pack.” | PCI DSS 4.0 | unknown | Pack label | #26 wording |
| C-020 | `src/lib/vendor/frameworkPacks.ts` L130–132 | authenticated-active | “CIS Controls questionnaire pack.” | CIS Controls | unknown | Pack label | #26 wording |
| C-021 | `src/lib/vendor/constants.ts` L5–47; `AssessmentWizard.tsx` | authenticated-active | Catalog names/descriptions + per-framework question counts | NIST CSF, SOC 2, ISO 27001, HIPAA, PCI DSS 4.0, CIS Controls | unknown | Wizard tabs Recommended / Industry / All | #26 wording |
| C-022 | `src/pages/AssessmentWizard.tsx` L564–565 | authenticated-active | “Select frameworks. GuardEntra removes duplicate questions automatically.” | (multi-framework) | unknown | Dedup claim | #26 wording |
| C-023 | `src/pages/AssessmentWizard.tsx` L647–652 | authenticated-active | “Smart dedupe across frameworks” + unique vs source counts | selected frameworks | unknown | Coverage arithmetic | #26 wording |
| C-023b | `src/pages/AssessmentWizard.tsx` L189 | authenticated-active | “Pick at least one standard framework.” | (generic) | unknown | Implies catalog items are “standard” | #26 wording |
| C-024 | `src/pages/AssessmentWizard.tsx` L370 | authenticated-active | Invite email: “security assessment (${frameworkName})” | as selected | unknown | Stored as `frameworkName` / `frameworks[]` | #26 wording |
| C-025 | `src/lib/vendor/questionBank.ts` L31–36 | authenticated-active | Comment: “Real, framework-tagged control bank” / cross-framework dedup | all six families | unknown | Implementation comment; questions shown in portal | Owner/counsel |
| C-026 | `src/lib/vendor/questionBank.ts` L55 | authenticated-active | Portal Q: current SOC 2, ISO 27001, or equivalent attestations | SOC 2, ISO 27001 | unknown | Snapshotted question text | Owner/counsel |
| C-027 | `src/lib/vendor/questionBank.ts` L271 | authenticated-active | Portal Q: HIPAA 60-day reporting requirement | HIPAA | unknown | Regulatory timing named in question | Owner/counsel |
| C-028 | `src/lib/vendor/questionBank.ts` L341–344 | authenticated-active | Portal Q: SOC 2 report maturity (Type I/II) | SOC 2 | unknown | Attestation question | Owner/counsel |
| C-029 | `src/lib/vendor/questionBank.ts` L370 | authenticated-active | Portal Q choices: ISO 27001, SOC 2, PCI DSS, HIPAA/HITRUST, FedRAMP | ISO, SOC 2, PCI, HIPAA/HITRUST, FedRAMP | unknown | FedRAMP/HITRUST are choice labels only; no packs | Owner/counsel |
| C-030 | `src/components/FrameworkPacksCard.tsx` L136–137 | authenticated-active | “Guardentra ships official templates.” | all managed packs | unknown | Settings `/settings`; no publisher permission on file | #26 wording |
| C-031 | `src/components/FrameworkPacksCard.tsx` L248–249 | authenticated-active | “standards are never auto-downloaded into your tenant.” | (process) | unknown | Process/rights posture copy | #26 wording |
| C-032 | `src/components/FrameworkPacksCard.tsx` L185 | authenticated-active | Button: “AI suggest mapping” | pack versions | unknown | UI to `/api/ai/framework-map` | #26 + AI rights |
| C-033 | `server/routes/ai.ts` L287–351 | authenticated-active | Maps controls between pack versions; Gemini when configured, else heuristic | pack ids | unknown | Suggest-only; never auto-applies | AI processing rights |
| C-034 | `src/pages/VendorPortal.tsx` L677–679 | authenticated-active | Empty snapshot: recreate so “framework pack is stamped correctly” | (pack) | unknown | Portal process copy | #26 wording |
| C-035 | `src/pages/VendorPortal.tsx` L732–735 | authenticated-active | “deduplicated from N source questions” | (implicit multi-fw) | unknown | Uses persisted `sourceQuestionCount` | #26 wording |
| C-036 | `src/pages/Assessments.tsx` L276 | authenticated-active | AI review analyzes vendor “against” framework label | stamped names | unknown | Sends Q&A to `/api/ai/generate` | AI processing rights |
| C-037 | `src/components/assessments/AssessmentTrackerTable.tsx` L243 | authenticated-active | Row shows framework label | stamped | unknown | Label display | #26 wording |
| C-038 | `src/lib/vendor/reportExport.ts` L218 | authenticated-active | Decision packet includes `frameworksLabel` | stamped | unknown | Export | #26 wording |
| C-039 | `src/lib/vendor/fastTrackTriage.ts` L103–107 | authenticated-active | Obligation options: customers expect SOC 2; buyers expect ISO 27001; HIPAA; PCI DSS | SOC 2, ISO 27001, HIPAA, PCI DSS | unknown | `/assessments/triage` | #26 wording |
| C-040 | `src/lib/vendor/fastTrackTriage.ts` L131–141 | authenticated-active | Tier `baseFrameworks`: soc2 / nist+soc2 / nist+soc2+iso | NIST CSF, SOC 2, ISO 27001 | unknown | Recommended packs | #26 wording |
| C-041 | `src/pages/AuditReadiness.tsx` L81–86 | authenticated-active | `FALLBACK_FRAMEWORKS`: NYDFS Part 500, SOC 2 Type II, ISO/IEC 27001:2022, NIST CSF 2.0, GDPR (Article 32) | NYDFS, SOC 2, ISO, NIST CSF, GDPR | unknown | Active Audit Lab; NYDFS/GDPR have no packs | #26 wording |
| C-042 | `src/pages/AuditReadiness.tsx` L325–346 | authenticated-active | AI prompt: “strict regulatory auditor” + coverage for selected framework name | user-selected | unknown | Not bank-mapped | #26 wording |
| C-043 | `src/pages/AuditReadiness.tsx` L641–647 | authenticated-active | UI: “Control Coverage” percentage | scanned framework | unknown | Persisted `audit_readiness` | #26 wording |
| C-044 | `src/pages/AuditReadiness.tsx` L671–672 | authenticated-active | Heading: “Official Auditor Opinion” | scanned framework | unknown | AI-generated; not a human auditor | #26 wording |
| C-045 | `src/pages/Pricing.tsx` L22, L39 | authenticated-active | Starter: “Audit Lab (1 framework pack)”; Growth: “Multi-framework packs + bulk CSV” | (pack SKU) | unknown | `/pricing` | #26 wording |
| C-046 | `src/lib/plans.ts` L30 | authenticated-active | Growth: “More vendors, more frameworks, more seats.” | (generic) | unknown | Plan copy | #26 wording |
| C-047 | `src/pages/Documentation.tsx` L25, L31, L37 | authenticated-active | “Build framework questionnaires”; “Framework readiness scores”; “framework pack version defaults” | (generic) | unknown | `/docs` | #26 wording |
| C-048 | `src/pages/Dashboard.tsx` L166, L196 | authenticated-active | “framework questionnaire”; “Track framework readiness and evidence gaps.” | (generic) | unknown | `/dashboard` | #26 wording |
| C-049 | `src/components/UserGuide.tsx` L46 | authenticated-active | Draftsman “cross-references your real-world risks with ISO 27001 or SOC2” | ISO 27001, SOC 2 | unknown | Modal on Layout; Policies/Draftsman **frozen** | #26 wording |
| C-050 | `src/pages/Compliance.tsx` L167–168 | frozen | “Continuous Compliance”; “AI-driven framework mapping and audit readiness logic.” | (generic) | unknown | `/compliance` default `COMPLIANCE=false` | Keep frozen or #26 |
| C-051a | `src/pages/Compliance.tsx` L26 | frozen | Library: NYDFS Part 500 | NYDFS Part 500 | unknown | `PREBUILT_FRAMEWORKS`; no pack | Keep frozen or #26 |
| C-051b | `src/pages/Compliance.tsx` L27 | frozen | Library: NAIC Model Law 668 | NAIC | unknown | No pack | Keep frozen or #26 |
| C-051c | `src/pages/Compliance.tsx` L28 | frozen | Library: ISO/IEC 27001:2022 | ISO 27001 | unknown | Optional `frameworkId: iso27001` | Keep frozen or #26 |
| C-051d | `src/pages/Compliance.tsx` L29 | frozen | Library: SOC 2 Type II | SOC 2 | unknown | Optional `frameworkId: soc2` | Keep frozen or #26 |
| C-051e | `src/pages/Compliance.tsx` L30 | frozen | Library: Solvency II (Security) | Solvency II | unknown | No pack | Keep frozen or #26 |
| C-051f | `src/pages/Compliance.tsx` L31 | frozen | Library: NIST CSF 2.0 | NIST CSF 2.0 | unknown | Optional `frameworkId: nist_csf_2` | Keep frozen or #26 |
| C-051g | `src/pages/Compliance.tsx` L32 | frozen | Library: GDPR (Article 32) | GDPR | unknown | No pack | Keep frozen or #26 |
| C-051h | `src/pages/Compliance.tsx` L33 | frozen | Library: DORA | DORA | unknown | No pack | Keep frozen or #26 |
| C-051i | `src/pages/Compliance.tsx` L34 | frozen | Library: CCPA / CPRA | CCPA/CPRA | unknown | No pack | Keep frozen or #26 |
| C-051j | `src/pages/Compliance.tsx` L35 | frozen | Library: ESG Scorecard | ESG | unknown | No pack | Keep frozen or #26 |
| C-052 | `src/pages/Compliance.tsx` L197 | frozen | “Select a framework to automatically build control mappings and questionnaires.” | selected library item | unknown | Contradicts no-auto-download spine policy | Keep frozen or #26 |
| C-053 | `src/pages/VendorRisk.tsx` L137–140 | legacy | Demo evidence: “SOC 2 Type II Security & Confidentiality Attestation Report” status Verified | SOC 2 Type II | unknown | `/vendors/legacy` frozen by default | Keep legacy or #26 |
| C-054 | `src/pages/GovIntelSuite.tsx` L178–186 | frozen | `FRAMEWORK_MAP`: NIST CSF, NIST 800-53, ISO 27001, SOC 2 Type II, CISA SCRM, FedRAMP, GDPR, EPA | many | unknown | Demo matrix; Annex A-style *area names* are UI labels, not bank mappings | Keep frozen or #26 |
| C-055 | `src/pages/GovIntelSuite.tsx` L1023 | frozen | “Weights SOC 2 coverage, FedRAMP status, NIST alignment…” | SOC 2, FedRAMP, NIST | unknown | Scoring copy | Keep frozen or #26 |
| C-056 | `src/components/TrustScoreBreakdown.tsx` L32 | frozen | “Framework assessment progress (ISO 27001, SOC 2)” | ISO 27001, SOC 2 | unknown | Trust Intelligence frozen | Keep frozen or #26 |
| C-057 | `src/pages/PolicyDraftsman.tsx` L151 | frozen | “mapping your risk landscape to global frameworks.” | (generic) | unknown | `/policies/draftsman` frozen | Keep frozen or #26 |
| C-057b | `src/pages/PolicyDraftsman.tsx` L187–191 | frozen | Dropdown: ISO 27001:2022, SOC 2 Type II, NIST CSF 2.0, HIPAA/HITECH, GDPR Privacy | ISO, SOC 2, NIST CSF, HIPAA, GDPR | unknown | Frozen module | Keep frozen or #26 |
| C-058 | `src/pages/ContractNegotiator.tsx` L46 | frozen | Prompt: compare clauses to “ISO 27001/GDPR” | ISO 27001, GDPR | unknown | Frozen | Keep frozen or #26 |
| C-058b | `src/pages/ContractNegotiator.tsx` L208 | frozen | UI: “Cross-referencing with ISO 27001:2022 & GDPR” | ISO 27001, GDPR | unknown | Frozen | Keep frozen or #26 |
| C-059 | `src/pages/Policies.tsx` L102 | frozen | AI prompt: follow “ISO 27001 or SOC 2” | ISO 27001, SOC 2 | unknown | Frozen | Keep frozen or #26 |
| C-060a | `src/pages/GmailAudit.tsx` L234 | frozen | Demo snippet: “annual SOC 2 compliance verification” | SOC 2 | unknown | Frozen demo mail | Keep frozen or #26 |
| C-060b | `src/pages/GmailAudit.tsx` L245–248 | frozen | Demo snippet: HIPAA DPA / “HIPAA §164.312” | HIPAA | unknown | Frozen demo mail; § citation is demo text, not bank mapping | Keep frozen or #26 |
| C-061 | `src/pages/ImpactAssessment.tsx` L443 | authenticated-active | Attachment hint: “SOC reports, contracts” | SOC 2 (colloquial) | unknown | Evidence-type hint, not a pack claim | #26 wording |
| C-062 | `src/lib/seeding.ts` L135–138 | authenticated-active | Optional demo seed: NYDFS/NAIC/ISO 27001:2022 “Compliant”; SOC 2 Type II | NYDFS, NAIC, ISO, SOC 2 | unknown | Only if onboarding sample-data checkbox | Tenant seed audit |
| C-063 | `src/lib/seedData.ts` L39–45 | test-only | Seed fixtures: ISO 27001, SOC 2 Type II, HIPAA statuses | ISO, SOC 2, HIPAA | unknown | Dev/test seed | Test-only |
| C-068 | `src/tests/frameworkPacks.test.ts` L15 | test-only | “ships side-by-side NIST and ISO versions” | NIST, ISO | unknown | Vitest assertion | Test-only |
| C-068b | `src/tests/vendorAssessmentLifecycle.test.ts` L313 | test-only | Exception reason string: “SOC 2 CC6.1 evidence” | SOC 2 CC6.1 | unknown | **Not** a bank mapping; test fixture only | Test-only |
| C-068c | `src/tests/Onboarding.test.tsx` L35–36 | test-only | Clicks on-screen “ISO 27001:2022” | ISO 27001:2022 | unknown | Tests production onboarding copy | Test-only |

**Row counts:** **83** claim rows. Publication class: public-active **8**, authenticated-active **47**, frozen **22**, legacy **1**, test-only **4**, unknown **1** (`metadata.json`). Issue #26 is follow-up for wording only; every row’s rights state is **`unknown`** until owner/counsel evidence is attached.

**Pack/bank vs claims:** Shipped questionnaire content remains 8 packs / 54 `controlKey`s (see inventory). Claims that name NYDFS, NAIC, GDPR, DORA, NIST 800-53, FedRAMP, Solvency II, CCPA, ESG, Lloyd’s, or HITRUST are **labels/surfaces**, not shipped packs.

---

## Unresolved provenance / rights questions

Owner, publisher, or counsel must answer — **do not infer in code or docs**:

1. Were the 54 question texts **original**, adapted from internal templates, copied from a licensed vendor questionnaire, or AI-generated? No repository record.
2. Is thematic alignment to ISO / NIST / PCI / HIPAA / CIS **sufficient** for current commercial display, or is explicit publisher permission required?
3. May framework **trademarks and names** appear in UI, pricing, onboarding, and answer choices (including HITRUST, FedRAMP)?
4. What is the rights basis for sending question text to **Google Gemini** via `/api/ai/framework-map` and assessment review routes?
5. Does "official templates" imply **SDO endorsement**? No disclaimer text exists today.
6. Are **`releasedAt` pack dates** product versioning only, or intended as license terms?
7. Is **client-side bundling** of the full bank in the SPA acceptable for display/storage rights?
8. Does **off-repo** evidence exist that should be linked to this register?

---

## Recommended owner follow-up

| Priority | Action | Target issue |
|---|---|---|
| P0 | Owner attestation ledger (author, method, date) per `controlKey` / `packId` | #25 follow-on PR or external legal tracker |
| P0 | Counsel review of framework **names** and "official" language | #26 |
| P1 | Add repo **NOTICE** for framework trademarks + non-affiliation disclaimer | #26 docs PR |
| P1 | AI data-flow register for Gemini routes | Security/compliance docs |
| P1 | Decide mapping strategy: OSCAL vs lightweight `controlRef` | #29+ |
| P2 | Bank metadata schema: `sourceType`, `sourceLocator`, `rightsState`, `reviewedAt` | #27 |
| P2 | Freeze **new** framework wording until #26 gates pass | Process |

---

## How to update this register

1. Owner or counsel provides a decision record (not inferred by engineering).
2. Open a PR updating the relevant row(s) with: decision date, approver, evidence locator, new rights state.
3. Do **not** set `verified-owned` or `licensed` without an attached evidence locator approved by the owner.
4. After material transitions, update `docs/agent-ops/PROJECT_STATE.md` via separate documentation PR.

---

## Related issues

| Issue | Relationship |
|---|---|
| #25 | Source investigation |
| #26 | Safe product wording (blocked until this register merges) |
| #27 | Server-side rights registry + publication gates |
| #32 | Licensed publisher adapters |
