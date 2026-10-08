# Code review

Reviewed 2026-10-08 on branch `dev`. Type check and lint were clean, 1,084 tests passed (223 skipped), and `npm audit --omit=dev` found 0 vulnerabilities. No secrets are in git (`.env*` is ignored apart from `.env.example`).

## Coverage (read this first)

The repo is about 38,000 lines in 346 files (tests excluded: 96 files). This was **not** a line-by-line read of every file.

| Depth | What |
| --- | --- |
| Read in full | Everything in `src/lib` apart from palettes, email templates and the zip and photo-upload helpers; members, wedding, deletion, events, tasks, invitations (service and sending), money (service, actions, calc, alerts), vendors service, marketplace service, checkin (actions and service), notifications (service and repository insert), discover, website service and actions, search actions; the auth, cron, dev-storage, guest and unsubscribe API routes; `next.config.ts`, `proxy.ts`, `vercel.json`. |
| Read in part | Guests (actions, service, import, repository lookups and update), photos (service, actions, schema limits), seating service, the check-in console, the vendor and staff layouts. |
| Pattern-scanned only | Every file, for: unsafe HTML, `eval`, type suppressions, `any`, external `fetch`, `target="_blank"` without `rel`, unscoped `getDb()`, `localStorage`, `console` output, `TODO`. |
| Not reviewed | Marketing home components, most `page.tsx` files, most form and list components, analytics, most repositories, palettes, email templates, and the tests themselves. |

## What is good

- Tenant isolation lives in the data layer (`lib/scoped.ts`): every query is ANDed with the wedding id, inserts stamp it, updates cannot rewrite it, and aggregations cannot `$lookup` across collections. `getDb()` is used outside repositories only by the rate limiter and the email queue.
- Sessions are signed HTTP-only SameSite cookies with separate member and vendor audiences. The wedding and role are read on every request, and a password reset invalidates older sessions.
- Argon2id passwords, constant-time login for unknown emails, hashed reset and verify tokens, 128-bit guest tokens, and a redirect target (`?next=`) that is checked.
- Uploads are checked server-side: size, magic bytes, accepted types, a per-wedding quota. Storage keys come from a strict pattern and never from user text.
- CSV export blocks spreadsheet formulas. Imports are previewed, re-validated on the server, and capped.
- Cron routes fail closed and compare the secret in constant time. Transactions are used where partial writes would corrupt state (create wedding, mark installment paid, delete event, change roles, accept quote).
- Dependencies are pinned to exact versions.

## Findings

Severity is about impact if left as it is.

### Medium

1. ~~**Photo uploads are not size-bound at the storage layer.**~~ **Fixed 2026-10-08.** Upload addresses are now signed for the exact size (original, copies, covers, listing photos) and the quota reserves it. Still open from this item: sweeping abandoned `uploading` slots in the daily cron and a per-gallery daily cap.
   Original finding:
   `signUpload` (`src/lib/storage.ts`) signs only `content-type`, and the quota check in `requestUploads` (`src/modules/photos/service.ts`) trusts the size the browser declares. Anyone holding the gallery link can declare 1 byte and PUT a very large object. Confirm rejects it afterwards, but an upload that is never confirmed is cleaned up only the next time someone requests an upload for that wedding. Fix: add `content-length` to `signableHeaders` and sign the declared size, check it again at confirm, add a per-gallery daily cap, and sweep `uploading` slots in the daily cron.
2. **Client IP is spoofable or shared.**
   `clientIp` (`src/lib/ratelimit.ts:34`) trusts the first `x-forwarded-for` value. That is safe on Vercel and spoofable elsewhere. With no header, everyone falls into one `"unknown"` bucket, so 30 logins per 15 minutes would apply to all visitors together. It also weakens the guest upload limits above. Use a platform-trusted header and handle "unknown" separately.
3. **Failed emails retry only once a day.**
   `vercel.json` now has only the daily cron, but `queue.ts` and `api/cron/send-email` assume a run every minute with 1/5/15/60-minute backoff. If the immediate send fails, a verify or reset email can arrive about 24 hours later. `api/cron/send-email` is effectively unused. Run it from an external pinger or a paid plan, and fix the comments.
4. **Sign-out does not revoke the session.**
   `clearSession` only deletes the cookie. The JWT stays valid for up to 30 days, so a copied cookie survives logout. Fix: a per-user session version, or bump `sessionsValidAfter` on logout.
5. ~~Installment expenses can be edited or deleted on their own.~~ **Withdrawn.** This was wrong: `money/repository.ts` already refuses to update or delete an expense with an `installmentId`, and the expense page explains it. The only gap was a misleading "no longer exists" error on a direct call, now fixed.
6. **The daily cron does everything in one serial run.**
   `api/cron/send-reminders` loops every wedding, loading all guests and events, then runs purges and alerts, with no `maxDuration`. On a 10-second function limit it will time out as data grows. `listTasksForAlerts` and `listPaymentsForAlerts` silently cap at 5,000 rows across all weddings. Split the jobs into separate crons or batches, and set `maxDuration`.
7. ~~**Camera can stay on after the scanner closes.**~~ **Fixed 2026-10-08.** The stream is released when the scanner was closed while the camera was starting.
   Original finding:
   In `components/checkin/checkin-console.tsx` the effect's cleanup runs while `stream` is still undefined if the screen is closed before `getUserMedia` resolves. The stream that arrives afterwards is never stopped. After the `await`, check `stopped` and stop the tracks.

### Low

- **Account enumeration at sign-up.** `EMAIL_IN_USE` reveals existing emails, while login and reset deliberately do not. Reset-request also differs in timing for known and unknown emails.
- **Login lockout can be abused.** 10 attempts per email per 15 minutes lets anyone lock a victim out, and successful logins do not reset the count.
- **`scoped.ts` false positive.** `assertNoScopeWrite` stringifies the update and looks for `"weddingId"`, so a note or name containing that word throws a 500. Check keys recursively instead.
- **Error logging is name-only.** `failure.ts` logs only `err.name`, which makes production faults hard to trace. Log the message or a request id, keeping personal data out.
- **Entry QR route skips the deleted check.** `GET /api/i/[token]/entry/[eventId]` serves a code for a soft-deleted wedding, because `getEntryTokenForGuest` does not look at the wedding.
- **Offline check-in queue persists after sign-out.** `lib/offline-queue.ts` keeps entry tokens in `localStorage` until synced. Unsynced scans should not be lost, but the tokens outlive the session on a shared phone.
- **Silent sync failure.** `flush()` in the check-in console returns quietly when `syncScansAction` fails (for example an expired session), so scans pile up with no prompt to sign in.
- **Approve-all by name.** `approveFromUploaderAction` matches guest uploaders by name text, so a guest who types another uploader's name is approved with them.
- **Dedupe ignores address changes.** `invite:<guest>:<day>` means editing a guest's email and re-sending on the same day is skipped.
- **Slow RSVP path.** `submitGuestRsvp` loads the whole invitation three times per request.
- **Inline email flush.** `flush()` sends up to 50 emails inside the user's request.
- **Check-in counts.** `arrivedCount` is not compared with `guestsAllowed`, and one rate-limit unit covers a sync batch of up to 100 scans.
- **Vendors need no verified email** to list, quote or reply. Staff approval gates listings, but quotes are not gated.
- **Discover search** spends the daily allowance even when Google fails.
- **Guest tokens are stored in plain text** (they are links, so a database read exposes working links, unlike hashed reset tokens). A deliberate trade-off worth recording.
- **Everything revalidates `"/" layout`.** Nearly every mutation clears the whole app's cache.
- **Housekeeping.** A mid-file `import` in `marketplace/service.ts`; `vendors/service.ts` has its own `toYmd` next to `toIstYmd` in `lib/dates.ts`; `confirmOne` has `void confirmed`.
- **Missing features.** No change-password or delete-account for signed-in users.

### Introduced during the sign-in work (all open)

- `side-panel.tsx` uses `priority` on an image that is hidden below `lg`, so phones preload 190 KB they never show.
- The header's "Get started" and "Sign in" both go to `/login` (`START_HREF`).
- `useSignOut` clears the loader on failure with no message.
- Small text at `text-ink-2/60` or `/80` on white is low contrast.
- No tests for `useSignOut` or the home header.
