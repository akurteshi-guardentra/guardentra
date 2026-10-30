# Staging promotion gate (#126)

## Why
- Staging App Hosting (`guardentra-staging` / us-east4 / `guardentra`) auto-rolls out its live branch on every push.
- Until now that branch was `release/rc-2026-10-08`, and CI ran only on pull requests. So a merge commit whose combined tree no PR had tested could reach staging. That happened with `93e2f01` on 2026-10-26.

## How the gate works
1. `ci.yml` runs on every push to `release/**`. `infra-ci.yml` runs on `release/**` pushes that touch its paths.
2. Job `promote-staging` runs only for a push to `release/rc-2026-10-08`, after `verify` **and** `dispatcher` succeed on that exact SHA. A failed, cancelled or skipped job means the promotion job never runs.
3. Before promoting, the job checks two things:
   - The SHA must still be the RC head. A superseded commit is not promoted; the newer push promotes itself.
   - Every other GitHub Actions check on the SHA must be finished and successful. It waits up to about 20 minutes.
4. It then fast-forwards `deploy/staging` to the SHA with a plain, non-forced push. The first run creates the branch.

The workflow holds no cloud credentials. Its only write is to the `deploy/staging` branch.

## Owner steps to activate (not done by the PR)
Merging the PR alone changes nothing on staging: staging keeps tracking `release/rc-2026-10-08` until step 3.
1. Merge the PR into `release/rc-2026-10-08` (owner authorization). The first successful CI run creates `deploy/staging`.
2. Branch protection on `deploy/staging`:
   - no force pushes, no deletion
   - restrict pushes to GitHub Actions
3. Firebase console: guardentra-staging, App Hosting, backend `guardentra`, Settings, Deployment. Change the live branch from `release/rc-2026-10-08` to `deploy/staging` and keep automatic rollouts ON.
4. Recommended: protect `release/**` with required checks `verify` + `dispatcher` and "Require branches to be up to date before merging".

## Rollback
Set the App Hosting live branch back to `release/rc-2026-10-08`, or roll back a bad build from the App Hosting console. `deploy/staging` can be left as-is.

## Not covered
App Hosting rollouts never deploy Firestore rules or indexes. Those stay separate, owner-approved deploys; see the #126 rules correction.
