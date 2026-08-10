# Phase 2 ops enablement — status



_Last verified: 2026-08-10_



## Completed (green)



| Item | Evidence |

|------|----------|

| WSL + Docker Desktop | Engine ready; Ubuntu WSL2; `docker.exe` at Docker Desktop bin |

| Local audit Postgres | `docker compose -f docker-compose.audit.yml` healthy on `:5433` (30h+) |

| Init script LF fix | `migrations/audit/docker-init/00_roles.sh` + `.gitattributes` |

| Live emit/verify/tamper | `npm run phase2:live-prove` → **PASS** (re-run 2026-08-10) |

| Full prove gate | `npm run phase2:spine-prove` (when env set; live prove green) |

| WIF pool `github-pool` | Created in `guardentra-7f582` |

| OIDC provider `github-provider` | **ACTIVE**; condition `assertion.repository=='akurteshi-guardentra/guardentra'` |

| SA `github-actions-ci` + WIF binding | `roles/iam.workloadIdentityUser` on repo principalSet |

| TF state bucket | `gs://guardentra-tfstate-eu-staging/` |

| gcloud session | `admin@guardentra.com` active; project `guardentra-7f582` |

| GitHub Actions vars | `GCP_PROJECT_ID=guardentra-7f582`, `GCP_PROJECT_NUMBER=967769575761` |

| gh session | `akurteshi-guardentra` (scopes: repo, workflow, read:org, gist) |

| Cloud SQL Path B wiring | optional `enable_vpc` + `enable_cloud_sql` in eu-staging; `infra/modules/vpc` stub |

| Dual Firebase runbook | `PHASE2_DUAL_FIREBASE.md`, `.firebaserc` aliases `eu`/`us` |

| No-browser auth scripts | `scripts/phase2-auth-gcloud.ps1`, `scripts/phase2-auth-gh.ps1` |

| `package.json` | Valid JSON (verified `JSON.parse`) |



## Still blocked



| Item | Blocker | Next human action |

|------|---------|-------------------|

| Cloud SQL Path B apply | Compute / Service Networking / SQL Admin APIs **disabled**; no VPC | See exact commands in `PHASE2_CLOUDSQL_STAGING.md` — enable APIs → `enable_vpc` apply → `enable_cloud_sql` apply |

| Dual Firebase `guardentra-eu` / `us` | `resourcemanager.projects.create` not granted in practice (testIamPermissions omits it despite orgAdmin); Firebase CLI also needs `firebase login --reauth` | Org Owner creates projects in console or grants Project Creator; reauth Firebase CLI; then share access |

| Production audit spine | Staging DoD not done | Keep `AUDIT_SPINE_ENABLED=false` on production |



## Auth diagnosis (2026-08-10)



| Command | Result |

|---------|--------|

| `gcloud auth login` (default browser) | Fails when no usable local browser |

| `gcloud auth login --no-launch-browser` in agent terminal | EOFError (cannot paste code) |

| Interactive `phase2-auth-gcloud.ps1` | **Works** |

| `gh auth login --web` device flow | **Works** |

| Cloud Shell | **Not required** |



## Local spine env (`.env.local`)



```

AUDIT_SPINE_ENABLED=true

AUDIT_DATABASE_URL=postgres://audit_app:audit_app@localhost:5433/guardentra_audit

AUDIT_DATABASE_URL_MIGRATOR=postgres://audit_migrator:audit_migrator@localhost:5433/guardentra_audit

AUDIT_WORKER_ENABLED=true

```



`phase2:live-prove` now loads `.env.local` via dotenv (same pattern as migrate).



## Exact next human commands



### Re-check week0 (optional)



```powershell

$gcloud = "$env:LOCALAPPDATA\Google\Cloud SDK\google-cloud-sdk\bin\gcloud.cmd"

& $gcloud iam workload-identity-pools providers describe github-provider --project=guardentra-7f582 --location=global --workload-identity-pool=github-pool --format="yaml(name,state)"

gh variable list --repo akurteshi-guardentra/guardentra

```



### Local spine



```powershell

$env:Path = "C:\Program Files\Docker\Docker\resources\bin;" + $env:Path

powershell -File scripts/phase2-local-spine.ps1

# or, if container already healthy:

npm run phase2:live-prove

```



### Cloud SQL Path B (do not skip plan review)



```powershell

# 1) APIs

$gcloud = "$env:LOCALAPPDATA\Google\Cloud SDK\google-cloud-sdk\bin\gcloud.cmd"

& $gcloud services enable compute.googleapis.com servicenetworking.googleapis.com sqladmin.googleapis.com secretmanager.googleapis.com --project=guardentra-7f582



# 2) tfvars

Copy-Item infra\envs\eu-staging\terraform.tfvars.example infra\envs\eu-staging\terraform.tfvars

# set enable_vpc=true, apply; then enable_cloud_sql=true, apply

terraform -chdir=infra/envs/eu-staging init

terraform -chdir=infra/envs/eu-staging plan

```



Full order: [`docs/PHASE2_CLOUDSQL_STAGING.md`](./PHASE2_CLOUDSQL_STAGING.md).



### Dual Firebase (Owner)



Create `guardentra-eu` / `guardentra-us` in Firebase/GCP console under org `280975227603`, grant `admin@guardentra.com`, then deploy rules per [`docs/PHASE2_DUAL_FIREBASE.md`](./PHASE2_DUAL_FIREBASE.md).



## Ratified defaults



- GCP + Cloud SQL; EU staging first

- Audit retention 7 years (`server/lib/audit/retention.ts`)

- Path A first (local Docker), then Path B (Cloud SQL staging)

- Keep `AUDIT_SPINE_ENABLED=false` on production until staging DoD


