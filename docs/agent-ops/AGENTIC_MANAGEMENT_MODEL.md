# GuardEntra Agentic Management Model

Authority order remains `AGENTS.md`. This document defines the **management hierarchy** used to plan and dispatch work. It does **not** grant merge, deployment, secret, IAM, DNS, or production mutation authority to any AI role.

Solo owner and final authority: `@akurteshi-guardentra`

## Hierarchy

```text
L0 OWNER / FINAL AUTHORITY
        ↓
L1 CHIEF DISPATCHER / CHIEF OF STAFF
        ↓
L2 MANAGEMENT AGENTS
        ↓
L3 DOMAIN LEADS
        ↓
L4 EXECUTION AGENTS  (one writer per feature branch)
        ↓
L5 CONTROL / ASSURANCE  (optional / risk-based)
        ↓
L0 OWNER FINAL DECISION (merge / deploy / stop)
```

---

## L0 — Owner / Final Authority

**Identity:** `@akurteshi-guardentra`

**Authority (exclusive unless explicitly delegated in writing for a named action):**

- Priorities and scope
- Architectural approval
- Merge authorization
- Staging deployment authorization
- Production deployment authorization
- Emergency stop
- Final override of any agent recommendation

AI managers, leads, execution agents, and assurance roles **never** self-authorize merge or deploy. Owner command meanings in `AGENTS.md` remain binding (`commit`, `commit and PR`, `commit, PR, and merge`, `deploy staging`, `deploy production`).

---

## L1 — Chief Dispatcher / Chief of Staff

**Default role:** ChatGPT (or another owner-designated dispatcher)

**Responsibilities:**

- Convert owner goals into governed work (issues, acceptance criteria, dependency order)
- Choose the management owner (L2) for the workstream
- Generate task packets (`docs/agent-ops/TASK_PACKET_TEMPLATE.md`)
- Verify starting SHA / base branch before authorizing edits
- Enforce **one writer per branch** (`tool:*`)
- Audit completion evidence (`docs/agent-ops/COMPLETION_EVIDENCE_TEMPLATE.md`)
- Reject unsupported completion claims
- Escalate blockers to the owner

**Prohibited by default:** merge, push, deploy, secret rotation, IAM/DNS/production mutation — unless the owner command explicitly authorizes that stage.

---

## L2 — Management Agents

| Role | Primary responsibility | Typical handoff |
|---|---|---|
| **Engineering Manager / Architect** | Technical design coherence, ADRs, implementation sequencing | Domain leads + one execution writer |
| **Security Manager / Security Architect** | Threat model, trust boundaries, negative tests, fail-closed controls | IAM / Backend / Assurance |
| **Product / Program Manager** | Requirements clarity, acceptance criteria, scope boundaries | Engineering or UX leads |
| **Release Manager** | CI readiness, exact-SHA rollout evidence, environment isolation, rollback | DevOps/Firebase lead; owner deploy commands |

Managers **route and quality-gate planning**. They do not become a second merge authority and do not replace required CI or seven-field evidence.

---

## L3 — Domain Leads

Examples (assign per issue; not permanent ownership):

- Backend Lead
- Frontend Lead
- DevOps / Firebase Lead
- IAM Lead
- QA Lead
- Architecture Lead
- Data Lead
- UX / Requirements Lead

Leads refine task packets, identify exact files/services/tests, and nominate a single L4 writer. They may review diffs when labeled `review:*`, but review is **optional** and is **not** a merge gate under solo-owner policy.

---

## L4 — Execution Agents

Implementers that perform narrowly scoped task packets on a feature branch.

**Hard rule:** only **one writing agent** may own a feature branch at a time (`tool:*`). Other tools may perform read-only review of committed diffs when requested; they must not edit the same branch concurrently.

Execution agents must follow:

- Mandatory start procedure in `AGENTS.md`
- Exact repository paths under `docs/agent-ops/`
- Seven-field completion evidence before claiming done
- No secrets, tokens, customer evidence, or production records in commits or reports

---

## L5 — Control / Assurance Agents

Independent evidence/review roles when engaged (risk-based or owner preference):

| Role | Produces |
|---|---|
| Code Reviewer | Diff/SHA-bound review findings |
| Security Reviewer | Trust-path / negative-test / blocker assessment |
| QA / Test Reviewer | Test plan execution evidence |
| Release / SRE Reviewer | Rollout, health, rollback, environment isolation evidence |

Assurance does **not**:

- Silently change solo-owner merge policy
- Require a second human approver
- Grant AI merge or deployment authority
- Replace required CI/status checks

---

## Operating invariants (must preserve)

1. **Solo owner** remains sole final authority.
2. **One writer per branch**.
3. **No direct edits to `main`**; PR required.
4. **Required CI** retained.
5. **Seven-field completion evidence** mandatory for completion claims.
6. **Merge and deployment are separate**; production always needs a separate explicit owner instruction.
7. **Optional review** may be requested; it is not a merge gate by itself.
8. Security controls (tenant isolation, secrets, fail-closed trust, rollback evidence) are never weakened by hierarchy text.

## Related documents

- `AGENTS.md`
- `docs/agent-ops/TOOL_DISPATCH.md`
- `docs/agent-ops/TOOL_PROMPT_ROUTER.md`
- `docs/agent-ops/TOOLCHAIN.md`
- `docs/agent-ops/SOURCE_OF_TRUTH.md`
- `docs/agent-ops/PROJECT_STATE.md`
