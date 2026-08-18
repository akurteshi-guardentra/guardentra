# Framework inventory (P0-F1)

Evidence-backed inventory of shipped framework-labelled questionnaire content, pack versions, mapping mechanics, and runtime usage.

| Field | Value |
|---|---|
| GitHub issue | [#25 — Inventory framework questions, mappings, provenance, and rights status](https://github.com/akurteshi-guardentra/guardentra/issues/25) |
| Baseline SHA | `0f07657620d853cd9228ed58cf29b7d7e9960b73` (`main`) |
| Investigation date | 2026-08-18 |
| Companion doc | [`FRAMEWORK_RIGHTS_REGISTER.md`](./FRAMEWORK_RIGHTS_REGISTER.md) |
| Claims register | Issue #26 (blocked until this inventory is merged) |

This document inventories **what exists in the repository and product spine**. It does not establish legal ownership, publisher permission, or compliance outcomes. Git authorship is implementation provenance only.

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
| **active** | Shipped spine | `AssessmentWizard.tsx`, `VendorPortal.tsx`, `Onboarding.tsx`, `Settings.tsx` / `FrameworkPacksCard.tsx`, `Assessments.tsx`, `FastTrackTriage.tsx`, `AuditReadiness.tsx`, `Pricing.tsx`, `Documentation.tsx`, `Dashboard.tsx`, `assessmentLifecycle.ts`, `POST /api/ai/framework-map` |
| **frozen** | Feature-flagged off (`featureFlags.ts` default `false`) | `Compliance.tsx`, `GovIntelSuite.tsx`, `PolicyDraftsman.tsx`, `Policies.tsx`, `ContractNegotiator.tsx`, `GmailAudit.tsx`, `TrustIntelligence.tsx`, AI mock `regulatoryTags` in `server/routes/ai.ts` |
| **legacy** | Retained routes/stores, not spine | `VendorRisk.tsx` (`/vendors/legacy`), pre-`controlKey` portal fallbacks |
| **test-only** | Vitest imports production bank | `questionBank.test.ts`, `frameworkPacks.test.ts`, `vendorAssessmentLifecycle.test.ts`, `Onboarding.test.tsx` |
| **public** | Marketing + client bundle | `Landing.tsx`, `index.html`; bank constants ship in client JS |

**Active routes (default flags):** `/onboarding`, `/assessments/new`, `/assessments/triage`, `/portal/:assessmentId`, `/settings`, `/audit-readiness`, `/pricing`, `/docs`, `/dashboard`, `/` (Landing).

---

## Framework labels **not** shipped as packs

These names appear in marketing, frozen modules, demo seed, or AI mocks but **do not** have a corresponding `FrameworkPack` or bank tag set at baseline SHA:

NYDFS Part 500, NAIC Model Law, GDPR, DORA, CCPA/CPRA, Solvency II, NIST SP 800-53, FedRAMP, ESG Scorecard, HITRUST (choice label only in Q52).

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
