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

Still to come: deleting a wedding (Phase 1), Discover vendors and the marketplace and vendor
portal (the rest of Phase 4),
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
