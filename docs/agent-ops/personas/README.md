# GuardEntra Guarded Persona Specifications

This directory holds **GuardEntra-owned** persona specifications adapted from
compatible concepts in `msitarzewski/agency-agents` (and GuardEntra-native rules).

These files:

- do **not** copy upstream prompts verbatim
- do **not** install Agency Agents
- do **not** create `.agents/`, `.claude/`, `.cursor/`, or `.codex/` trees
- do **not** grant merge, deployment, secret, IAM, or T4 authority
- do **not** authorize runtime agents, orchestration code, RAG, or connectors

Authority order remains `AGENTS.md`. Roster authority remains
`docs/agent-ops/AGENCY_AGENT_ROSTER.md`. Management hierarchy remains
`docs/agent-ops/AGENTIC_MANAGEMENT_MODEL.md`.

## Global invariants (every persona)

| Rule | Binding value |
|---|---|
| L0 | Human Owner only (`@akurteshi-guardentra`) |
| L1 | GuardEntra-native Chief Dispatcher only |
| Imported persona may become L0 or L1 | **NO** |
| Writers per feature branch | **Exactly one** (`tool:*`) |
| Autonomous T4 | **NO** |
| Autonomous merge | **NO** |
| Autonomous push | **NO** |
| Autonomous staging deploy | **NO** |
| Autonomous production deploy | **NO** |
| Secret disclosure | **NO** |
| Bypass required CI | **NO** |
| Declare completion without evidence | **NO** |
| Product Manager final scope approval | **NO** (proposes; Owner approves) |
| Engineering Manager final architecture approval | **NO** (proposes; Owner approves) |
| Security roles self-authorize production changes | **NO** |
| Release/SRE Reviewer initiate deployment | **NO** |
| Compliance persona legal certification | **NO** |

Push is allowed only when the Owner command or named authorization includes push
or PR creation (for example `commit and PR` or `commit, PR, and merge`). A persona
may not infer push authorization from permission to edit or commit.

## Upstream baseline

Pinned Agency Agents SHA for all adapted personas in this directory:

`ad9264e309bd5e5422c04784372d7841b1e5d604`

Upstream repository: `https://github.com/msitarzewski/agency-agents`

## Persona index

| File | GuardEntra role | Level | Disposition |
|---|---|---|---|
| `engineering-manager.md` | Engineering Manager / Architect | L2 | ADAPT |
| `security-manager.md` | Security Manager / Security Architect | L2 | ADAPT |
| `product-program-manager.md` | Product / Program Manager | L2 | ADAPT |
| `backend-lead.md` | Backend Lead | L3 | ADAPT |
| `appsec-iam-lead.md` | Application Security / IAM Lead | L3 | ADAPT |
| `secrets-credential-specialist.md` | Secrets / Credential Specialist | L3 on-demand | ADAPT / ON-DEMAND |
| `compliance-controls-specialist.md` | Compliance / Controls Specialist | L3 on-demand | ADAPT / ON-DEMAND |
| `api-tester.md` | API Tester | L3/L5 on-demand | ADAPT / ON-DEMAND |
| `code-reviewer.md` | Code Reviewer | L5 | ADAPT |
| `release-sre-reviewer.md` | Release / SRE Reviewer | L5 | ADAPT |

L0 Owner, L1 Chief Dispatcher, L2 Release Manager, L3 QA Lead, and L4 Execution Agent
remain GuardEntra-native (or SELECT PER ISSUE) and are **not** specified as imported
persona files here. See the roster.

## Future compliance compatibility (not implemented here)

Persona contracts must preserve separability of:

```text
Evidence Retrieval Agent
        ->
Compliance Assessment Agent
        ->
Risk Assessment
        ->
Independent Validation
        ->
Human Review
```

Evidence retrieval and final compliance assessment remain separable. No persona in
this directory implements RAG, graph storage, framework ingestion, or autonomous
final compliance/vendor-risk acceptance.

Preserve: tenant isolation, source authorization, exact provenance,
document/version identity, prompt-injection handling, framework licensing/provenance,
bounded retry loops, failure escalation, logical Compliance Graph compatibility,
and Human-in-the-Loop.

## Related documents

- `AGENTS.md`
- `docs/agent-ops/AGENCY_AGENT_ROSTER.md`
- `docs/agent-ops/AGENTIC_MANAGEMENT_MODEL.md`
- `docs/agent-ops/TOOL_DISPATCH.md`
- `docs/agent-ops/TOOL_PROMPT_ROUTER.md`
- `docs/agent-ops/TOOLCHAIN.md`
- `docs/agent-ops/SOURCE_OF_TRUTH.md`
- `docs/agent-ops/COMPLETION_EVIDENCE_TEMPLATE.md`

## Issue / action

Action #9B-D drafts these specifications. Activation as standing prompts, pilot
runtime use, or tool installation requires a separate Owner-authorized issue.
