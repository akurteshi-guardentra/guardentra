# Account migration via CLI

Terminal equivalent of [`ACCOUNT_MIGRATION.md`](./ACCOUNT_MIGRATION.md). Everything here
runs from this repo's directory.

Two steps are unavoidably interactive because they are sign-ins: `firebase login` and
`gcloud auth login`. Both open a browser. Nothing else needs the console.

---

## 0. Install gcloud — already done

Google Cloud SDK **578.0.0** is installed at `~/google-cloud-sdk` and symlinked into
`~/.local/bin`, which is already on PATH. Confirm with:

```bash
gcloud version
```

Installed from the direct tarball rather than Homebrew, which on this macOS version
compiles from source and takes hours. If it ever needs reinstalling:

```bash
curl -sSL --retry 3 -o /tmp/gcloud.tar.gz \
  "https://dl.google.com/dl/cloudsdk/channels/rapid/downloads/google-cloud-cli-darwin-x86_64.tar.gz"
gzip -t /tmp/gcloud.tar.gz          # verify — a truncated download extracts partially and fails confusingly
tar -xzf /tmp/gcloud.tar.gz -C ~/
ln -sf ~/google-cloud-sdk/bin/gcloud ~/.local/bin/gcloud
```

The SDK bundles its own Python, so no system Python setup is needed.

---

## 1. Sign in as admin@ (interactive)

```bash
gcloud auth login                                   # choose admin@guardentra.com
gcloud config set project guardentra-7f582
gcloud config set account admin@guardentra.com
```

```bash
./node_modules/.bin/firebase logout
./node_modules/.bin/firebase login                  # choose admin@guardentra.com
./node_modules/.bin/firebase projects:list          # guardentra-7f582 must appear
```

---

## 2. Verify the migration actually took

```bash
# Who has what on the project. akurteshi@ should NOT appear; admin@ should be roles/owner.
gcloud projects get-iam-policy guardentra-7f582 \
  --flatten="bindings[].members" \
  --format="table(bindings.role, bindings.members)" \
  --filter="bindings.members:user"
```

```bash
# Organization-level roles inherit into every project — check here too if an org exists.
gcloud organizations list
# then, using the ID from above:
# gcloud organizations get-iam-policy <ORG_ID> --flatten="bindings[].members" \
#   --format="table(bindings.role, bindings.members)" --filter="bindings.members:user"
```

```bash
# Which billing account the project is linked to, and whether billing is live.
gcloud billing projects describe guardentra-7f582
gcloud billing accounts list
```

Only `user:` principals matter here. Anything ending `.gserviceaccount.com` is
infrastructure and stays — see the warning in `ACCOUNT_MIGRATION.md` Phase 7.

---

## 3. Reissue the Gemini API key

The old key was revoked when the console was reset — the API now returns
`401 ACCESS_TOKEN_TYPE_UNSUPPORTED`. Create the new one **inside `guardentra-7f582`** so it
bills to the enterprise account rather than a throwaway project's small quota.

```bash
gcloud services enable generativelanguage.googleapis.com --project guardentra-7f582
```

```bash
gcloud services api-keys create \
  --display-name="Guardentra Gemini (server)" \
  --api-target=service=generativelanguage.googleapis.com \
  --project guardentra-7f582
```

The response includes a resource name ending in `/keys/<KEY_ID>`. Retrieve the secret:

```bash
gcloud services api-keys list --project guardentra-7f582 \
  --format="table(displayName, uid)"

gcloud services api-keys get-key-string <KEY_ID> --project guardentra-7f582
```

> `get-key-string` prints the key to your terminal. Keep it out of chat, tickets and
> commits — `.env.local` is gitignored, which is why it lives there.

---

## 4. Store the key in both places

They are independent stores; setting one does not populate the other
(see [`SECRETS.md`](./SECRETS.md)).

```bash
# Local — replace the GEMINI_API_KEY line in .env.local, keeping every other line intact.
# Paste the value in place of <NEW_KEY>.
python3 - <<'EOF'
import re, pathlib
p = pathlib.Path('.env.local')
s = p.read_text()
s = re.sub(r'^\s*GEMINI_API_KEY\s*=.*$', 'GEMINI_API_KEY=<NEW_KEY>', s, count=1, flags=re.M)
p.write_text(s)
print('updated')
EOF
```

```bash
# GitHub Actions repository secret
gh secret set GEMINI_API_KEY
```

```bash
# Google Secret Manager — only once an App Hosting backend exists
./node_modules/.bin/firebase apphosting:secrets:set GEMINI_API_KEY --project guardentra-7f582
```

---

## 5. Confirm it works

```bash
PORT=8099 npm run dev
```

In another terminal:

```bash
curl -s -X POST http://localhost:8099/api/ai/generate \
  -H "Content-Type: application/json" \
  -d '{"prompt":"Reply with exactly: OK"}'
```

- `{"text":"OK"}` — working. This also closes `KNOWN_ISSUES.md` #20.
- `AI credentials were rejected` — the key is wrong or not yet propagated (allow a minute).
- `AI quota exhausted` — the key is valid but its project has no billing attached.
- `AI not configured` — the server did not read `.env.local`; check the boot log for
  `[BOOT] GEMINI_API_KEY set:`.

---

## 6. Remove akurteshi@ (only after everything above passes)

```bash
gcloud projects remove-iam-policy-binding guardentra-7f582 \
  --member="user:akurteshi@guardentra.com" \
  --role="roles/owner"
```

Repeat for any other role the Phase 2 policy listing showed. Then confirm it is gone:

```bash
gcloud projects get-iam-policy guardentra-7f582 \
  --flatten="bindings[].members" \
  --format="table(bindings.role, bindings.members)" \
  --filter="bindings.members:user:akurteshi@guardentra.com"
```

An empty result means done. Billing has a **separate** policy — remove it there too:

```bash
gcloud billing accounts get-iam-policy <BILLING_ACCOUNT_ID>
```
