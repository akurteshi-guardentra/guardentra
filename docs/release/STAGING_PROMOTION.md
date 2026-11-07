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
4. It then fast-forwards `deploy/staging` to the SHA with a plain, non-forced push over SSH, using the environment's deploy key. The first run creates the branch.

The workflow holds no cloud credentials. Its only write is to the `deploy/staging` branch, and it makes that write with a deploy key, not with `GITHUB_TOKEN`.

## Why a deploy key and an environment
`GITHUB_TOKEN` is not a safe credential for this push. Anyone who can push a branch can edit `ci.yml` on that branch and grant the token `contents: write`. A push to that branch would then run their edited workflow and could move `deploy/staging` directly. Two controls close that:
- **Ruleset on `deploy/staging`:** only deploy keys may update or create the branch. `GITHUB_TOKEN` is refused, whatever the workflow asks for.
- **Environment `staging-promotion`:** this is the only place the deploy key's private half is stored. Its deployment-branch policy allows only `release/rc-2026-10-08`, so a job running from any other branch, or from a pull request, cannot read the secret.

The workflow token stays `contents: read` everywhere. If the secret is missing, the job fails closed and nothing is promoted.

## Owner steps to activate (not done by the PR)
Merging the PR alone changes nothing on staging: staging keeps tracking `release/rc-2026-10-08` until step 5. Do the steps in this order.
1. **Generate a key pair** on your own machine. The private key never goes into the repo:
   `ssh-keygen -t ed25519 -N "" -C "guardentra staging promotion" -f staging-promote`
2. **Deploy key:** repo Settings → Deploy keys → Add deploy key. Title `staging-promotion`, paste `staging-promote.pub`, tick **Allow write access**.
3. **Environment:** repo Settings → Environments → New environment `staging-promotion`.
   - Deployment branches and tags: **Selected branches and tags**, add exactly `release/rc-2026-10-08`.
   - Environment secret `STAGING_PROMOTE_DEPLOY_KEY`: the full contents of the private file `staging-promote`.
   - Then delete both key files from your machine.
4. **Ruleset:** repo Settings → Rules → Rulesets → New branch ruleset `deploy-staging`.
   - Enforcement **Active**. Target branch: include by name `deploy/staging`.
   - Rules: **Restrict creations**, **Restrict updates**, **Restrict deletions**, **Block force pushes**.
   - Bypass list: add **Deploy keys** only, set to "Always".
5. The next RC push with green CI creates `deploy/staging`. Check that the `promote-staging` job succeeded and that the branch equals the RC head.
6. **Firebase console:** guardentra-staging → App Hosting → backend `guardentra` → Settings → Deployment. Change the live branch from `release/rc-2026-10-08` to `deploy/staging` and keep automatic rollouts ON.
7. Recommended: protect `release/**` with required checks `verify` + `dispatcher` and "Require branches to be up to date before merging".

**Check that the bypass is closed (optional):** on a throwaway branch, change the promote job to `contents: write` and push `deploy/staging` with the token. The ruleset should reject the push.

## Rollback
Set the App Hosting live branch back to `release/rc-2026-10-08`, or roll back a bad build from the App Hosting console. `deploy/staging` can be left as-is.

## Not covered
App Hosting rollouts never deploy Firestore rules or indexes. Those stay separate, owner-approved deploys; see the #126 rules correction.
