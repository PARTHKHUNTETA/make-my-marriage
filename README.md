# Make My Marriage

A web app where one wedding's family plans every event, task, guest, rupee and vendor in one
place, and guests join through links without ever creating an account.

Next.js (App Router) · TypeScript · Node.js · MongoDB Atlas (official driver, no Mongoose) ·
Tailwind CSS v4 + shadcn/ui · in-house email/password auth · Vercel · Cloudflare R2 for photos.

The design lives in [`docs/`](docs): [PRD](docs/prd.md), [system design](docs/system-design.md),
[database design](docs/db-design.md) and [API design](docs/api-design.md). Read those before
changing behaviour; this file only covers running the project.

## Status

The skeleton is in place (homepage, route groups, health check, error and guard foundations, and
the lint rule that protects tenant isolation), and Phase 1 (Foundation) is built:

- **Accounts:** email and password sign-up, login and logout, with Argon2id hashing, signed cookie
  sessions and rate limiting. Email verification and password reset use single-use, expiring
  links; resetting a password signs out every other session.
- **Weddings:** first-time setup (`/setup`) creates the wedding and makes its creator the admin,
  in one transaction. Everything under `(member)` needs an account that belongs to a wedding.
- **Team:** admins invite family and friends by email (`/settings/members`), who join as Managers
  through a link. Admins can promote, demote and remove members; a wedding can never be left
  without an admin.
- **Email:** account and invitation emails go through a MongoDB queue with retries and backoff,
  sent immediately and drained by a cron route.
- The dashboard hero and sidebar show the real wedding. The cards below the hero are still the
  design's sample data until their modules (events, tasks, guests, money, vendors, photos) exist.

- **Wedding details:** any member can edit the names, title, date, city, venue and message under
  Settings → Wedding details. The web address (slug) never changes when the title does.

- **Events:** add, edit and delete events (engagement to reception, or a custom one), listed in
  date order. Deleting one first shows what is linked, then keeps its tasks and removes only the link.
- **Tasks:** a checklist with status, priority, due date, assignee and related event; views for
  all, mine, completed and by event; filters that live in the URL. Overdue is worked out when
  read (the due day has passed in India and the task is not completed). Removing a member
  unassigns their tasks.

- **Guests:** one entry per invited party, with phone, email, how many people are allowed and
  which events they are invited to. Search, filter by event and reply, totals, a duplicate-phone
  warning, Copy link and Share on WhatsApp (the message is editable once for the whole wedding).
- **Invitations and replies:** each guest's private link (`/i/<token>`, no login) shows only their
  events. They reply per event until it starts, then it is read-only; members can still change a
  reply any time. Members see replies per event, who has not answered, and can export headcounts
  as CSV for the caterer.

- **Import:** Guests → Import takes a .csv or .xlsx file (template provided, with this wedding's own
  event names). The file is read in the browser; you see a row-by-row preview with errors and
  duplicate phone numbers, and nothing is added until you confirm. Duplicates are skipped unless
  you choose to add them.

- **Emails and reminders:** email invitations to one guest, ticked guests or everyone with an
  email; remind guests who have not replied; a log of every email sent. Automatic reminders are
  off until turned on (Guests → Emails and reminders): a reply reminder N days before each event
  (14 and 3 by default) and an event reminder the day before for attending guests. Each guest gets
  at most one automatic email a day, and every reminder has a one-click unsubscribe link. A daily
  cron (`/api/cron/send-reminders`) queues them; the per-minute cron sends them.

- **Money:** log expenses (11 categories, optional event, who paid) in rupees, stored exactly as
  paise. Shared expenses are split between the bride's family, the groom's family and the couple
  by percentage or fixed amount, and always add up to the paisa; a usual split can be set per
  category. Budgets are optional: whole wedding, per category and per event, with remaining and
  percent used, and over-budget lines in red. A "Who paid" page shows each side's contribution
  overall and by category. Deleting an event keeps its expenses and removes only the link.

- **My Vendors:** keep each vendor's category, contact details (tap to call or email), address,
  total cost, related events and notes. Each shows "spent so far" from the expenses linked to it.
  Each event page lists its vendors. Deleting a vendor keeps its expenses and removes only the link.
- **Payment schedules:** plan installments (Advance, Final...) with due dates on each vendor.
  Status is worked out from the date: upcoming, due soon (3 days), overdue, paid. Marking one paid
  creates the linked expense in one transaction, and pressing it twice can never create two.
  Marking it unpaid removes that expense. Money → Payments lists every installment by due date,
  with each vendor's total, paid so far and balance.

- **Vendor portal:** vendors sign up with their own account (a separate login and cookie from
  wedding members, so neither can open the other's side), verify their email, and manage one
  listing: category, cities, description, starting price, website and Instagram. Every new or
  edited listing goes to the Make My Marriage team for approval first; vendors can pause and
  resume a live listing. A suspended listing stays suspended even if edited.
- **Internal admin (`/staff`):** the team approves, rejects or suspends listings. Access is by
  signed-in member whose verified email is listed in `STAFF_EMAILS`; for everyone else the page
  is a 404. Set it in `.env.local` / Vercel (see `.env.example`).

- **Marketplace and bookings:** couples browse approved listings (starting in the wedding's own
  city) by category, city and price range, sorted by rating or price. A request names the events
  they want the vendor at, with the city, an expected guest count, a message and, if they choose,
  how to reach them. The vendor sees only that: event names and dates, never the couple's other
  data. The vendor replies with a quote or declines; the couple accepts the quote, which adds the
  vendor to My Vendors with the quote as total cost, linked to those events, in one transaction.
  A quote that changed after the couple looked cannot be accepted by mistake.

- **Reviews:** after the last event a vendor is linked to has passed, a couple can leave one 1 to 5
  star review (with optional words) per vendor, and change it later. The vendor can post one
  public reply. The listing's rating is recomputed on every change, and anyone viewing a review
  sees no wedding identity. The team can remove abusive reviews from `/staff`.

- **Wedding website:** every wedding has a public mini site at `/<address>` (and
  `<address>.<root domain>`), in one of three themes (Classical Indian, Minimal Elegant, Modern
  Celebration) that all show the same sections: the couple, date and city, the welcome message,
  the events marked "show on website" with times and dress code, venues with Google Maps links,
  and an optional live video. It is off until the couple turns it on, a hidden site is a plain
  404, it is never indexed by search engines, and it has no RSVP form. Members preview it before
  sharing, switch themes without losing content, and edit the address.
- **Live stream:** paste a YouTube watch, live or youtu.be link; only the video id is kept and the
  privacy-friendly embed is rebuilt from it. A small Content-Security-Policy lets pages frame only
  that player.

- **Seating plans:** per event, create tables with a capacity and seat parties at them by dragging
  (on a computer) or with the pickers (on a phone). A party takes its number attending, or the
  number allowed until it replies, and can be split across tables but never given more seats than
  it needs. Over-capacity tables are highlighted, and a "Still to seat" list shows who has no
  table. The capacity check and the change happen in one database write, so two people seating at
  once can never overfill a table, and moving a party goes all the way or not at all. Export as
  CSV, or print / save as PDF from a clean print page. An optional per-event switch (off by
  default) shows "Your table" on the invitation page of parties who are coming.

- **QR check-in:** a party that says it is coming gets an entry QR for that event on its
  invitation page (and in the day-before reminder email). At the gate, members open Guests →
  Check-in on a phone, pick the event and scan with the camera (or type the code, or search by
  name or phone), enter how many arrived and tap Check in. A repeat scan says "Already checked in
  at 7:42 PM, 3 people"; a code for another event, or a party not on the list, can be admitted as
  a walk-in. A counter shows arrived against expected and refreshes every 15 seconds. Scans made
  with no signal are kept on the phone and sent when it is back; each scan carries its own key,
  so sending one twice never counts anyone twice. Gate volunteers must be members (invite them
  as Managers).

Still to come: deleting a wedding (Phase 1), Discover vendors (needs a Google Places key), listing
photos (with file storage),
budget alerts at 90% and 100% (Phase 7 notifications), and the event album, invitations, expenses and
vendor links that attach to events in later phases. Features are built
in the PRD's seven release phases.

## Setup

You need Node 22 (see `.nvmrc`) and a MongoDB Atlas cluster you can connect to.

```bash
nvm install && nvm use      # Node 22
npm install
cp .env.example .env.local  # then fill in MONGODB_URI and SESSION_SECRET
npm run dev
```

`SESSION_SECRET` and `CRON_SECRET` can be generated with `openssl rand -base64 48`.

**Email in development.** Without a `RESEND_API_KEY`, emails are not sent: each one is printed to
the `npm run dev` terminal, link included. Sign up, then look there for the "confirm your email"
link; password-reset and invitation emails appear the same way. To send real mail, add a key from
[resend.com](https://resend.com). Until you verify a sending domain, Resend only delivers to your
own address.

Open <http://localhost:3000>. Check the database connection at
<http://localhost:3000/api/health>; it returns `{ "ok": true, "data": { "db": "up", ... } }` when
Atlas is reachable, or an `INTERNAL` error envelope when it is not.

Wedding sites are served on subdomains. Locally, <http://demo.localhost:3000> shows the site for
the slug `demo`. Chrome and Firefox resolve `*.localhost`; Safari does not.

- **Photos (members):** Photos has one album per event plus General, created automatically; deleting
  an event moves its photos to General. Members add photos in bulk (JPEG, PNG, HEIC, WebP, up to
  25 MB each, 50 at a time). The browser makes fast 400 px and 1600 px copies, sends every file
  straight to storage on a short-lived signed address, retries a dropped connection, and the
  server then checks each file really is that kind of image (by its first bytes, not its name)
  before it appears. Select, move between albums, delete (files included), full-screen view with
  swipe, and download the original. Each wedding has a storage quota (`PHOTO_QUOTA_GB`, default 10);
  a batch that would pass it is refused with `STORAGE_FULL`.
- **Downloads and covers:** the gallery downloads an album, all photos, or a hand-picked set as a ZIP
  (made in the browser, in parts of up to 150 photos or about 400 MB for big albums), and "View as
  guests" opens exactly what guests see. The wedding has a cover picture (Settings → Wedding
  details) shown at the top of the wedding website and behind the dashboard banner, and each event
  can have its own on its website card. Pictures are shrunk to a JPEG of at most 1920 px in the
  browser, checked by the server, and replacing or removing one (or deleting the event) deletes
  the old file.
- **Vendor listing photos:** vendors add up to 20 photos to their listing (vendor portal → Your
  listing); the first is the cover couples see in search, and couples see them all on the listing
  page. Photos are shrunk to a JPEG in the browser and checked by the server. Adding a photo sends
  the listing back for the team's review (they see the photos on the staff page); removing one does
  not, and a suspended listing stays suspended.
- **Guest gallery and uploads:** every wedding has one private link, `/g/<token>` (Photos → Share and
  QR), shown as a QR code to download (PNG or SVG) or print as an A4 poster or A5 table card.
  Guests need no account: they browse the approved photos (full-screen with swipe, download the
  original) and, while the couple has uploads switched on, add their own with an optional name
  and an album. Uploads are per-device rate limited by calls and by file count. A guest's photos
  stay invisible until a member approves them (Photos → To review, grouped by sender: approve or
  reject one, many, or everything from one person). Rejecting deletes the photo and its files;
  waiting photos count toward the storage quota; ones nobody reviews for 60 days are deleted by
  the daily cron, with a warning on the review page from day 45. An admin can replace the link if it
  leaks, which kills the old link and every printed QR at once. Websites can show a "Photo gallery"
  section linking to it (off by default; anyone who can open the website can then open the gallery).
- **Notification centre:** a bell in the top bar (and in the vendor portal) shows an unread count and
  a list, newest first, refreshed every minute and when a page opens. Each item opens its page;
  members can mark one or all as read, and choose which alerts they want under Settings →
  Notifications. Members are told about guest replies, guest photos waiting (at most hourly), a task
  given to them, their tasks due today or tomorrow or overdue, vendor payments due within 3 days or
  overdue, spending passing 90% or 100% of a budget, vendors quoting or declining a request, and
  (admins) people joining or being removed. Vendors are told about new booking requests, new
  reviews and accepted quotes. Alerts are in-app only, each is stored once per person (a daily job
  run twice never repeats one), they never block the action that caused them, and they delete
  themselves after 90 days. The daily task and payment alerts run in the same daily cron as the
  reminders.
- **Analytics:** one page (Analytics) turns the wedding's own data into seven charts, with nothing
  extra to enter: spending by category against budget, spending over time (cumulative, by week),
  contribution by payer, RSVP by event, expected headcount against checked-in, completed tasks over
  time, and approved photos by event (members against guests). Filter by event and date range; the
  filter lives in the address, so a view can be bookmarked. Every chart downloads as a PNG (drawn
  from the same SVG) and its data as a CSV (money in rupees), and has a "view as a table" fallback.
  Budgets are for the whole wedding, so they are hidden while a filter is on. Tasks now record when
  they were completed (older completed tasks use their last change).
- **Photo storage:** files live in Cloudflare R2 (set the four `R2_*` variables; all are required in
  production). Without them, development uses a `.local-storage/` folder served by
  `/api/dev-storage/*` behind signed, expiring addresses; that route does not exist in production.
  The R2 bucket must allow `PUT` and `GET` from the site's origin in its CORS settings.

### Environment variables

Defined in [`.env.example`](.env.example) and validated by [`src/lib/env.ts`](src/lib/env.ts).
Secrets live in `.env.local` (git-ignored) locally and in Vercel environment variables when
deployed. Nothing secret goes in the repository.

## Scripts

| Command                | What it does                            |
| ---------------------- | --------------------------------------- |
| `npm run dev`          | Dev server with Turbopack               |
| `npm run build`        | Production build (needs no secrets)     |
| `npm run typecheck`    | `tsc --noEmit`                          |
| `npm run lint`         | ESLint, including the isolation rule    |
| `npm run format:check` | Prettier check (`npm run format` fixes) |
| `npm test`             | Vitest                                  |

Before pushing, all of `typecheck`, `lint`, `format:check`, `test` and `build` should pass.

## Structure

```
src/
  app/        routes: (member) (guest) (public) (vendor), plus api/
  modules/    one folder per domain module: schema, repository, service, actions, components
  lib/        db, env, errors, context, authz, and the integration stubs
  components/ shared UI (components/ui is shadcn)
  themes/     wedding-website themes
  proxy.ts    maps <slug>.<root domain> to the wedding site
```

Routes use the doc's layout. Route groups add no URL segment, so `(public)/[slug]` also answers on
the apex domain and the vendor pages sit at `/listing`, `/bookings` and `/reviews`. Wedding slugs
must be checked against [`src/lib/reserved-slugs.ts`](src/lib/reserved-slugs.ts) when they are
created (Phase 5) so they can never shadow a real route; a test keeps that list in sync with
`src/app`.

### Module rules

The full text is in [`src/modules/README.md`](src/modules/README.md). In short:

1. Use a module only through its `service.ts`.
2. Repositories apply `weddingId` themselves; there is no unscoped query.
3. Server Actions validate with Zod, resolve context, check permission, then call the service.
4. Cross-module work goes through events, not through another module's data.

Rule 2 is built on [`src/lib/scoped.ts`](src/lib/scoped.ts): a repository wraps its collection
with `scoped(collection, { weddingId })`, which adds the wedding to every filter, stamps it on
inserts, refuses updates that rewrite it and starts every aggregation with a `$match` on it. The
lint rule keeps raw collection access out of everything else: importing `getDb` from `@/lib/db` is
an error everywhere except `src/modules/**/repository.ts` and `src/lib/`.

## Phones and tablets

The app is built to be used on a phone. Below the `lg` breakpoint (1024 px) the sidebar is replaced
by a menu button in the top bar that opens the same menu as a drawer (closes on a choice, on
Escape, or a tap outside); everything else stacks into one column. Pages were checked at 375 px
(phone) and 768 px (tablet) with no sideways scrolling, including the guest invitation, the
gallery and the public wedding website. Charts keep a readable size and scroll sideways inside
their card. Form fields are 16 px on phones so iPhones do not zoom in when one is tapped.
`src/components/layout-rules.test.ts` guards the two mistakes that broke phones before: a row of
tabs that cannot wrap, and a top bar with no menu.

## Security

How the app protects people, and what to know before going live.

- **Accounts:** Argon2id passwords; signed, HttpOnly, SameSite=Lax session cookies (Secure in
  production) with separate member and vendor sessions; login is rate limited per address and per
  email, and an unknown email costs the same time as a wrong password. Resetting a password signs
  out every other session. Removing a member takes effect on their next request.
- **Tenant isolation:** every query on a wedding's data goes through `scoped()`, which ANDs the
  wedding in; a lint rule bans raw database access outside repositories. Guest, gallery and entry
  links are 128-bit random tokens that reach exactly one guest or wedding.
- **Uploads:** photos are checked by their first bytes, not their name or type; SVG and anything
  else is refused. Storage addresses are signed and short-lived, and the local dev route does not
  exist in production.
- **Headers:** in production a Content-Security-Policy allows scripts, styles and requests only
  from this site (plus the R2 photo storage), blocks framing, plug-ins and outside forms; the
  camera is allowed for this site only. If you serve photos from a custom storage domain, add it to
  `img-src` and `connect-src` in `next.config.ts`.
- **Abuse limits:** public endpoints are rate limited per device; emailing guests or inviting team
  members needs a confirmed email address, and a wedding can email at most 3,000 guests a day.
- **Forms and APIs:** every mutating API route accepts JSON only (a form posted from another site
  is refused, including for logout), and Server Actions are same-origin by default.
- **Known and accepted:** sign-up says when an email is already registered (the usual trade-off
  for a clear message; it is rate limited per address). Sessions are stateless, so signing out
  clears the cookie but a copied cookie works until it expires (24 hours, or 30 days if "remember
  me" was ticked) unless the password is reset. Rate limits read the client address from the
  `x-forwarded-for` header, which Vercel sets itself; behind any other proxy that header must be
  overwritten, or limits can be dodged. `npm audit` reports a few issues in development tools
  (the linter and the shadcn CLI) that never ship; production dependencies are clean.
- **Before going live:** set `STAFF_EMAILS`, all four `R2_*` variables and `RESEND_API_KEY` with a
  verified domain, rotate any key that was ever pasted into a chat, and set a strong `SESSION_SECRET`
  and `CRON_SECRET` (32+ characters each).

## Deploying

Deployed on Vercel from Git. [`vercel.json`](vercel.json) pins functions to `bom1` (Mumbai) so
guest data is processed in India, not only stored there. In the Vercel project:

- Set the Node.js version to 22.x.
- Add the environment variables from `.env.example`, with production values. That includes
  `RESEND_API_KEY` and a verified sending domain in `EMAIL_FROM`, and `CRON_SECRET`.
- The email queue is drained by Vercel Cron every minute (`vercel.json`). Cron jobs that run more
  often than daily need a paid Vercel plan.
- Point the wildcard domain (`*.makemymarriage.com`) at the project and let Vercel issue the
  wildcard certificate.
