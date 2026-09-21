# Staging email delivery (Issue #72)

**Scope:** `guardentra-staging` only. Do **not** install the extension, enable APIs,
create secrets, or configure SendGrid on `guardentra-prod` until a separate Owner
command authorizes production.

**Architecture:**

```text
GuardEntra UI (Invite Vendor)
  -> POST /api/notify/mail  (Firebase ID token + rate limit)
  -> Admin SDK write mail/{id}   (client rules: deny all)
  -> firebase/firestore-send-email (Cloud Functions)
  -> SendGrid SMTP
  -> recipient inbox
```

Repo queue path is implemented. This document is the **no-code** staging install
and acceptance procedure for real delivery.

Queue success is **not** delivery success.

## Schema compatibility (verified)

Queue writer: `server/lib/mailQueue.ts` → `server/routes/notify.ts`.

| Field | Written by app? | Extension use |
|---|---|---|
| `to: string[]` | Yes | Recipients |
| `message.subject` | Yes | Subject |
| `message.text` | Yes | Plaintext body |
| `message.html?` | Optional | HTML body |
| `createdAt` | Yes (ISO) | Ignored (observability) |
| `source` | Yes (`guardentra.notify`) | Ignored (observability) |
| `from` / `replyTo` | **No** | Uses extension Default FROM / REPLY-TO |
| `delivery.*` | **No** | Written only by the extension |

Official reference:
https://firebase.google.com/docs/extensions/official/firestore-send-email

Delivery status reference:
https://firebase.google.com/docs/extensions/official/firestore-send-email/delivery-status

Firestore rules keep `mail/{id}` client-deny (`firestore.rules`).

## Delivery status model

The extension creates/updates `delivery` on the same document. Common documented
states include:

| `delivery.state` | Meaning (as commonly documented) |
|---|---|
| `PENDING` | Queued for send |
| `PROCESSING` | Send in progress |
| `SUCCESS` | Provider/SMTP accepted the message |
| `ERROR` | Terminal send failure |
| `RETRY` | Documented manual re-queue signal in some extension docs |

**SUCCESS = provider/SMTP accepted the message.**  
**Inbox receipt must be confirmed separately.**

Useful fields (when present on the installed extension version):

- `delivery.attempts`
- `delivery.error` (redact if secrets appear)
- `delivery.info.messageId` / `accepted` / `rejected` / `pending` / `response` on SUCCESS
- `delivery.startTime` / `endTime` / `leaseExpireTime`

Do **not** treat `RETRY` / `PENDING` re-queue behavior as guaranteed unless verified
against the **exact** `firestore-send-email` version installed in staging.

## Failure / observability model

| Layer | Behavior |
|---|---|
| App queue write fails | HTTP 4xx/502; UI banner; no `mail` doc |
| Extension / SMTP fails | Expect `delivery.state=ERROR` and `delivery.error` when the extension records failure |
| Bounce after SMTP accept | May appear in SendGrid activity even when Firestore shows SUCCESS |

Do **not** teach the client to rewrite `mail` docs (rules deny). Any operator
retry steps must follow the installed extension version's documented procedure.

## SECRET NAMES ONLY (never values, never in git)

| Name | Where it lives | Purpose |
|---|---|---|
| Extension param **SMTP connection URI** | Firebase Extension config (staging) | SendGrid SMTP endpoint + user `apikey` |
| Extension param **SMTP password** | Firebase Extension config (staging) | SendGrid API key value |
| Optional SM: `SENDGRID_API_KEY` | Secret Manager `guardentra-staging` only if Owner stores the key there for rotation | Same key; **do not** put in App Hosting client/build env |
| `VITE_*` / App Hosting yaml | N/A | Must **not** contain SMTP credentials |

Never commit URI strings that embed the API key. Never log the password/key.

## FIREBASE EXTENSION SETTINGS REQUIRED (staging)

Project: **`guardentra-staging`** only.

1. Enable prerequisites Owner-authorized for staging (typically Cloud Functions /
   Eventarc / related APIs required by Extensions). **Not authorized by repo edits.**
2. Firebase Console → Extensions → install **Trigger Email from Firestore**
   (`firebase/firestore-send-email`) **or** CLI when Owner authorizes:
   `firebase ext:install firebase/firestore-send-email --project=guardentra-staging`
3. Parameters:

| Parameter | Staging value |
|---|---|
| Email documents collection | `mail` |
| Default FROM address | `support@guardentra.com` (or Owner-approved verified sender) |
| Default REPLY-TO address | Same as FROM unless Owner chooses otherwise |
| SMTP connection URI | SendGrid SMTP URI (**secret**; see SendGrid section) |
| SMTP password | SendGrid API key (**secret**) |
| Users collection | leave empty (we pass email addresses, not UIDs) |
| Templates collection | leave empty (raw `message` bodies) |

4. Wait until extension status is **Active**.
5. Record the installed extension version for status/retry semantics verification.

**Note:** Firebase Extensions product management is deprecated with a March 2027
management shutdown; already-installed extensions continue to execute. Track a
follow-up Owner decision for long-term provider strategy.

## SENDGRID SETTINGS REQUIRED (staging)

1. SendGrid account (staging / test subuser preferred).
2. Verify sender domain or single sender for the Default FROM address
   (SPF/DKIM/DMARC as required by SendGrid).
3. Create an API key with **Mail Send** only (least privilege).
4. SMTP (extension uses Nodemailer SMTP, not the Web API directly):

| Setting | Value |
|---|---|
| Host | `smtp.sendgrid.net` |
| Port | `465` (SMTPS) or `587` (STARTTLS) |
| Username | `apikey` (literal) |
| Password | SendGrid API key (**secret**) |

5. Optional: restrict key by IP if SendGrid plan allows; prefer staging-only key.
6. Do **not** wire SendGrid into the Vite client or App Hosting `VITE_*` vars.

## NO-CODE CONFIG STEPS (ordered)

1. Owner authorizes staging API enablement + extension install + SendGrid key creation.
2. Configure SendGrid verified sender / domain for Default FROM.
3. Install `firestore-send-email` on `guardentra-staging` with collection `mail`.
4. Paste SMTP URI + password into extension params only (not git).
5. Confirm extension **Active** and note version.
6. Confirm Firestore rules deployed (mail deny-all) on staging.
7. Run acceptance procedure below.
8. Attach evidence to Issue #72. Production remains untouched.

## EXACT STAGING ACCEPTANCE PROCEDURE

### Happy path

1. Sign in to staging app as an org admin
   (`https://guardentra-staging--guardentra-staging.us-central1.hosted.app`).
2. **Vendors → Invite Vendor** to Owner-controlled recipient
   (e.g. `akurteshi@guardentra.com`).
3. UI shows queue success banner (not “could not be queued”).
   Queue success is not delivery success.
4. Firestore (`guardentra-staging`) → collection `mail` → newest doc:
   - `to` includes the recipient
   - `message.subject` / `message.text` present
   - `source == guardentra.notify` (after this repo change is deployed)
   - app must **not** have written `delivery` at create time
5. Extension processes the document and updates `delivery` (observe live fields).
6. Expect eventual `delivery.state == SUCCESS` when the provider/SMTP accepted the message.
7. Confirm recipient inbox (or spam) separately — inbox receipt is required evidence.
8. Record: mail doc id, timestamps, `delivery.state`, messageId (not secrets).

### Failure path

1. Temporarily break SMTP (invalid password in extension **or** send to a
   provider-rejected address Owner controls for testing). Prefer a disposable
   invalid mailbox pattern SendGrid rejects, or a short-lived bad SMTP password
   with immediate restore.
2. Invite Vendor again (or Admin-write a test `mail` doc with the same schema).
3. Expect failure to be observable (typically `delivery.state == ERROR` and
   non-empty `delivery.error` when the installed extension records it that way).
4. Confirm UI still distinguishes **queue** failure (no doc / 502) from **delivery**
   failure (doc exists; extension reports failure).
5. Restore valid SMTP immediately.
6. Any manual re-send: follow only the procedure documented for the **installed**
   extension version (do not assume `RETRY`/`PENDING` without verification).

### Negative controls

| Check | Expected |
|---|---|
| Unauthenticated `POST /api/notify/mail` | 401/403; no mail doc |
| Client SDK write to `mail` | Permission denied |
| Production project | **Unchanged** — no extension install |

## Repo touch list (this change)

| File | Role |
|---|---|
| `server/lib/mailQueue.ts` | Schema builder + delivery helpers |
| `server/routes/notify.ts` | Uses builder; collection constant |
| `src/tests/mailQueue.test.ts` | Schema / delivery helper tests |
| `src/lib/notifications.ts` | Comment only (client still queue-only) |
| `docs/STAGING_EMAIL_DELIVERY.md` | This runbook |
| `docs/ENVIRONMENTS.md` | Points here for staging SendGrid path |

## Deployment

**NONE** from this document alone. Staging App Hosting must be rolled separately
if/when Owner wants the `source` field live; extension install does not require
an app redeploy for delivery of the existing queue schema (`to` + `message`).
