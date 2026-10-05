# Make My Marriage — API Design (v1)

Oct 5, 2026 · @Parth Khunteta

Most operations are Next.js Server Actions called from the app; only guest pages, webhooks, cron and upload signing are HTTP endpoints. This doc lists every operation with its transport, auth, input and result.

## 1. Conventions

The app has two transports. Most work is a Server Action; a short list of things that must be reachable over HTTP are route handlers.

### Two transports

| Transport | Used for | Looks like |
| --- | --- | --- |
| Server Action | Everything the logged-in app does — member and vendor reads and writes | A typed function call from a React component; no URL |
| Route handler (HTTP) | Guest pages, webhooks, cron, upload signing, the public website's data | `METHOD /path`, a real URL |

Server Actions are not public URLs, so this doc lists them by operation name and module. Route handlers are listed with method and path. The split matters: anything a guest, an outside service, or a scheduler must reach is HTTP; anything only the app calls is an Action.

### Operation shape

Every operation, on either transport, is described the same way:

- **Auth** — who may call it: admin, manager, member (either role), vendor, guest token, cron secret, or webhook signature.
- **Input** — a Zod-validated object. Invalid input is rejected before any work.
- **Returns** — the data shape on success.
- **Errors** — the typed error codes it can raise (section 15).

### Result envelope

Actions return the data directly, or throw a typed `AppError`. HTTP routes wrap the same in a JSON envelope:

```json
{ "ok": true, "data": { } }
{ "ok": false, "error": { "code": "RSVP_OVER_LIMIT", "message": "You can bring up to 4 people" } }
```

### Auth context

Resolved once per call before any handler runs (see the architecture doc): a member Action carries `{ userId, weddingId, role }`; a guest route carries `{ weddingId, guestId }` from the token; a vendor carries `{ vendorAccountId }`. The `weddingId` is never taken from the request body — it comes from the session or the token, so no caller can act on another wedding.

### Validation, pagination, idempotency

- **Validation:** every input passes a Zod schema; the same schemas type the client.
- **Pagination:** list reads take `{ cursor?, limit }` (default 50) and return `{ items, nextCursor }`. Guest lists and photos always paginate.
- **Idempotency:** writes that a client may retry — photo upload confirmation, gate check-in — carry a client key so a replay is a no-op.
- **Rate limits:** login, password reset, RSVP submit, upload-slot requests and Places search are rate-limited by the MongoDB TTL counter from the DB design.

## 2. API surface map

&#91;embedded content: API surface · 4 callers, 2 transports, one service core\]

The logged-in app reaches the module services through Server Actions; guests, webhooks and cron reach the same services through HTTP routes. Both paths run the same auth, validation and wedding-scoping before any data is touched. The one exception is the dashed line: guest photo bytes go straight to R2 and never pass through the app.

## 3. Auth and accounts

Sign-up, login and account management for members and vendors. Login and reset are HTTP routes so they can set and clear the session cookie directly; the rest are Actions.

| Operation | Transport | Auth | Input | Returns |
| --- | --- | --- | --- | --- |
| Sign up (creates wedding) | `POST /api/auth/signup` | none | name, email, password | Session set; new wedding + admin |
| Sign up via invite | `POST /api/auth/signup` | invite token | name, password, token | Session set; joins as manager |
| Log in | `POST /api/auth/login` | none | email, password | Session cookie set |
| Log out | `POST /api/auth/logout` | member/vendor | — | Session cleared |
| Verify email | `GET /api/auth/verify` | verify token | token | Marks verified |
| Request password reset | `POST /api/auth/reset-request` | none | email | Always 200; email queued if found |
| Complete password reset | `POST /api/auth/reset` | reset token | token, new password | Password changed |
| Get current user | Action | member/vendor | — | `{ user, weddingId, role }` or vendor |
| Update my account | Action | member/vendor | name?, email?, password? | Updated user |
| Mute notification types | Action | member | types\[\] | Updated member |

### Rules

- Sign-up decides member-vs-invite by whether a `token` is present; without one it creates a wedding, with one it joins an existing wedding as manager.
- Reset-request always returns success whether or not the email exists, so the endpoint cannot be used to discover accounts.
- An email already tied to another wedding cannot accept an invite — the signup route returns `EMAIL_IN_USE`.
- Login, reset-request and reset are rate-limited per IP and per email.

## 4. Wedding and members

All Server Actions. Member management is admin-only; everything else is open to both roles.

| Operation | Auth | Input | Returns |
| --- | --- | --- | --- |
| Get wedding | member | — | Wedding with settings |
| Update wedding details | member | bride, groom, title, date, city, venue?, cover?, description? | Updated wedding |
| Get dashboard summary | member | — | Counts for all cards in one aggregation |
| List members | member | — | Members with roles |
| Invite member | admin | email | Pending invite; email queued |
| Resend invite | admin | inviteId | Invite re-sent |
| Cancel invite | admin | inviteId | Invite cancelled |
| Remove member | admin | memberId | Member removed; tasks unassigned |
| Promote to admin | admin | memberId | Role changed |
| Demote to manager | admin | memberId | Role changed |
| Delete wedding | admin | confirmTitle | Wedding and all data deleted |

### Rules

- **Dashboard summary** is a single `$facet` aggregation returning event count, task progress with overdue count, guest and RSVP totals, expense total, vendor count and pending-photo count — the seven cards in one round trip.
- Remove, demote and delete all run the last-admin check first and raise `LAST_ADMIN` if they would leave the wedding with none.
- Delete wedding requires the typed title to match and runs the erasure transaction from the DB design.
- Invite raises `EMAIL_IN_USE` if the email already belongs to any wedding.

## 5. Events and tasks

All Server Actions, both roles.

### Events

| Operation | Auth | Input | Returns |
| --- | --- | --- | --- |
| List events | member | — | Events in date order |
| Get event | member | eventId | Event with linked guests, tasks, vendors, album |
| Create event | member | type, name, date, startTime, …, showOnWebsite | New event + its album |
| Update event | member | eventId, fields | Updated event |
| Delete event | member | eventId | Deleted in a transaction (unlinks tasks/expenses/vendors, removes invitations, moves photos to General) |

### Tasks

| Operation | Auth | Input | Returns |
| --- | --- | --- | --- |
| List tasks | member | view (all/mine/completed/by-event), filters | Tasks, default sort by due date |
| Create task | member | title, status, priority, desc?, dueDate?, assignee?, eventId? | New task |
| Update task | member | taskId, fields | Updated task |
| Change status | member | taskId, status | Updated task |
| Delete task | member | taskId | Deleted |

### Rules

- Creating an event also creates its photo album in the same write path.
- Deleting an event returns a preview of what is linked before the destructive call, so the UI can warn first.
- Task list filters (assignee, event, status, priority) map to the compound indexes; "overdue" is computed at read time, never stored.

## 6. Guests, invitations and RSVP (member side)

The member-facing half; the guest half is the public API in section 12. All Server Actions.

### Guests

| Operation | Auth | Input | Returns |
| --- | --- | --- | --- |
| List guests | member | filters (event, rsvpStatus, search), cursor, limit | Paginated guests |
| Get guest | member | guestId | Guest with invitations |
| Create guest | member | name, guestsAllowed, invitedEventIds, phone?, email?, notes? | New guest with per-event invitations |
| Update guest | member | guestId, fields, invitedEventIds | Updated guest; invitations added/removed |
| Delete guest | member | guestId | Deleted |
| Import guests (CSV) | member | file rows | Preview with errors/duplicates, then confirm |
| Confirm import | member | validated rows | Guests created |

### Invitations and sending

| Operation | Auth | Input | Returns |
| --- | --- | --- | --- |
| Get guest invite link | member | guestId | Personal URL |
| Get WhatsApp share link | member | guestId | `wa.me` URL with prefilled message |
| Send invitation email | member | guestIds (one/many/all) | Emails queued |
| Send RSVP reminder | member | guestIds or "all non-responders" | Reminders queued |
| Update WhatsApp template | member | message | Saved on wedding |

### RSVP views and overrides

| Operation | Auth | Input | Returns |
| --- | --- | --- | --- |
| RSVP summary | member | eventId? | Per-event status + headcount, non-responder list |
| Override an RSVP | member | guestId, eventId, status, numberAttending | Updated invitation |
| Export headcounts (CSV) | member | eventId? | CSV for caterers |

### Rules

- Creating or updating a guest reconciles `invitedEventIds` against the embedded `invitations[]`: new events get a pending invitation with a fresh entry token, removed events drop their invitation.
- Members can override a guest's RSVP at any time, including after the event-start lock that applies to guests.
- Import validates every row (name required, headcount numeric, events known) and flags duplicate phones before anything is written.

## 7. Money

Budget, expenses and vendor payment schedules. All Server Actions, both roles. Amounts are paise.

### Budget

| Operation | Auth | Input | Returns |
| --- | --- | --- | --- |
| Get budget overview | member | — | Budget vs spent vs remaining per category and event |
| Set overall budget | member | amount | Updated wedding |
| Set category/event budget | member | scope, category/eventId, amount | Budget line upserted |
| Delete a budget line | member | budgetId | Removed |

### Expenses

| Operation | Auth | Input | Returns |
| --- | --- | --- | --- |
| List expenses | member | filters (category, event, vendor, payer), cursor | Paginated expenses |
| Expense summary | member | — | Totals by category and by event |
| Create expense | member | title, amount, date, category, paidBy, eventId?, vendorId?, splits? | New expense |
| Update expense | member | expenseId, fields | Updated expense |
| Delete expense | member | expenseId | Removed |

### Payment schedule

| Operation | Auth | Input | Returns |
| --- | --- | --- | --- |
| List installments | member | — | All installments by due date, with per-vendor paid/balance |
| Add installment | member | vendorId, label, amount, dueDate | Added to vendor |
| Update installment | member | vendorId, installmentId, fields | Updated |
| Mark installment paid | member | vendorId, installmentId | Marked paid + linked expense created (transaction) |
| Delete installment | member | vendorId, installmentId | Removed |

### Rules

- Overviews and summaries are aggregations; nothing is denormalised, so figures never drift.
- Marking an installment paid is the one money operation that spans two documents, so it runs in a transaction (installment + expense).
- A shared expense must carry `splits` that cover 100% or a fixed total; the Zod schema enforces this before write.

## 8. Vendors and marketplace (member side)

A wedding's own vendor list, the Google-Places discovery search, and the member side of the marketplace. The vendor's own side is section 13. All Server Actions.

### My Vendors

| Operation | Auth | Input | Returns |
| --- | --- | --- | --- |
| List vendors | member | filters (category, event) | Vendors with "spent so far" |
| Get vendor | member | vendorId | Vendor with installments |
| Create vendor | member | name, category, eventIds?, cost?, contact?, notes? | New vendor |
| Update vendor | member | vendorId, fields | Updated vendor |
| Delete vendor | member | vendorId | Removed; expenses keep amount, lose link |

### Discover (Google Places)

| Operation | Auth | Input | Returns |
| --- | --- | --- | --- |
| Search vendors | member | category, city (default wedding city) | Places results (cached), "Powered by Google" |
| Add Places result to My Vendors | member | place fields | New vendor pre-filled |

### Marketplace and bookings

| Operation | Auth | Input | Returns |
| --- | --- | --- | --- |
| Browse listings | member | category, city, priceRange, sort | Paginated live listings |
| Get listing | member | listingId | Listing with photos, rating, reviews |
| Send booking request | member | listingId, eventIds, message? | Request created, vendor notified |
| List my bookings | member | — | Requests with status |
| Cancel booking request | member | requestId | Status cancelled |
| Accept a quote | member | requestId | Booking accepted; vendor added to My Vendors (transaction) |
| Write a review | member | listingId, rating, text? | Review saved; listing rating recomputed |

### Rules

- Places search is server-side only, capped per wedding per day and cached 24 hours; results carry Google attribution.
- "Spent so far" on a vendor is an aggregation of linked expenses, computed at read.
- Accepting a quote spans the request and a new vendor, so it runs in a transaction; the agreed amount becomes the vendor's total cost.
- A review is allowed only after the vendor's last linked event, one per wedding per listing.

## 9. Seating and check-in

Seating is planned per event; check-in records arrivals live at the gate. All Server Actions.

### Seating

| Operation | Auth | Input | Returns |
| --- | --- | --- | --- |
| Get seating for event | member | eventId | Tables with assignments, unseated list |
| Create table | member | eventId, name, capacity | New table |
| Update table | member | tableId, name?, capacity? | Updated table |
| Delete table | member | tableId | Removed; its parties become unseated |
| Assign party to table | member | tableId, guestId, seats | Assignment added (capacity-guarded) |
| Move / unassign party | member | guestId, fromTableId, toTableId? | Reassigned |
| Export seating | member | eventId | PDF or CSV |

### Check-in

| Operation | Auth | Input | Returns |
| --- | --- | --- | --- |
| Resolve entry QR | member | entryToken | Party name, headcount, allowed, table, notes |
| Check party in | member | eventId, guestId, arrivedCount, clientKey | Check-in recorded (idempotent) |
| Find party by name/phone | member | eventId, query | Matching parties |
| Admit walk-in | member | eventId, walkInName, arrivedCount | Walk-in check-in |
| Live arrival counter | member | eventId | Arrived vs expected |

### Rules

- Assigning a party is guarded against table capacity, so two members seating at once cannot overfill a table; the loser gets `TABLE_FULL`.
- Check-in is idempotent on `(eventId, guestId)` plus the client key, so a repeat scan returns the existing record ("Already checked in at 7:42 PM") and an offline scan replayed on reconnect never double-counts.
- A party not invited to the event resolves to `NOT_INVITED`, which the UI turns into the walk-in path.

## 10. Photos and uploads

Member gallery management is Actions; upload signing is an HTTP route because the browser calls it before uploading straight to R2 (see the architecture doc). Image bytes never pass through the app.

### Member gallery (Actions)

| Operation | Auth | Input | Returns |
| --- | --- | --- | --- |
| List albums | member | — | Albums with counts |
| List photos | member | albumId, status, cursor | Paginated photos (thumb URLs) |
| List pending photos | member | cursor | Pending, grouped by uploader |
| Approve photos | member | photoIds or "all from uploader" | Status → approved |
| Reject photos | member | photoIds | Deleted (docs + R2 objects) |
| Move photo to album | member | photoId, albumId | Moved |
| Delete photo | member | photoId | Deleted |
| Member upload: request slots | member | files\[\] (name, type, size) | Presigned PUT URLs + keys |
| Confirm upload | member | keys, albumId, clientKey | Photo docs created (approved), idempotent |
| Get gallery / QR link | member | — | Gallery URL + QR (PNG/SVG/PDF) |
| Reset gallery link | member | — | New token (warns printed QR breaks) |
| Toggle guest uploads | member | on/off | Updated wedding |

### Upload signing (HTTP)

| Endpoint | Auth | Input | Returns |
| --- | --- | --- | --- |
| `POST /api/upload/sign` | member or guest token | file meta, albumId | Presigned PUT URL + key, after quota and rate check |

### Rules

- Signing checks the wedding's storage quota and the per-device rate limit before issuing a URL; over quota returns `STORAGE_FULL`.
- A member's confirmed upload lands `approved`; a guest's lands `pending` (section 12).
- Reject deletes the three R2 objects (original, display, thumb) and the document in one path.
- The R2 thumbnail Worker calls back over the webhook in section 14 to fill `displayKey`, `thumbKey` and dimensions.

## 11. Website, live, notifications, analytics

All Server Actions. The public rendering of the website is section 12.

### Website and live stream

| Operation | Auth | Input | Returns |
| --- | --- | --- | --- |
| Get website settings | member | — | Theme, slug, toggles |
| Update website settings | member | theme?, isOn?, showGallery?, showLive? | Updated; triggers revalidate |
| Check slug availability | member | slug | Available or taken |
| Set slug | member | slug | Updated (unique) |
| Set live stream | member | youtubeUrl, isOn | Validated and saved |

### Notifications

| Operation | Auth | Input | Returns |
| --- | --- | --- | --- |
| List notifications | member | cursor | Paginated, newest first |
| Unread count | member | — | Count for the bell |
| Mark read | member | ids or "all" | Updated |

### Analytics

| Operation | Auth | Input | Returns |
| --- | --- | --- | --- |
| Get analytics | member | event?, dateRange? | Datasets for the seven charts |
| Export chart data | member | chart | CSV |

### Rules

- Updating website settings or the slug calls `revalidateTag(weddingId)` so the static site refreshes within seconds.
- Setting the live URL validates it as a YouTube link before saving.
- Analytics are read-only aggregations over existing data; there is no separate analytics store.
- The notification panel is polled by the client; there is no realtime channel in v1.

## 12. Guest-facing public API

Everything a guest touches, with no account. Auth is a token in the URL and nothing else. These are real HTTP routes because guests reach them directly from a link or a QR scan.

### Invitation and RSVP

| Endpoint | Auth | Input | Returns |
| --- | --- | --- | --- |
| `GET /i/[token]` | guest token | — | Invitation page: greeting, the guest's invited events only |
| `GET /api/i/[token]` | guest token | — | Same data as JSON for the RSVP form |
| `POST /api/i/[token]/rsvp` | guest token | eventId, status, numberAttending | RSVP saved for that event |

### Wedding website (public)

| Endpoint | Auth | Input | Returns |
| --- | --- | --- | --- |
| `GET /` on `slug.makemymarriage.com` | public | — | Rendered site in the chosen theme (ISR) |
| `GET /api/site/[slug]` | public | — | Website data (events shown on site, venues, live URL) |

### Gallery and guest upload

| Endpoint | Auth | Input | Returns |
| --- | --- | --- | --- |
| `GET /g/[token]` | gallery token | — | Gallery landing: upload or view |
| `GET /api/g/[token]/albums` | gallery token | — | Albums with approved photos |
| `POST /api/upload/sign` | gallery token | file meta, albumId | Presigned PUT URL (shared with section 10) |
| `POST /api/g/[token]/confirm` | gallery token | keys, albumId, uploaderName?, clientKey | Photos created as `pending` |

### Rules

- A token resolves to exactly one guest (or one wedding, for the gallery) and exposes nothing beyond it — no other guests, no wedding internals.
- Guest RSVP is accepted only until the event's start time, then returns `RSVP_LOCKED`; `numberAttending` over the allowance returns `RSVP_OVER_LIMIT`.
- A re-submitted RSVP replaces the previous one for that event; it never creates a duplicate.
- Guest uploads always land `pending` and are invisible until a member approves them; if uploads are off, confirm returns `UPLOADS_CLOSED` while viewing still works.
- An expired or reset token returns a friendly `LINK_INVALID`, never a raw error.
- Every guest route is rate-limited by device, and the public site is served from the edge cache.

## 13. Vendor portal

The vendor's own side, in its separate account space. All Server Actions under vendor auth. A vendor sees only booking requests sent to its listing, never any wedding's data.

| Operation | Auth | Input | Returns |
| --- | --- | --- | --- |
| Get my listing | vendor | — | Listing with status |
| Create / update listing | vendor | category, cities, description, price?, photos?, links? | Listing saved as `pending` for review |
| Upload listing photos: sign | vendor | file meta | Presigned PUT URLs (max 20) |
| Pause / resume listing | vendor | on/off | Status toggled |
| List booking requests | vendor | status? | Requests with event snapshots, city, headcount |
| Quote a request | vendor | requestId, amount | Status → quoted; members notified |
| Accept / decline a request | vendor | requestId, decision | Status updated |
| List my reviews | vendor | — | Reviews received |
| Reply to a review | vendor | reviewId, text | One public reply saved |

### Internal admin (Make My Marriage team)

| Operation | Auth | Input | Returns |
| --- | --- | --- | --- |
| Review listings queue | staff | — | Pending listings |
| Approve / reject / suspend listing | staff | listingId, decision | Status updated |
| Remove abusive review | staff | reviewId | Deleted; rating recomputed |

### Rules

- A new or edited listing re-enters `pending` and is invisible on the marketplace until the team approves it.
- A booking request carries only the event snapshots, city and headcount the member chose to send — the vendor can never read the guest list or other wedding data.
- Internal admin is a thin staff-only surface, separate from both member and vendor auth.

## 14. System endpoints

HTTP routes for outside services and the scheduler. Each verifies a signature or a shared secret before doing anything, and none is reachable from the public app.

### Webhooks

| Endpoint | Caller | Verifies | Action |
| --- | --- | --- | --- |
| `POST /api/webhooks/resend` | Resend | Signature | Mark email bounced/complained; flag guest email invalid |
| `POST /api/webhooks/r2` | R2 / Worker | Signature | Fill `displayKey`, `thumbKey`, dimensions on the photo |

### Cron (Vercel Cron)

| Endpoint | Schedule | Verifies | Action |
| --- | --- | --- | --- |
| `POST /api/cron/send-email` | Every minute | Cron secret | Claim a batch from `emailQueue`, send via Resend, mark sent/failed |
| `POST /api/cron/rsvp-reminders` | Daily 09:00 IST | Cron secret | Queue reminders for non-responders 14 and 3 days out |
| `POST /api/cron/event-reminders` | Daily 09:00 IST | Cron secret | Queue reminders to attending guests for tomorrow's events |
| `POST /api/cron/payment-alerts` | Daily 08:00 IST | Cron secret | Notify on installments due in 3 days or overdue |
| `POST /api/cron/task-alerts` | Daily 08:00 IST | Cron secret | Notify assignees of tasks due tomorrow or overdue |
| `POST /api/cron/cleanup` | Nightly | Cron secret | Delete stale pending photos and purged weddings |

### Rules

- `send-email` claims rows with an atomic `findOneAndUpdate` (`pending → sending`), so overlapping runs never grab the same row; failures back off via `sendAfter`.
- Reminder crons only enqueue; the `dedupeKey` unique index stops a re-run from queuing a duplicate.
- A webhook with a bad signature returns 401 and does nothing; a cron call without the secret returns 401.
- TTL indexes handle rate-limit, Places-cache and old-notification expiry, so those need no cron.

## 15. Errors and cross-cutting rules

Every operation raises typed errors from one list, so the client handles them uniformly on both transports.

### Error codes

| Code | HTTP | Meaning |
| --- | --- | --- |
| `VALIDATION_FAILED` | 400 | Input failed its Zod schema; includes field details |
| `UNAUTHENTICATED` | 401 | No valid session, token or secret |
| `FORBIDDEN` | 403 | Authenticated but not allowed (e.g. manager doing admin work) |
| `NOT_FOUND` | 404 | Resource missing or not in this wedding |
| `LINK_INVALID` | 404 | Guest/gallery token expired or reset |
| `EMAIL_IN_USE` | 409 | Email already belongs to a wedding |
| `LAST_ADMIN` | 409 | Would leave the wedding with no admin |
| `RSVP_OVER_LIMIT` | 409 | `numberAttending` exceeds the allowance |
| `RSVP_LOCKED` | 409 | Event already started |
| `TABLE_FULL` | 409 | Seating assignment exceeds capacity |
| `NOT_INVITED` | 409 | Party not invited to this event (check-in) |
| `STORAGE_FULL` | 409 | Wedding photo quota reached |
| `UPLOADS_CLOSED` | 409 | Guest uploads turned off |
| `RATE_LIMITED` | 429 | Too many attempts |
| `INTERNAL` | 500 | Unexpected; logged with a trace id |

### Status-code mapping

Actions throw `AppError` with a `code`; the HTTP boundary maps each code to the status above and wraps it in the error envelope from section 1. The client switches on `code`, never on the message string, so wording can change freely.

### Cross-cutting rules

- **Isolation:** `weddingId` always comes from the session or token, never the body; a cross-wedding reference resolves to `NOT_FOUND`, not a leak.
- **Idempotency:** retryable writes (upload confirm, check-in) carry a client key; a replay returns the first result.
- **Pagination:** every list over \~50 rows is cursor-paginated.
- **Validation first:** no side effect runs before input validates.
- **Logging:** `INTERNAL` errors carry a trace id into the application logs; nothing sensitive (tokens, passwords) is ever logged.
- **Versioning:** v1 needs no version prefix, since the only external consumers are guests and webhooks; a future mobile app would get a versioned `/api/v1` REST surface over these same operations.
