# Project status

A running log of what has been built in Make My Marriage, newest at the bottom of each section. Update it whenever a major feature lands (see AGENTS.md). Dates are commit dates. The design lives in `prd.md`, `system-design.md`, `db-design.md` and `api-design.md`; this file only says what exists and what is left.

## Built

| Date | Feature | Notes |
| --- | --- | --- |
| 2026-10-05 | Project scaffold | Next.js App Router, TypeScript, Tailwind v4, MongoDB driver, Vitest. |
| 2026-10-06 | App skeleton and homepage | Route groups (public, member, guest, vendor, staff), the marketing homepage matched to the Figma design, test foundation. |
| 2026-10-06 | Accounts, wedding setup, team | Sign-up and sign-in, email verification, password reset, wedding creation and editing, team invites with Admin and Manager roles, MongoDB email queue (Resend; logged to the console without a key). |
| 2026-10-06 | Events and tasks (Phase 2) | Itinerary of events, tasks and milestones. |
| 2026-10-06 | Guests and RSVP (Phase 3) | Guest list, CSV and Excel import, invitation pages, RSVP per event, invitation emails, automatic reminders, unsubscribe. |
| 2026-10-06 | Dashboard | Live numbers from events, tasks, guests and replies. |
| 2026-10-06 | Money (Phase 4a) | Expenses, budgets, family cost splits. |
| 2026-10-06 | My Vendors (Phase 4b) | The couple's own vendor list and payment schedules. |
| 2026-10-06 | Marketplace (Phase 4c) | Vendor accounts and listings, staff approval, browsing, booking requests and quotes, reviews. |
| 2026-10-06 | Wedding website (Phase 5a) | Public site per wedding with three themes, gallery and live-stream sections. |
| 2026-10-06 | Seating plans (Phase 5b) | Tables and guest placement. |
| 2026-10-06 | Entry QR and check-in (Phase 5c) | One QR per guest per event, scanning at the venue. |
| 2026-10-06 | Photos (Phase 6) | Cloudflare R2 storage (local folder in development), member gallery, guest gallery link and uploads with review, photo QR, ZIP downloads, view-as-guest, cover pictures, vendor listing photos. |
| 2026-10-06 | Notification centre (Phase 7a) | In-app bell, per-person muting, daily task and payment alerts. |
| 2026-10-06 | Analytics (Phase 7b) | Charts with PNG and CSV export. |
| 2026-10-06 | Security review (Phase 7c) | Production CSP and fixes found in review. |
| 2026-10-07 | Responsive polish and performance (Phase 7d, 7e) | Phone and tablet layouts, fewer database round trips. |
| 2026-10-07 | Dropdown styling | One consistent look and spacing for every dropdown. |
| 2026-10-07 | Colour themes | 12 palettes (Classic and Indian heritage), chosen per person in Settings → Appearance. |
| 2026-10-07 | Legal pages and exports | `/privacy`, `/terms`, `/support`; expense and vendor CSV export; daily cleanup of old email records. |
| 2026-10-07 | Entry QR on a guest's page | Team members can show or download a guest's code. |
| 2026-10-07 | Live stream page | `/live`: YouTube link shown on the wedding website. |
| 2026-10-07 | Search and Quick Action | ⌘K search across the wedding plus page shortcuts; top-bar quick actions. |
| 2026-10-07 | Discover vendors | Google Places search at `/vendors/discover`. Needs `GOOGLE_PLACES_API_KEY`; untested against Google itself. |
| 2026-10-07 | Delete wedding | Admin-only, type the title to confirm; hidden at once, erased for good 7 days later by the daily cron. |
| 2026-10-08 | Security hardening round 2 | Sign-out revokes the session on the server; per-IP+email login lockout that clears on success; trusted client-IP headers; separate key for dev storage URLs; scoped updates check field names, not text; sign-out errors shown; homepage CTAs go to sign-up. |
| 2026-10-08 | Review of money, photos, marketplace | Expenses created by a vendor payment are locked to that payment; guests can fill at most 80% of photo storage. Open findings are listed under Not done yet. |

## Not done yet

- Monitoring and deployment: Vercel, Atlas Mumbai, domain, CI workflow, Playwright, product analytics.
- Small items: dashboard Vendors "Coming soon" card, budget alert when an installment is paid, notify members when a quote is accepted.
- Review findings still open: marketplace review integrity (a fake couple account plus a cooperating vendor can post a review, so add a vendor-confirmed "completed" step); deleting photos can leave files behind in storage if the storage call fails after the database rows are gone; staff review notes travel with listing data to couples' pages (not displayed).
- Testing on real phones and tablets; mobile check of the vendor portal and staff screens.
- Code has not been pushed to GitHub yet.

## Before launch

- Email queue needs a scheduler: on Vercel Hobby, a cron-job.org job calling `/api/cron/send-email` every minute with `Authorization: Bearer <CRON_SECRET>` (or Pro with a per-minute cron). Without it a failed first send is retried only by the daily job.
- Set `STAFF_EMAILS`, secrets of at least 32 characters, the four `R2_*` variables with a CORS rule, `SUPPORT_EMAIL`, `GOOGLE_PLACES_API_KEY`.
- Verify an email domain with Resend and set `EMAIL_FROM` (until then email reaches only the account owner).
- Have a lawyer review the Privacy and Terms text.
- Rotate the Stitch key.
