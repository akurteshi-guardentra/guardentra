# Framework inventory (P0-F1)

Evidence-backed inventory of shipped framework-labelled questionnaire content, pack versions, mapping mechanics, and runtime usage.

| Field | Value |
|---|---|
| GitHub issue | [#25 — Inventory framework questions, mappings, provenance, and rights status](https://github.com/akurteshi-guardentra/guardentra/issues/25) |
| Baseline SHA | `0f07657620d853cd9228ed58cf29b7d7e9960b73` (`main`) |
| Investigation date | 2026-08-18 |
| Companion doc | [`FRAMEWORK_RIGHTS_REGISTER.md`](./FRAMEWORK_RIGHTS_REGISTER.md) |
| Claims register | Issue #26 (blocked until this inventory is merged) |
| Completeness correction | Codex REQUEST CHANGES on `2033cf72` (83→107) then again on `57f94a05ab3f6a4daeb47f0f32252ffd33ee4cfa` (107 not exhaustive). Claim rows and the search-disposition appendix below record pass 3. |

This document inventories **what exists in the repository and product spine**. It does not establish legal ownership, publisher permission, or compliance outcomes. Git authorship is implementation provenance only. It inventories wording only; it does **not** rewrite, hide, or feature-gate product copy (Issue #26).

---

## Scope

**In scope**

- In-repo question bank and framework packs used by the Vendor TPRM spine
- Pack versioning, org pins, assessment stamps, and rebaseline mechanics
- Active, frozen, legacy, test, and public publication paths that reference framework labels

**Out of scope**

- Licensed publisher adapter ingestion (Issue #32)
- OSCAL engine / rights registry implementation (Issues #27–#31)
- Customer-facing claim rewrites (Issue #26)
- Off-repository counsel records, contracts, or Drive artifacts

---

## Claim-surface search methodology (completeness)

A third, repository-wide pass was run after independent review found omitted **component** surfaces (`AssessmentReviewPanel.tsx`, `EvidenceSummaryCard.tsx`) that are imported by already-inventoried pages. The 107-row register was arithmetically correct but still not exhaustive under this rule. The pass is repeatable; **§ Search disposition** records that candidates were reviewed rather than dropped silently.

**Search roots (in scope):** `src/`, `server/`, `index.html`, `metadata.json`.  
**Search roots (out of scope / not claim rows):** `.claude/worktrees/**`, `copilot-worktrees/**`, `node_modules/**`, `dist/**`, `docs/agent-ops/**`, internal architecture/roadmap docs that are not product UI.

**Required extra check:** reusable components imported by inventoried active/legacy/frozen pages (assessment, evidence, compliance, framework, audit, review, trust, scoring, recommendation). Display copy in those components is in scope even when the *page* already has rows.

**Primary name patterns (minimum):**  
`NIST`, `NIST CSF`, `SOC 2`, `SOC2`, `ISO 27001`, `ISO27001`, `ISO 14001`, `PCI`, `PCI DSS`, `CIS`, `HIPAA`, `GDPR`, `DORA`, `NIS2`, `NAIC`, `EPA`, `CISA`, `FedRAMP`, `NYDFS`, `HITRUST`.

**Secondary authority-like patterns (judged, not auto-included):**  
`framework`, `certified`, `certification`, `verified`, `official`, `compliant`, `compliance`, `required`, `requirement`, `regulation`, `regulatory`, `standard`, `attestation`, `audit`.

### Inclusion rule

Include a claim row when **all** of the following are true:

1. The string is (or would be, if the hosting feature flag were enabled) shown to a public visitor, authenticated org user, vendor, or API client — **or** it is mock/fallback/seed text that those surfaces would display.
2. It names a framework, regulation, certification, auditor/attestation product, or publisher **or** it uses authority-like wording *about* those names (for example “Verified Frameworks”, “99% Required”, “official auditor”, “share their SOC 2 certificate”).
3. Frozen, legacy, demo/mock, fallback, unwired-but-present, and test-only copies are **included and classified**, not dropped. “Frozen” and “mock” are not synonyms for irrelevant.

Related strings on the **same UI/API block** may share one row. Split rows when the claim *type* differs (chat fallback vs scored recommendation vs public heading).

### Exclusion rule

Exclude (do **not** add a claim row) when the hit is:

| Class of hit | Examples |
|---|---|
| Programming / types | TypeScript `Required<>`; `FrameworkId` / `packId` identifiers without display copy |
| Generic portal attestations | VendorPortal accuracy/authority checkboxes that do **not** name an SDO |
| Generic questionnaire English | “training is required annually” with no named framework |
| Echo-only tests | Fixtures that only repeat an already-inventoried production label (`frameworkName: 'SOC 2'`) without a new SDO ID or authority claim — including `localAssessmentStore.test.ts`, `fastTrackPhase2Gate.test.ts`, `questionBank.test.ts` (`['ISO 27001']`), `useOrgAssessments.test.ts` |
| Internal non-UI docs | `docs/agent-ops/**`, architecture/roadmap notes |
| Isolated worktrees | `.claude/worktrees/**` |
| Non-displayed legal/engineering comments | e.g. `server/lib/audit/retention.ts` “until legal confirms SOC 2 / DPA wording” |

Rights state for included rows remains **`unknown`**. No publisher authorization or ownership is inferred.

**Claim count** is maintained in [`FRAMEWORK_RIGHTS_REGISTER.md`](./FRAMEWORK_RIGHTS_REGISTER.md). Pack/bank counts below are unchanged: **54** `controlKey`s, **8** packs, **3** mapping subsystems.

### Search disposition (pass 3)

Re-run at rejected head `57f94a05`. Candidates are **paths/surfaces**, not raw grep lines. Every in-scope path with a primary-name hit, or with component-level authority-like **display** copy, is listed. Disposition is one of: existing claim ID(s), new claim ID, or exclusion-rule reason.

**INCLUDED — already in the register (no new row)**

| Path / surface | Disposition |
|---|---|
| `index.html` | C-001 |
| `metadata.json` | C-002 |
| `src/pages/Landing.tsx` | C-003a–e, C-004, C-005, C-088 |
| `src/pages/Onboarding.tsx` / `src/lib/vendor/constants.ts` (catalog + onboarding copy, incl. custom “standard framework pack” L45) | C-007–C-011, C-021 |
| `src/lib/vendor/frameworkPacks.ts` | C-012–C-020 |
| `src/pages/AssessmentWizard.tsx` | C-022–C-024, C-023b |
| `src/lib/vendor/questionBank.ts` | C-025–C-029 |
| `src/components/FrameworkPacksCard.tsx` | C-030–C-032 |
| `server/routes/ai.ts` `POST /framework-map` | C-033 |
| `src/pages/VendorPortal.tsx` | C-034–C-035 |
| `src/pages/Assessments.tsx` AI-against-framework prompt | C-036 |
| `src/components/assessments/AssessmentTrackerTable.tsx` | C-037 |
| `src/lib/vendor/reportExport.ts` | C-038 |
| `src/lib/vendor/fastTrackTriage.ts` | C-039–C-040 |
| `src/pages/AuditReadiness.tsx` | C-041–C-044 |
| `src/pages/Pricing.tsx` / `src/lib/plans.ts` | C-045–C-046 |
| `src/pages/Documentation.tsx` | C-047 |
| `src/pages/Dashboard.tsx` | C-048 |
| `src/components/UserGuide.tsx` | C-049 |
| `src/pages/Compliance.tsx` | C-050–C-052 |
| `src/pages/VendorRisk.tsx` (page-level copy) | C-053, C-081–C-084 |
| `src/pages/GovIntelSuite.tsx` | C-054–C-055, C-085–C-087 |
| `src/components/TrustScoreBreakdown.tsx` | C-056 |
| `src/pages/PolicyDraftsman.tsx` | C-057, C-057b |
| `src/pages/ContractNegotiator.tsx` | C-058, C-058b |
| `src/pages/Policies.tsx` | C-059 |
| `src/pages/GmailAudit.tsx` | C-060a–b |
| `src/pages/ImpactAssessment.tsx` | C-061 |
| `src/lib/seeding.ts` | C-062, C-079 |
| `src/lib/seedData.ts` | C-063, C-080 |
| `src/tests/frameworkPacks.test.ts` / `vendorAssessmentLifecycle.test.ts` / `Onboarding.test.tsx` | C-068, C-068b, C-068c |
| `src/components/AICopilotPanel.tsx` | C-069–C-073 |
| `src/pages/TrustVault.tsx` | C-074–C-075 |
| `src/components/ActivityFeed.tsx` | C-076 |
| `src/lib/TrustScoreEngine.ts` | C-077 |
| `src/pages/AuditCalendar.tsx` | C-078 |
| `server/routes/ai.ts` generate / gov-intel / evidence / gmail mocks | C-089–C-092 |

**INCLUDED — new rows this pass**

| Path / surface | New ID | Why it qualifies |
|---|---|---|
| `src/components/assessments/AssessmentReviewPanel.tsx` (rendered by `Assessments.tsx`); recovery error in `emptyAssessmentRecovery.ts`; parent empty-snapshot strings in `Assessments.tsx` L256/L465 | **C-093** | User-facing “stamped or current framework packs”, “Rebuild from framework packs”, “standard framework” |
| `src/components/EvidenceSummaryCard.tsx` (imported by `VendorRisk.tsx`) | **C-094** | “Document meets … framework criteria”; “crucial certifications missing” |
| `src/components/EvidenceFindingCard.tsx` (imported by `VendorRisk.tsx`) | **C-095** | “mapped to specific GRC framework sections” |
| `src/pages/Assessments.tsx` L563 pack-upgrade banner | **C-096** | “Newer framework pack(s) available” (distinct from empty-snapshot copy) |
| `src/lib/vendor/validators.ts` L45 (surfaced by `AssessmentWizard.tsx`) | **C-097** | “select at least one standard framework” (distinct string from C-023b) |

**EXCLUDED — reviewed, not a claim row**

| Path / surface | Exclusion-rule reason |
|---|---|
| `src/lib/vendor/types.ts` `FrameworkId` / packId identifiers | Programming / types; no display copy |
| VendorPortal accuracy/authority checkboxes | Generic portal attestations; no SDO named |
| Questionnaire “required annually” bank wording without a named extra SDO | Generic questionnaire English (named SOC 2/HIPAA/ISO already C-026–C-029) |
| `src/tests/localAssessmentStore.test.ts`, `fastTrackPhase2Gate.test.ts`, `questionBank.test.ts`, `useOrgAssessments.test.ts`, `emptyAssessmentRecovery.test.ts` | Echo-only tests of already-inventoried labels/errors |
| `src/components/EvidenceGapCard.tsx` | Generic attestation / “verified GRC trust score” copy; no named framework, certification product, or SDO |
| `src/components/RemediationEngine.tsx` | Generic “verified compliant” / “compliance attestations”; no named framework |
| `src/components/EvidenceRecommendationCard.tsx` | No framework/authority-like display copy |
| `src/pages/LiveAssistant.tsx` Gemini tool-schema descriptions | Not rendered in UI; AI tool contract sent to the model |
| `src/pages/Connectors.tsx` comment about bumping framework progress | Non-displayed engineering comment |
| `server/lib/audit/retention.ts` SOC 2 / DPA comment | Non-displayed legal/engineering comment |
| `.claude/worktrees/**` | Isolated worktrees |
| TypeScript `Required<>` | Programming / types |

Rights state for included rows remains **`unknown`**. No publisher authorization or ownership is inferred.

---

## Global identifiers

| Identifier | Value | Path |
|---|---|---|
| `QUESTION_BANK_VERSION` | `2026.1` | `src/lib/vendor/questionBank.ts` |
| `FrameworkId` union | `nist_csf_2`, `soc2`, `iso27001`, `hipaa`, `pci_dss_4`, `cis_controls`, `custom` | `src/lib/vendor/types.ts` |
| Durable question ID | `controlKey` (slug; stable across pack versions) | `src/lib/vendor/questionBank.ts` |
| Ephemeral portal ID | `q_1` … `q_n` (rebuilt on rebaseline) | `src/lib/vendor/questionBank.ts` |
| Version delta keys (CSF 2.0) | 3 keys in `CSF_2_ONLY_KEYS` | `src/lib/vendor/frameworkPacks.ts` |
| Version delta keys (ISO 2022) | 3 keys in `ISO_2022_ONLY_KEYS` | `src/lib/vendor/frameworkPacks.ts` |

**CSF 2.0-only keys** (excluded from `nist_csf_2@1.1`):

- `is_security_posture_reported_to_executives_or_the_board_at_l`
- `is_there_a_defined_incident_severity_classification_and_esca`
- `do_you_run_an_annual_disaster_recovery_tabletop_exercise_wit`

**ISO 2022-only keys** (excluded from `iso27001@2013`):

- `are_data_loss_prevention_dlp_controls_in_place_to_monitor_fo`
- `is_there_a_documented_crisis_communication_plan_for_extended`
- `which_of_the_following_data_protection_controls_are_implemen`

---

## Shipped framework packs (8)

Side-by-side versions are separate `packId` values — never renamed in place.

| packId | frameworkId | displayName | version | status | tagged Q count* | source path |
|---|---|---|---|---|---:|---|
| `nist_csf_2@2.0` | `nist_csf_2` | NIST CSF 2.0 | 2.0 | **current** | 25 | `src/lib/vendor/frameworkPacks.ts` |
| `nist_csf_2@1.1` | `nist_csf_2` | NIST CSF 1.1 | 1.1 | superseded | 22 | same |
| `iso27001@2022` | `iso27001` | ISO 27001:2022 | 2022 | **current** | 40 | same |
| `iso27001@2013` | `iso27001` | ISO 27001:2013 | 2013 | superseded | 37 | same |
| `soc2@current` | `soc2` | SOC 2 | current | **current** | 28 | same |
| `hipaa@current` | `hipaa` | HIPAA | current | **current** | 21 | same |
| `pci_dss_4@4.0` | `pci_dss_4` | PCI DSS 4.0 | 4.0 | **current** | 27 | same |
| `cis_controls@current` | `cis_controls` | CIS Controls | current | **current** | 28 | same |

\*Per-framework **tag** counts from the bank. Multi-framework wizard selections dedupe by `controlKey`, so unique question counts are lower than the sum of tag counts.

**Current default pack per family** (when org has no pin): the row with `status: current` for that `frameworkId`.

**Stub:** `custom` (`FrameworkId`) — `questionCount: 0`; not available for solo use (`src/lib/vendor/constants.ts`).

---

## Per-framework tag counts (bank)

| frameworkId | UI label | tagged questions | current packId |
|---|---|---:|---|
| `nist_csf_2` | NIST CSF 2.0 | 25 | `nist_csf_2@2.0` |
| `soc2` | SOC 2 | 28 | `soc2@current` |
| `iso27001` | ISO 27001 | 40 | `iso27001@2022` |
| `hipaa` | HIPAA | 21 | `hipaa@current` |
| `pci_dss_4` | PCI DSS 4.0 | 27 | `pci_dss_4@4.0` |
| `cis_controls` | CIS Controls | 28 | `cis_controls@current` |

**Unique bank items:** **54** `controlKey` rows in `src/lib/vendor/questionBank.ts`.

---

## Question bank — all controlKeys

Source: `src/lib/vendor/questionBank.ts` (lines 38–394). Wording is plain-English questionnaire text; **no official SDO control IDs** (no SOC2 TSC/CC, ISO Annex A, NIST CSF subcategories, CIS Safeguard numbers, PCI requirement numbers).

| # | controlKey | category | type | framework tags |
|---:|---|---|---|---|
| 1 | `do_you_maintain_a_documented_information_security_policy_rev` | Company Profile | yesno | nist_csf_2, soc2, iso27001, hipaa, pci_dss_4, cis_controls |
| 2 | `is_there_a_designated_security_owner_accountable_for_vendor_` | Company Profile | yesno | nist_csf_2, soc2, iso27001, pci_dss_4, cis_controls |
| 3 | `do_you_maintain_current_soc_2_iso_27001_or_equivalent_third_` | Company Profile | yesno | nist_csf_2, soc2, iso27001 |
| 4 | `do_you_maintain_a_formal_inventory_of_hardware_and_software_` | Company Profile | yesno | nist_csf_2, iso27001, pci_dss_4, cis_controls |
| 5 | `do_you_maintain_a_data_classification_policy_distinguishing_` | Company Profile | yesno | iso27001, hipaa, pci_dss_4 |
| 6 | `is_security_awareness_training_required_annually_for_all_emp` | Company Profile | yesno | nist_csf_2, soc2, iso27001, hipaa, pci_dss_4, cis_controls |
| 7 | `are_background_checks_performed_for_employees_with_access_to` | Company Profile | yesno | soc2, iso27001, hipaa |
| 8 | `does_a_formal_onboarding_offboarding_process_revoke_system_a` | Company Profile | yesno | soc2, iso27001, cis_controls |
| 9 | `do_you_perform_an_annual_enterprise_risk_assessment_covering` | Company Profile | yesno | nist_csf_2, iso27001, hipaa |
| 10 | `is_security_posture_reported_to_executives_or_the_board_at_l` | Company Profile | yesno | nist_csf_2, soc2 |
| 11 | `is_a_business_associate_agreement_baa_executed_before_handli` | Company Profile | yesno | hipaa |
| 12 | `is_the_cardholder_data_environment_cde_formally_scoped_and_d` | Company Profile | yesno | pci_dss_4 |
| 13 | `is_there_a_documented_change_management_process_for_producti` | Company Profile | yesno | soc2, iso27001, pci_dss_4, cis_controls |
| 14 | `are_subprocessors_and_vendors_risk_assessed_before_being_onb` | Company Profile | yesno | nist_csf_2, soc2, iso27001 |
| 15 | `does_your_organization_enforce_multi_factor_authentication_f` | Access Control | yesno | nist_csf_2, soc2, iso27001, hipaa, pci_dss_4, cis_controls |
| 16 | `are_user_access_reviews_performed_at_least_quarterly_for_pro` | Access Control | yesno | nist_csf_2, soc2, iso27001, pci_dss_4, cis_controls |
| 17 | `is_least_privilege_access_enforced_for_customer_data_environ` | Access Control | yesno | nist_csf_2, soc2, iso27001, hipaa, cis_controls |
| 18 | `are_shared_or_generic_administrative_accounts_prohibited_or_` | Access Control | yesno | soc2, iso27001, pci_dss_4, cis_controls |
| 19 | `is_a_unique_user_id_assigned_to_every_individual_with_system` | Access Control | yesno | pci_dss_4, hipaa, cis_controls |
| 20 | `is_a_password_policy_enforcing_minimum_length_complexity_and` | Access Control | yesno | pci_dss_4, cis_controls, iso27001 |
| 21 | `is_role_based_access_control_rbac_implemented_for_sensitive_` | Access Control | yesno | soc2, iso27001, hipaa |
| 22 | `does_remote_access_require_a_vpn_or_equivalent_secure_tunnel` | Access Control | yesno | pci_dss_4, cis_controls |
| 23 | `is_a_session_timeout_enforced_for_inactive_privileged_sessio` | Access Control | yesno | pci_dss_4, cis_controls |
| 24 | `is_access_to_protected_health_information_limited_strictly_t` | Access Control | yesno | hipaa |
| 25 | `is_physical_access_to_data_centers_or_server_rooms_restricte` | Access Control | yesno | soc2, iso27001, pci_dss_4 |
| 26 | `is_customer_data_encrypted_at_rest_using_industry_standard_a` | Data Protection | yesno | nist_csf_2, soc2, iso27001, hipaa, pci_dss_4, cis_controls |
| 27 | `is_data_encrypted_in_transit_tls_1_2_for_all_customer_facing` | Data Protection | yesno | nist_csf_2, soc2, iso27001, hipaa, pci_dss_4, cis_controls |
| 28 | `do_you_maintain_documented_data_retention_and_secure_deletio` | Data Protection | yesno | iso27001, hipaa, pci_dss_4 |
| 29 | `are_backups_tested_for_restore_capability_at_least_annually` | Data Protection | yesno | soc2, iso27001, cis_controls |
| 30 | `are_backups_encrypted_and_stored_in_a_separate_or_offsite_lo` | Data Protection | yesno | iso27001, cis_controls |
| 31 | `is_cardholder_data_prohibited_from_storage_after_authorizati` | Data Protection | yesno | pci_dss_4 |
| 32 | `is_data_masking_or_tokenization_used_for_sensitive_fields_in` | Data Protection | yesno | pci_dss_4, iso27001 |
| 33 | `are_data_loss_prevention_dlp_controls_in_place_to_monitor_fo` | Data Protection | yesno | iso27001, cis_controls |
| 34 | `are_secure_disposal_procedures_followed_for_decommissioned_h` | Data Protection | yesno | iso27001, hipaa, cis_controls |
| 35 | `do_you_maintain_a_documented_incident_response_plan_that_is_` | Incident Response | yesno | nist_csf_2, soc2, iso27001, hipaa, pci_dss_4, cis_controls |
| 36 | `can_you_notify_customers_of_a_security_incident_within_contr` | Incident Response | yesno | nist_csf_2, soc2, iso27001, hipaa |
| 37 | `do_you_retain_security_logs_for_at_least_90_days_or_longer_i` | Incident Response | yesno | pci_dss_4, cis_controls, iso27001 |
| 38 | `breach_notification_meets_hipaa_60_day_requirement` | Incident Response | yesno | hipaa |
| 39 | `is_a_siem_or_equivalent_log_correlation_system_in_place_for_` | Incident Response | yesno | nist_csf_2, cis_controls, pci_dss_4 |
| 40 | `is_there_a_defined_incident_severity_classification_and_esca` | Incident Response | yesno | nist_csf_2, iso27001 |
| 41 | `is_a_post_incident_root_cause_analysis_and_lessons_learned_p` | Incident Response | yesno | nist_csf_2, iso27001, soc2 |
| 42 | `is_there_24_7_monitoring_or_an_on_call_rotation_for_critical` | Incident Response | yesno | cis_controls, nist_csf_2 |
| 43 | `do_you_maintain_a_business_continuity_disaster_recovery_plan` | Business Continuity | yesno | nist_csf_2, soc2, iso27001, hipaa |
| 44 | `have_you_tested_failover_or_recovery_procedures_in_the_last_` | Business Continuity | yesno | soc2, iso27001, hipaa |
| 45 | `are_critical_third_party_dependencies_identified_and_monitor` | Business Continuity | yesno | nist_csf_2, soc2, iso27001 |
| 46 | `is_infrastructure_redundant_across_multiple_availability_zon` | Business Continuity | yesno | iso27001, cis_controls |
| 47 | `is_there_a_documented_crisis_communication_plan_for_extended` | Business Continuity | yesno | iso27001, soc2 |
| 48 | `do_you_run_an_annual_disaster_recovery_tabletop_exercise_wit` | Business Continuity | yesno | nist_csf_2, iso27001 |
| 49 | `soc2_report_maturity` | Company Profile | single_choice | soc2 |
| 50 | `how_frequently_does_your_organization_perform_third_party_pe` | Incident Response | single_choice | nist_csf_2, pci_dss_4, cis_controls |
| 51 | `what_is_the_maximum_credential_rotation_interval_enforced_fo` | Access Control | single_choice | pci_dss_4, cis_controls |
| 52 | `which_of_the_following_third_party_certifications_does_your_` | Company Profile | multiple_choice | nist_csf_2, soc2, iso27001, hipaa, pci_dss_4 |
| 53 | `which_authentication_factors_are_supported_for_user_login` | Access Control | multiple_choice | nist_csf_2, soc2, iso27001, cis_controls |
| 54 | `which_of_the_following_data_protection_controls_are_implemen` | Data Protection | multiple_choice | iso27001, pci_dss_4 |

**Distinct items** (same 14-key rights subset as [`FRAMEWORK_RIGHTS_REGISTER.md`](./FRAMEWORK_RIGHTS_REGISTER.md) § Distinct controlKeys):

- `do_you_maintain_current_soc_2_iso_27001_or_equivalent_third_`
- `is_security_posture_reported_to_executives_or_the_board_at_l`
- `is_a_business_associate_agreement_baa_executed_before_handli`
- `is_the_cardholder_data_environment_cde_formally_scoped_and_d`
- `is_access_to_protected_health_information_limited_strictly_t`
- `is_cardholder_data_prohibited_from_storage_after_authorizati`
- `are_data_loss_prevention_dlp_controls_in_place_to_monitor_fo`
- `breach_notification_meets_hipaa_60_day_requirement`
- `is_there_a_defined_incident_severity_classification_and_esca`
- `is_there_a_documented_crisis_communication_plan_for_extended`
- `do_you_run_an_annual_disaster_recovery_tabletop_exercise_wit`
- `soc2_report_maturity`
- `which_of_the_following_third_party_certifications_does_your_`
- `which_of_the_following_data_protection_controls_are_implemen`

---

## Mapping mechanism

There is **no mapping to official publisher control catalogs**. Framework relationship is expressed only through in-repo `frameworks[]` tags on each bank item.

```
BankItem.frameworks[]
        │
        ▼
FrameworkPack (optional controlKeys[] filter, or all tagged items)
        │
        ▼
buildQuestionsForPackIds / buildQuestionsFromControlKeys
        │  (multi-pack union dedupes by controlKey)
        ▼
PortalQuestion { id: q_N, controlKey, category, type, options }
        │
        ▼
Assessment create → Firestore snapshot
  • frameworks[]
  • frameworkPackIds[]
  • questionBankVersion
  • questions[] (with controlKey)
  • versionLocked: true
        │
        ▼
VendorPortal reads snapshot only (no live bank rebuild)
```

**Pack upgrade path:** `diffPacks(from, to)` → optional `POST /api/ai/framework-map` suggestions → `rebaselineAssessment()` by `controlKey` match. `/api/ai/framework-map` uses Gemini when the API is configured and otherwise the heuristic lexical fallback; mappings and rebaseline are **never auto-applied** from the server; org admin must confirm.

**Org defaults:** `organizations/{id}.frameworkPackDefaults` (`src/lib/vendor/orgFrameworkPacks.ts`).

**Immutability:** Firestore rules block org rewrite of stamped snapshot fields on sent assessments unless the snapshot is empty (`firestore.rules`).

**Unwired library:** `applyAssessmentRebaseline.ts` — rebaseline Firestore writer exists but has **no UI caller** at baseline SHA.

---

## Runtime usage and path class

| Class | What | Key paths |
|---|---|---|
| **active** | Shipped spine | `AssessmentWizard.tsx`, `VendorPortal.tsx`, `Onboarding.tsx`, `Settings.tsx` / `FrameworkPacksCard.tsx`, `Assessments.tsx` / `AssessmentReviewPanel.tsx`, `FastTrackTriage.tsx`, `AuditReadiness.tsx`, `Pricing.tsx`, `Documentation.tsx`, `Dashboard.tsx`, `assessmentLifecycle.ts`, `emptyAssessmentRecovery.ts`, `validators.ts`, `POST /api/ai/framework-map`, `POST /api/ai/generate` (mock SOC 2 review when AI key absent) |
| **frozen** | Feature-flagged off (`featureFlags.ts` default `false`) | `Compliance.tsx`, `GovIntelSuite.tsx`, `PolicyDraftsman.tsx`, `Policies.tsx`, `ContractNegotiator.tsx`, `GmailAudit.tsx`, `TrustIntelligence.tsx` / `TrustScoreEngine.ts`, `AICopilotPanel.tsx` (`aiCopilot`), `TrustVault.tsx` (`trustVault`, public-preview copy), `AuditCalendar.tsx`, `SystemHealth.tsx` / `seedData.ts` (`healthLab`), `LiveAssistant.tsx` (`voiceStudio`; tool schema excluded from claims), AI mock `regulatoryTags` and gov-intel mocks in `server/routes/ai.ts` |
| **legacy** | Retained routes/stores, not spine | `VendorRisk.tsx` (`/vendors/legacy`) plus evidence cards `EvidenceSummaryCard.tsx`, `EvidenceFindingCard.tsx`, `ActivityFeed.tsx` (present in `src/`; **no current importer**), pre-`controlKey` portal fallbacks, vendor evidence-review mocks in `server/routes/ai.ts` |
| **test-only** | Vitest imports production bank | `questionBank.test.ts`, `frameworkPacks.test.ts`, `vendorAssessmentLifecycle.test.ts`, `Onboarding.test.tsx` |
| **public** | Marketing + client bundle | `Landing.tsx` (including EPA/Clean Water Act feature card), `index.html`; bank constants ship in client JS |

**Active routes (default flags):** `/onboarding`, `/assessments/new`, `/assessments/triage`, `/portal/:assessmentId`, `/settings`, `/audit-readiness`, `/pricing`, `/docs`, `/dashboard`, `/` (Landing).

**Claim rows (companion register):** **112** (was 107 at `57f94a05`; was 83 at `2033cf72`). Class split: public-active 9, authenticated-active 52, frozen 37, legacy 9, test-only 4, unknown 1. **9+52+37+9+4+1 = 112.** All rights states **unknown**. See [`FRAMEWORK_RIGHTS_REGISTER.md`](./FRAMEWORK_RIGHTS_REGISTER.md).

**Paths added in this pass (not in the 107-row register as distinct surfaces):**

| Path | Publication class | Claim IDs |
|---|---|---|
| `src/components/assessments/AssessmentReviewPanel.tsx` (+ `emptyAssessmentRecovery.ts`, `Assessments.tsx` L256/L465) | authenticated-active | C-093 |
| `src/components/EvidenceSummaryCard.tsx` | legacy (VendorRisk) | C-094 |
| `src/components/EvidenceFindingCard.tsx` | legacy (VendorRisk) | C-095 |
| `src/pages/Assessments.tsx` L563 pack-upgrade banner | authenticated-active | C-096 |
| `src/lib/vendor/validators.ts` L45 | authenticated-active | C-097 |

**Paths added in the first completeness pass (83→107):**

| Path | Publication class | Claim IDs |
|---|---|---|
| `src/components/AICopilotPanel.tsx` | frozen (`aiCopilot`) | C-069–C-073 |
| `src/pages/TrustVault.tsx` | frozen (`trustVault`; public-preview copy) | C-074–C-075 |
| `src/components/ActivityFeed.tsx` | legacy (unwired) | C-076 |
| `src/lib/TrustScoreEngine.ts` | frozen (Trust Intelligence) | C-077 |
| `src/pages/AuditCalendar.tsx` | frozen (`auditCalendar`) | C-078 |
| `src/lib/seeding.ts` (extra vs C-062) | authenticated-active (sample-data checkbox) | C-079 |
| `src/lib/seedData.ts` (extra vs C-063) | frozen (`healthLab`) | C-080 |
| `src/pages/VendorRisk.tsx` (extra vs C-053) | legacy | C-081–C-084 |
| `src/pages/GovIntelSuite.tsx` (extra vs C-054/C-055) | frozen | C-085–C-087 |
| `src/pages/Landing.tsx` L239–240 | public-active | C-088 |
| `server/routes/ai.ts` (extra mocks vs C-033 / mapping table) | mixed active/frozen/legacy | C-089–C-092 |

---

## Framework labels **not** shipped as packs

These names appear in marketing, frozen modules, demo seed, fallbacks, or AI mocks but **do not** have a corresponding `FrameworkPack` or bank tag set at baseline SHA:

NYDFS Part 500, NAIC Model Law, GDPR, DORA, NIS2, CCPA/CPRA, Solvency II, NIST SP 800-53, FedRAMP, ESG Scorecard, HITRUST (choice label only in Q52), EPA / Clean Water Act, CISA SCRM, ISO 14001, Lloyd’s.

Treat these as **claims / demo surfaces**, not inventory packs, until a separate pack and rights record exists.

---

## Git implementation provenance (not IP ownership)

| Commit | Date | Author | Change |
|---|---|---|---|
| `c178137` | 2026-07-23 | Atdhe Kurteshi | Initial 17-question portal bank |
| `57750d8` | 2026-07-25 | Atdhe Kurteshi | Framework-tagged bank with cross-framework dedup |
| `acce795` | 2026-07-25 | Atdhe Kurteshi | Rich answer types |
| `db30a76` | 2026-08-05 | Atdhe Kurteshi | Framework packs, `controlKey`, org pins, assessment stamps |
| `b0961b9` | 2026-08-09 | Atdhe Kurteshi | FastTrack Phase 2 spine integration |

File header (`frameworkPacks.ts` L1–3): *"Guardentra-owned framework pack library… customers never auto-download SDO standards."* Adjacent comment (`frameworkPacks.ts` L55): *"Official packs."* Both are **repository/implementation wording**, not licensing or publisher-approval evidence. See [`FRAMEWORK_RIGHTS_REGISTER.md`](./FRAMEWORK_RIGHTS_REGISTER.md).

---

## Known doc drift

| Location | Stale claim | Correct value |
|---|---|---|
| `docs/PRODUCT_ROADMAP_2026.md` | "48-question" bank | **54** controlKeys |

---

## Related issues

| Issue | Relationship |
|---|---|
| #25 | This inventory (P0-F1) |
| #26 | Correct unsupported claims (blocked on #25 merge) |
| #27 | Rights registry + publication gates |
| #29–#31 | OSCAL-first framework engine (not implemented) |
| #32 | Licensed publisher adapters |
