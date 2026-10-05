Make My Marriage — System Design & Architecture (v1) 

# Make My Marriage — System Design & Architecture (v1) 

Oct 5, 2026 · @Parth Khunteta 

## 1. Overview and principles 

Make My Marriage v1 runs as a single Next.js application on Vercel, backed by a MongoDB Atlas cluster and Cloudflare R2 for photos. 

### Confirmed decisions 

|Decision|Choice|
|---|---|
|Architecture|Modular monolith, one codebase, one deploy|
|Framework|Next.js (App Router), React Server Components|
|Runtime|Node.js, TypeScript end to end|
|Database|MongoDB Atlas, managed cluster|
|Hosting|Vercel|
|Media storage|Cloudflare R2, zero egress fees|
|Auth|Open — see section 7|



### What the architecture must carry 

- **Four surfaces in one app:** the member dashboard, guest pages with no login, the public wedding website, and the vendor portal. 

- **Wedding-scoped data:** every record belongs to exactly one wedding, and no query may cross that boundary. 

- **Guest traffic in bursts:** one invitation send reaches 300 to 500 parties at once, and photo uploads spike during an event. 

- **Seasonal peaks:** Indian weddings cluster into a few weeks each winter, so load is uneven across the year. 

Page 1 of 22 

Make My Marriage — System Design & Architecture (v1) 

- **Photo weight:** a wedding can hold 5,000 or more photos, with guests uploading from the venue on patchy mobile data. 

### Principles 

1. **Boundaries in code, not in infrastructure.** Modules are separated by folder and interface so a module can later move out, but v1 ships as one deployable. 

2. **Server-first.** Data fetching and mutations run on the server through Server Components and Server Actions; the browser gets as little logic as possible. 

3. **Every query is scoped.** A shared data-access layer injects `weddingId` into every read and write, so isolation is not left to each caller. 

4. **Heavy bytes bypass the app.** Photos go browser → R2 directly with presigned URLs, never through a serverless function. 

5. **Buy the plumbing.** Email, storage, QR and places come from managed services, so the team builds wedding features. 

## 2. High-level architecture 



<!-- Start of picture text -->
One Next.js app serves four surfaces; photos bypass it entirely<br>Browsers<br>Member (login) Guest (token link) Wedding website Vendor portal<br>r<br>photos go direct to R2 (presigned)<br>H<br>1<br>Next.js monolith on Vercel (bom1) » Cloudflare R2<br>Server Components, Server Actions, route handlers photos + Worker thumbnails<br>Routing and rendering Context and permissions Worker patches photo records<br>dynamic ISR themes admin: manager- guest token<br>Domain modules: events - guests - money « vendors - photos MongoDB Atlas:<br>each with. schema, repository, service,i actionsi M10, Mumbai<br>Vercel Cron + QStash Resend Google Places<br>reminders, alerts, cleanup invites, reminders, bounces vendor discovery, cached<br><!-- End of picture text -->

system architecture · 4 surfaces, 1 app, 3 managed services 

Page 2 of 22 

Make My Marriage — System Design & Architecture (v1) 

Every browser request reaches the same Next.js app, which talks to Atlas for data and signs upload URLs for R2. The dashed line is the exception that shapes the design: photo bytes go straight from the guest's phone to R2 and never pass through a serverless function. 

## 3. Technology stack 

Every choice below is either your stated preference or the lightest option that fits a onedeploy monolith on Vercel. 

|Layer|Choice|Why|
|---|---|---|
|Framework|Next.js 15, App Router|Your preference; one app serves<br>all four surfaces|
|Language|TypeScript (strict)|Shared types between server and<br>client|
|UI|React Server Components,<br>Tailwind CSS, shadcn/ui|Server-first data, consistent<br>components without a design<br>system build|
|Forms and<br>validation|React Hook Form + Zod|Zod schemas validate on the<br>client and again on the server|
|Database|MongoDB Atlas M10 (Mumbai)|Your preference; M10 gives<br>backups and private networking,<br>M0/M2 do not|
|Driver|Official MongoDB Node driver,<br>thin repository layer|Mongoose adds weight; the driver<br>plus typed repositories keeps<br>queries explicit|
|Media storage|Cloudflare R2 + Workers|Zero egress; guests downloading<br>photos cost nothing in bandwidth|
|Image processing|Cloudflare Images or a Worker<br>with<br>`sharp`|Thumbnails generated once at<br>upload, not on each view|
|Email|Resend|Simple API, good deliverability,<br>domain-level DKIM setup|
|Background jobs|Vercel Cron + MongoDB email<br>queue|Cron claims and sends email in<br>small batches every minute|



Page 3 of 22 

Make My Marriage — System Design & Architecture (v1) 

|Layer|Choice|Why|
|---|---|---|
|Caching and rate<br>limits|MongoDB TTL counters|No extra service; a short-lived<br>counter collection caps RSVP and<br>upload rates|
|Vendor discovery|Google Places API (Text Search)|Already decided in the PRD|
|Live stream|YouTube iframe embed|No streaming infrastructure|
|QR codes|`qrcode`npm package, generated<br>server-side|PNG and SVG for print; no third-<br>party service|
|PDF output|React PDF (seating charts, QR<br>posters)|Rendered on the server, streamed<br>to the browser|
|Error tracking|Application logs|Structured server logs via Vercel;<br>no external tool in v1|
|Product metrics|Database queries|Computed from existing data; no<br>external tool in v1|
|CI/CD|GitHub + Vercel Git integration|Preview deploy per pull request|



### Deliberately not used in v1 

- **No separate API server.** Route handlers and Server Actions are the API; a mobile app later would get a versioned REST layer. 

- **No Redis.** Rate-limit counters live in MongoDB with a TTL index; sessions live in signed cookies. 

- **No message broker.** A MongoDB-backed email queue drained by cron covers the batching v1 needs. 

- **No Kubernetes or containers.** Vercel builds and runs the app. 

## 4. Application structure 

The monolith is organised as modules that mirror the PRD, each owning its collections, business rules and UI. 

Page 4 of 22 

Make My Marriage — System Design & Architecture (v1) 

### Folder layout 

```
src/
  app/
    (member)/              member dashboard, requires login
      dashboard/ events/ tasks/ guests/ money/ vendors/
      website/ photos/ live/ analytics/ settings/
    (guest)/               no login, token in the URL
      i/[token]/           personal invitation and RSVP
      g/[token]/           gallery and photo upload
    (public)/
      [slug]/              wedding website (served on
slug.makemymarriage.com), one of three themes
    (vendor)/              vendor portal, separate login
      listing/ bookings/ reviews/
    api/                   webhooks, upload signing, cron entry points
  modules/                 one folder per domain module
    wedding/ members/ events/ tasks/ guests/ invitations/
    money/ vendors/ marketplace/ photos/ website/ notifications/
      <module>/
        schema.ts          Zod schemas and TypeScript types
        repository.ts      all MongoDB access for this module
        service.ts         business rules, the only caller of repository
        actions.ts         Server Actions, auth-checked entry points
        components/        UI owned by this module
  lib/
    db.ts                  Atlas client, connection reuse
    context.ts             current user, wedding and role per request
    authz.ts               permission checks
    storage.ts             R2 presigning
    email.ts  queue.ts  ratelimit.ts
  themes/                  classical / minimal / modern website templates
```

### Module rules 

1. **One way in.** A module is used through its `service.ts` ; nothing outside it touches another module's repository or collections. 

2. **Repositories are scoped.** Every repository method takes the request context and applies `weddingId` itself. There is no unscoped `find` . 

3. **Server Actions are the boundary.** Each action validates input with Zod, resolves the context, checks permission, then calls the service. 

Page 5 of 22 

Make My Marriage — System Design & Architecture (v1) 

4. **Cross-module work goes through events.** When an RSVP changes, the guests module emits an internal event that notifications handles, rather than writing to another module's data. 

5. **Themes are presentation only.** All three website themes consume the same data shape, so a fourth theme is new templates and nothing else. 

### Why this holds up 

If a module ever needs to scale alone — photos being the likely first — its service is already the seam. It can move behind an HTTP call without touching callers. 

## 5. Rendering and routing 

Each of the four surfaces gets the rendering mode its traffic pattern deserves, from always-fresh dashboards to cached public pages. 

|Surface|Route|Rendering|Caching|
|---|---|---|---|
|Member<br>dashboard|`/(member)/*`|Dynamic, server-<br>rendered per<br>request|None; always fresh|
|Guest<br>invitation|`/i/[token]`|Dynamic, server-<br>rendered|None; RSVP state<br>must be current|
|Wedding<br>website|`slug.makemymarriage.com`|Static with ISR|Revalidated on<br>publish, 60s<br>fallback|
|Gallery|`/g/[token]`|Dynamic shell,<br>images from R2<br>CDN|Image URLs cached<br>at the edge|
|Vendor portal|`/(vendor)/*`|Dynamic, server-<br>rendered|None|
|Marketplace<br>browse|`/vendors`|Static with ISR, 5<br>minute revalidate|Listings change<br>rarely|



Page 6 of 22 

Make My Marriage — System Design & Architecture (v1) 

### How a page gets its data 

A member page is a Server Component that calls its module service directly — no fetch, no API round trip. Mutations are Server Actions, which validate, authorise, write, then call `revalidatePath` so the affected pages refresh. 

### Guest pages 

The token in the URL is the entire credential. The page resolves it to an invitation, loads only that guest's events, and renders in the wedding's theme. Nothing on the page reveals other guests or wedding internals. 

### Wedding website and ISR 

Each wedding site lives at its own subdomain, slug.makemymarriage.com, served by a wildcard DNS record and a wildcard TLS certificate, with the subdomain resolved from the host header by Next.js middleware. The site is statically generated per slug. Publishing a change or editing an event calls `revalidateTag` for that wedding, so the site updates within seconds without rebuilding anything else. This matters during peak season, when hundreds of sites are live at once and most receive heavy read traffic for a few days. 

### Mobile 

All surfaces are responsive. Guest pages are built to a tighter budget — minimal JavaScript, compressed images, under 3 seconds on 4G — since they are opened from WhatsApp on mid-range Android phones. 

## 6. Data layer: MongoDB Atlas 

The PRD's relational model maps onto MongoDB by embedding what is read with its parent and referencing what is queried on its own. 

### Embed or reference 

|Relationship|Decision|Reason|
|---|---|---|
|Wedding settings (theme,<br>slug, toggles, tokens)|Embedded in<br>`weddings`|Read together on every page|



Page 7 of 22 

Make My Marriage — System Design & Architecture (v1) 

|Relationship|Decision|Reason|
|---|---|---|
|Events in a wedding|Separate<br>`events`<br>collection|Queried, filtered and linked<br>from everywhere|
|Guests and invitations|Invitations embedded in<br>the guest document|A guest has 3 to 8 invitations;<br>always read with the guest|
|Expense splits|Embedded in the expense|Never queried alone|
|Vendor installments|Embedded in the vendor|Small, bounded, read with the<br>vendor|
|Seating assignments|Embedded in the table<br>document|A table holds 10 to 12 parties|
|Photos|Separate<br>`photos`<br>collection|Thousands per wedding;<br>paginated and filtered|



**Invitations embedded in the guest** is the key decision. The alternative — a separate collection — would need a join on every RSVP screen. Embedded, a guest loads in one read, and per-event headcounts come from an aggregation over the array. 

### Collections 

|Collection|Holds|Scoped by|
|---|---|---|
|`users`|Member accounts, password<br>hash, email verified|—|
|`weddings`|Wedding details, website and<br>gallery settings, budget|—|
|`weddingMembers`|User↔wedding link, role, muted<br>notifications|`weddingId`|
|`memberInvites`|Pending email invites, token,<br>expiry|`weddingId`|
|`events`|Event details, visibility flags|`weddingId`|
|`tasks`|Title, status, priority, assignee,<br>event link|`weddingId`|



Page 8 of 22 

Make My Marriage — System Design & Architecture (v1) 

|Collection|Holds|Scoped by|
|---|---|---|
|`guests`|Guest, allowed count, token,<br>`invitations[]`with RSVP and<br>entry token|`weddingId`|
|`expenses`|Amount, category, payer,<br>`splits[]`, links|`weddingId`|
|`budgets`|Per-category and per-event<br>budget amounts|`weddingId`|
|`vendors`|Vendor details,<br>`installments[]`,<br>linked events|`weddingId`|
|`seatingTables`|Table name, capacity,<br>`assignments[]`|`weddingId`,<br>`eventId`|
|`checkIns`|Arrival records per invitation per<br>event|`weddingId`|
|`albums`|Album name, event link|`weddingId`|
|`photos`|R2 keys, uploader, status,<br>dimensions|`weddingId`,<br>`albumId`|
|`notifications`|Type, message, link, read state|`weddingId`|
|`emailLogs`|Sends, type, status, bounce state|`weddingId`|
|`vendorAccounts`,<br>`listings`,|Marketplace, outside any wedding|—|
|`bookingRequests`,<br>`reviews`|||



Page 9 of 22 

Make My Marriage — System Design & Architecture (v1) 

### Indexes 

```
// Guest lookups and token resolution
guests.createIndex({ weddingId: 1, name: 1 })
guests.createIndex({ token: 1 }, { unique: true })
guests.createIndex({ weddingId: 1, "invitations.eventId": 1,
"invitations.rsvpStatus": 1 })
guests.createIndex({ "invitations.entryToken": 1 })   // gate check-in scan
// Public website and gallery
weddings.createIndex({ slug: 1 }, { unique: true })
weddings.createIndex({ galleryToken: 1 }, { unique: true })
```

```
// Hot list views
events.createIndex({ weddingId: 1, date: 1 })
tasks.createIndex({ weddingId: 1, status: 1, dueDate: 1 })
expenses.createIndex({ weddingId: 1, date: -1 })
photos.createIndex({ weddingId: 1, albumId: 1, status: 1, uploadedAt: -1 })
// Marketplace
listings.createIndex({ status: 1, category: 1, cities: 1 })
```

### Scoping and transactions 

Every repository method takes the request context and merges `{ weddingId }` into the filter before it reaches the driver. A lint rule forbids calling the collection handle outside a repository, so an unscoped query cannot ship. 

Atlas replica sets support multi-document transactions, used in the few places that need them: marking an installment paid (write installment, create expense), accepting a booking (update request, create vendor), and deleting a wedding. 

### Cluster 

Start on **M10 in Mumbai (ap-south-1)** , which gives daily backups, point-in-time restore and private endpoints. M0 and M2 lack these and cannot be used for guest personal data. Connection pooling matters on serverless: a cached `MongoClient` promise per lambda, with `maxPoolSize` around 10, prevents connection storms during an invitation send. 

Page 10 of 22 

Make My Marriage — System Design & Architecture (v1) 

## 7. Authentication and authorization 

Auth is built in-house: email and password, Argon2id hashing, and signed cookie sessions. No external auth service. This keeps full control over the two account types, with the trade-off that the team owns password reset, email verification and session security. 

### Three identity types 

|Identity|Credential|Session|
|---|---|---|
|Member|Email + password|Signed, HTTP-only cookie|
|Vendor|Email + password, separate account|Separate cookie, separate|
||space|namespace|
|Guest|Token in the URL, nothing else|No session at all|



Members and vendors live in different collections and cannot share an email-password identity, matching the PRD rule that a vendor account is never a wedding account. 

### Request context 

Every server entry point resolves a context before it touches data: 

```
type Context =
```

```
  | { kind: "member"; userId: string; weddingId: string; role: "admin" |
"manager" }
```

```
  | { kind: "vendor"; vendorAccountId: string }
  | { kind: "guest"; weddingId: string; guestId: string }
  | { kind: "anonymous" }
```

Because a user belongs to exactly one wedding, `weddingId` is resolved once at login and carried in the session. There is no wedding switcher and no chance of acting on the wrong wedding. 

### Authorization 

Permissions are a two-row table, not a policy engine. The only split is member management: 

```
const canManageMembers = (ctx) => ctx.kind === "member" && ctx.role ===
"admin";
```

Page 11 of 22 

Make My Marriage — System Design & Architecture (v1) 

Every Server Action begins with `requireMember()` , `requireAdmin()` or `requireVendor()` . Guest token resolution is its own path: look up the token, return the guest and wedding, and allow nothing beyond that guest's own invitations. 

### Tokens 

Guest invite, gallery and entry-QR tokens are 128-bit random values, base62-encoded, unique-indexed, and never sequential. They are credentials, so they are excluded from logs and analytics URLs. 

### Why in-house rather than a library 

The needs are modest: two account spaces, email-password login, and a guest path that uses no session at all. A hosted service would put user records outside Atlas and charge per user; a library would still need custom work for the member-versus-vendor split. Plain email-password is the least code for what v1 does, provided these are built carefully: 

- **Password reset and email verification** use signed, single-use, expiring tokens sent by email. 

- **Session cookies** are HTTP-only, Secure, SameSite=Lax, and rotated on login. **Brute-force protection** is a rate limit on login and reset attempts. 

Google or phone login can be added later without reworking this, since the session shape stays the same. 

Rate limiting here is a counter in MongoDB with a short TTL index, not a Redis dependency (see section 9). 

## 8. Media pipeline 

Photos never pass through the Next.js app: the browser uploads straight to R2 with a presigned URL, and a Worker makes the thumbnails. 

This is not a preference but a constraint — a Vercel serverless function caps request bodies at 4.5 MB, well below a single 25 MB phone photo. 

### Upload sequence 

1. The browser asks the app for an upload slot, sending filename, type and size. 

2. The app checks the wedding's storage quota and the per-device rate limit, then returns a presigned `PUT` URL valid for 10 minutes and an R2 object key. 

Page 12 of 22 

Make My Marriage — System Design & Architecture (v1) 

3. The browser uploads the file directly to R2, retrying per file on failure. 

4. On success the browser tells the app, which writes a `photos` document with status `pending` (guest) or `approved` (member). 

5. R2 fires an event to a Worker, which generates a 400 px thumbnail and a 1600 px display version, writes both back to R2, and patches the photo document with its dimensions. 

### Object keys 

```
weddings/<weddingId>/albums/<albumId>/<photoId>/original.jpg
weddings/<weddingId>/albums/<albumId>/<photoId>/display.webp
weddings/<weddingId>/albums/<albumId>/<photoId>/thumb.webp
```

Keys are structured so deleting a wedding is a single prefix delete, which matters for the DPDP deletion requirement. 

### Serving 

The bucket is private. A Worker sits in front of it and checks the gallery token before serving, so photos cannot be hot-linked out of an album. Approved photos are cached at Cloudflare's edge; pending ones are never served to guests at all. 

### Moderation 

Guest photos land as `pending` and appear only in the member Guest Uploads view, which reads thumbnails. Approval is a status flip with no file movement. Rejection deletes all three objects and the document together. 

### Quotas and cleanup 

Each wedding carries a storage limit (the PRD's open question Q3), enforced at the slot-request step, before any bytes move. 

Pending photos count toward the quota, so an unreviewed backlog cannot slip past it. A nightly job deletes photos pending for more than 60 days, and purges weddings deleted more than 30 days ago. 

Page 13 of 22 

Make My Marriage — System Design & Architecture (v1) 

### Why R2 over S3 here 

A wedding gallery is read far more than it is written: 300 guests browsing and downloading an album moves tens of gigabytes out. On S3 that egress is billed per gigabyte; on R2 it is free. The trade is that thumbnails need a Worker rather than a managed service. 

## 9. Background jobs and email 

Serverless functions time out, so a large send is never done in one request. Emails go into a MongoDB queue and a cron job drains it in small batches, with no external queue service. 

### Why not send inline 

An invitation send can mean 500 emails. In one request that exceeds the function timeout and loses everything on failure. Queued as rows, each email is sent and retried on its own, and the member never waits on the send. 

### Scheduled jobs 

|Job|Schedule|Work|
|---|---|---|
|RSVP reminders|Daily, 09:00 IST|Find events 14 or 3 days away, enqueue reminders<br>for non-responders|
|Event reminders|Daily, 09:00 IST|Enqueue reminders to attending guests for<br>tomorrow's events|
|Payment alerts|Daily, 08:00 IST|Notify on installments due in 3 days or overdue|
|Task alerts|Daily, 08:00 IST|Notify assignees of tasks due tomorrow or overdue|
|Storage cleanup|Nightly|Delete stale pending photos and purged weddings|
|Notification pruning|Weekly|Remove notifications older than 90 days|



### Send pipeline 

When a member sends, the app writes one row per recipient to an `emailLogs` collection with status pending, and returns at once. A cron job runs every minute, claims a batch of 20 to 50 due rows with an atomic findOneAndUpdate, renders each email, sends it 

Page 14 of 22 

Make My Marriage — System Design & Architecture (v1) 

through Resend, and marks the row sent or failed. Failed rows retry a few times with increasing delay, then park as failed for the member to see. 

Three rules keep this safe: a daily cap of one automatic email per guest, a unique index on guest-event-day so a retried cron can never enqueue a duplicate, and a one-click unsubscribe link that sets `remindersUnsubscribed` on the guest. 

### Emails sent 

|Email|Trigger|To|
|---|---|---|
|Verify email, reset password|Account actions|Member or vendor|
|Member invite|Admin invites|Invitee|
|Wedding invitation|Member sends|Guest|
|RSVP reminder|Manual or scheduled|Non-responding guest|
|Event reminder|Scheduled, day before|Attending guest|
|Booking request, quote, decision|Marketplace actions|Vendor or members|



### Deliverability 

A dedicated sending domain ( `mail.makemymarriage.com` ) with SPF, DKIM and DMARC. Bounces and complaints come back by webhook and mark the guest's email invalid, so the app stops retrying a dead address and shows it in the guest list. 

## 10. External integrations 

Four outside services, each wrapped in its own module so it can be swapped without touching feature code. 

|Integration|Used for|Key risk and mitigation|
|---|---|---|
|Google Places API|Discover Vendors<br>search|Billed per search; cache results 24 hours<br>in a MongoDB collection keyed by<br>category + city with a TTL index, and cap<br>searches per wedding per day|



Page 15 of 22 

Make My Marriage — System Design & Architecture (v1) 

|Integration|Used for|Key risk and mitigation|
|---|---|---|
|Resend|All transactional email|Deliverability; dedicated domain, DKIM,<br>bounce webhooks|
|YouTube|Live stream embed|Nothing stored but a URL; validated as a<br>YouTube link and rendered in an iframe|
|Cloudflare R2 +|Photo storage and|Covered in section 8|
|Workers|delivery||



### Google Places details 

Text Search is called server-side only, never from the browser, so the key is never exposed. Each result is shown with the "Powered by Google" attribution Google requires, and only the fields a member chooses to save are written into `vendors` — name, category, phone and address. The app does not build a cache of Google's business data, which its terms restrict. 

### QR codes 

Generated in-process with the `qrcode` package: PNG for screens, SVG for print, both wrapped into an A4/A5 PDF poster in the wedding's theme. The wedding QR encodes the permanent gallery upload URL; entry QRs encode per-invitation tokens. Nothing leaves the app, so there is no third-party dependency on a code that is printed on wedding cards. 

### Webhook endpoints 

```
/api/webhooks/resend     bounce and complaint events
/api/webhooks/r2         thumbnail generation callbacks
/api/cron/[job]          Vercel Cron entry points
/api/cron/send-email     drains the email queue each minute
```

Every one verifies a signature before doing work, and all are excluded from the public route matcher. 

Page 16 of 22 

Make My Marriage — System Design & Architecture (v1) 

## 11. Security and privacy 

The app holds contact details for hundreds of people who never signed up for it, which makes guest data the main obligation under India's DPDP Act. 

### Application security 

|Control|Implementation|
|---|---|
|Passwords|Argon2id hashing; minimum length enforced; never<br>logged|
|Sessions|HTTP-only, Secure, SameSite=Lax cookies; rotated<br>on login|
|Tenant isolation|`weddingId`injected by the repository layer; lint<br>rule blocks raw collection access|
|Input validation|Zod at every Server Action and route handler|
|Rate limits|MongoDB TTL counters on login, password reset,<br>RSVP, upload slots and Places search|
|Tokens|128-bit random, unique-indexed, kept out of logs<br>and analytics|
|Headers|CSP, HSTS, X-Frame-Options; YouTube allow-listed<br>as the only external frame|
|Secrets|Vercel environment variables; nothing in the<br>repository|
|Dependencies|Dependabot plus<br>`npm audit`in CI|



### DPDP Act obligations 

|Requirement|How it is met|
|---|---|
|Consent and notice|Plain-language notice at sign-up and on every|
||guest page, stating what is collected and why|



Page 17 of 22 

Make My Marriage — System Design & Architecture (v1) 

|Requirement|How it is met|
|---|---|
|Purpose limitation|Guest contact details are used only for that<br>wedding's invitations and reminders; never for<br>marketing|
|Data minimisation|Guest records hold name, phone, email and notes;<br>no IDs or travel documents in v1|
|Right to erasure|Delete Wedding removes documents and the R2<br>prefix within 30 days, backups included|
|Right to access|Members export guests, expenses and vendors as<br>CSV|
|Withdrawal of consent|One-click unsubscribe on every automatic email|
|Breach reporting|Application-log alerts plus a documented response<br>runbook|
|Data residency|Atlas in Mumbai; R2 with India-preferred<br>placement|



### Risk notes 

- **Link-based access is the design.** Anyone holding a guest link can RSVP as that party. That is the deliberate trade for not asking relatives to log in. The mitigation is unguessable tokens, no personal data beyond the guest's own row, and photo moderation on every guest upload. 

- **Vercel runs in the US by default.** Functions must be pinned to the Mumbai region ( `bom1` ) so guest data is processed in India, not only stored there. 

- **Legal review is still needed** before launch, particularly the privacy notice wording and the retention schedule. 

## 12. Performance and scaling 

Load is uneven in two ways: it clusters into wedding season, and within a wedding it spikes on event days. 

Page 18 of 22 

Make My Marriage — System Design & Architecture (v1) 

### Where the spikes come from 

|Spike|Shape|Handling|
|---|---|---|
|Invitation send|500 emails in minutes|Queued through QStash, one<br>message each|
|Guest photo<br>upload|50+ guests uploading at a venue at<br>once|Direct to R2; the app only issues<br>slots|
|Website traffic|Hundreds of guests opening a site<br>the week before|ISR, served from cache|
|Gallery<br>browsing|Heavy reads for days after the<br>wedding|Cloudflare edge cache|
|Gate check-in|Fast repeated scans at the door|Indexed single-document lookups|
|Season peak|Many weddings active in the same<br>weeks|Vercel scales functions; Atlas tier is<br>the limit to watch|



### Performance budgets 

|Page|Target|
|---|---|
|Guest invitation and gallery|Under 3s on 4G, mid-range Android|
|Member dashboard|Under 2s on broadband|
|Check-in scan to result|Under 1s|
|Gallery thumbnail grid|First screen under 2s|



### Making the budgets hold 

- **Dashboard counts come from one aggregation.** The seven summary cards are a single `$facet` pipeline, not seven queries. 

- **Guest lists paginate.** Server-side pagination at 50 rows; a 500-guest list never ships whole. 

- **Guest pages ship almost no JavaScript.** Server Components render them; only the RSVP form is interactive. 

Page 19 of 22 

Make My Marriage — System Design & Architecture (v1) 

- **Images are sized, not scaled.** Thumbnails for grids, display versions for full-screen; originals only on download. 

- **ISR absorbs the website.** A wedding site is generated once and served from cache until something changes. 

### When to scale up 

|Signal|Action|
|---|---|
|Atlas CPU above 60% sustained|M10 → M20|
|Slow aggregation on dashboards|Add compound indexes, then consider a cached<br>summary per wedding|
|Email volume above Resend's plan|Raise the Resend plan; the queue and cron code do<br>not change|
|Photo storage past 1 TB|Negotiate R2 pricing; storage is the only metered<br>cost that compounds|



Nothing here requires splitting the monolith. The first service worth extracting, if ever, is photo processing — which already runs in a Worker. 

## 13. Operations, cost and risks 

Two environments, deploys from Git, and a running cost near ₹10,000 a month at pilot scale. 

### Environments 

|Environment|Purpose|Data|
|---|---|---|
|Preview|One per pull request|Shared staging Atlas database, seeded|
|Production|Live|Atlas M10 Mumbai, R2 production bucket|



A local setup runs against a developer's own Atlas free cluster and an R2 test bucket. 

Page 20 of 22 

Make My Marriage — System Design & Architecture (v1) 

### CI/CD 

Push to a branch opens a preview deploy. CI runs typecheck, lint, unit tests on services, and Playwright tests over the critical paths: sign-up and wedding creation, inviting a member, adding a guest and sending an invitation, a guest RSVP, and a guest photo upload through approval. Merging to `main` deploys to production; a bad release is rolled back by promoting the previous deployment. 

### Observability 

|Need|Tool|
|---|---|
|Errors|Application logs, server and browser, via Vercel|
|Product metrics|Scheduled queries over existing data for the PRD's<br>activation and RSVP funnels|
|Database health|Atlas monitoring with alerts on CPU and slow<br>queries|
|Email health|Resend dashboard plus bounce webhook logs|
|Uptime|Vercel analytics and an external ping on the public<br>site|



### Monthly cost at pilot scale 

Assuming roughly 50 active weddings, 25,000 photos and 30,000 emails: 

|Service|Plan|Approx. monthly|
|---|---|---|
|Vercel|Pro|₹1,800|
|MongoDB Atlas|M10, Mumbai|₹5,200|
|Cloudflare R2|~500 GB stored, free egress|₹650|
|Resend|50k emails|₹1,700|
|Email queue, rate limits, metrics|In MongoDB, no extra service|₹0|
|Google Places|Cached, capped|₹800|
|Error and uptime logging|Vercel logs, built in|₹0|



Page 21 of 22 

Make My Marriage — System Design & Architecture (v1) 

|Service|Plan|Approx. monthly|
|---|---|---|
|**Total**||**≈₹10,150**|



The cost that grows with success is storage, since photos accumulate and are never deleted. Everything else scales with activity, which stops between seasons. 

### Risks 

|Risk|Mitigation|
|---|---|
|In-house auth owns password reset and<br>sessions|Follow the section 7 checklist; use vetted<br>libraries for hashing and tokens, not hand-<br>rolled crypto|
|Vercel region defaults to the US|Pin functions to<br>`bom1`before launch|
|Guest links are shareable by nature|Unguessable tokens, no cross-guest data,<br>moderation on uploads|
|Printed QR codes cannot be changed|The gallery token is permanent; access is<br>controlled with an uploads toggle|
|Photo storage costs compound|Per-wedding quotas, automatic cleanup of<br>stale pending photos|
|Scope grew after the PRD|Budgets, marketplace, seating, check-in,<br>notifications and analytics now sit in v1;<br>confirm before the build plan is fixed|



### Open questions 

- **A1 — Auth:** decided — in-house email and password, Argon2id, signed cookie sessions, no external service. 

- **A2 — Storage quota:** what photo limit per wedding, and does a paid plan raise it? (PRD Q3) 

- **A3 — Domain:** decided — wedding sites use wildcard subdomains, 

- `slug.makemymarriage.com` . Still to confirm: is the domain registered, and are wildcard 

- DNS and the TLS certificate set up? 

- **A4 — Team and timeline:** how many engineers, and what launch date are we building toward? 

Page 22 of 22 

