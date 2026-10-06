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

Still to come: deleting a wedding (Phase 1), and the event album, invitations, expenses and
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
