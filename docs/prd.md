Make My Marriage — Product Requirements Document (v1) 

# Make My Marriage — Product Requirements Document (v1) 

Sep 21, 2026 · @Parth Khunteta 

## 1. Overview 

Make My Marriage v1 is a web app where one wedding's family plans every event, task, guest, rupee and vendor in one place, and guests join through links without ever creating an account. 

### Problem 

Indian weddings span 3 to 6 events, hundreds of guests and dozens of vendors. Families plan them across spreadsheets, paper lists and many WhatsApp groups. Guest lists differ by event, RSVPs are chased by phone, spending is tracked in diaries, and photos stay scattered across relatives' phones after the wedding. 

### Product summary 

- **For members:** a logged-in dashboard to manage events, tasks, guests, invitations, RSVPs, seating, check-in, budgets, expenses, vendors, the wedding website, photos and a live stream, with notifications and analytics. 

- **For guests:** a personal invitation link with per-event RSVP and entry QR codes, a public wedding website, and a private gallery with photo upload via QR code. No login, ever. 

- **For vendors:** a vendor portal to publish a marketplace listing, receive booking requests from weddings, and collect reviews. 

- **Market:** all of India, all communities. Event types and wording must not assume one tradition. 

### Goals 

1. One place to plan a single wedding, shared by the couple and their family. 

2. Event-wise guest invitations with per-event RSVP, automatic reminders, seating and gate check-in. 

3. Zero friction for guests, including relatives who are not tech-savvy. 

4. One shared gallery where guests contribute their own photos. 

Page 1 of 30 

Make My Marriage — Product Requirements Document (v1) 

5. Clear control of money: budgets, spending, vendor payment schedules and family cost splits. 

6. A vendor marketplace where families find, book and review wedding vendors. 

### Non-goals for v1 

- Professional planners managing multiple weddings, or users switching between weddings. 

- WhatsApp or SMS sending through an API, and in-house live streaming. 

- Online payments to vendors through the platform. 

Drag-and-drop website building and real-time collaborative editing. 

## 2. Users and terminology 

The product has three kinds of people: **Members** plan one wedding, **Vendors** run a marketplace listing, and **Guests** never log in. 

```
flowchart TD
```

```
  W[Wedding] --> M[Members<br/>have accounts]
  W --> G[Guests<br/>no account, no role]
  M --> A[Admin]
  M --> MG[Manager]
  G --> L[Access by unique links<br/>invite, website, gallery]
  VP[Vendor portal] --> VA[Vendor<br/>own account]
  VA -. booking requests .-> W
```

|Term|Who|Account|Typical people|
|---|---|---|---|
|Wedding|The single wedding being<br>planned|—|e.g. Priya & Aarav|
|Member|Anyone who logs in to plan|Yes (name, email,<br>password)|Bride, groom, parents,<br>siblings, friends, coordinator|
|Admin|Member with full rights,<br>including member<br>management|Yes|Bride, groom, wedding<br>creator|



Page 2 of 30 

Make My Marriage — Product Requirements Document (v1) 

|Term|Who|Account|Typical people|
|---|---|---|---|
|Manager|Member with full rights<br>except member<br>management|Yes|Parents, siblings, cousins,<br>friends, coordinator|
|Vendor|A business listed on the<br>marketplace|Yes, separate<br>vendor portal|Photographers, caterers,<br>decorators, venues|
|Guest|Anyone invited to the<br>wedding|Never|Relatives, friends, colleagues|



### Account rules 

- A user belongs to exactly one wedding, and each wedding can have many members. The first user to sign up creates the wedding and becomes its Admin. 

- Other members join only through an Admin's email invite, and cannot create a wedding of their own. 

- Multiple Admins are allowed, so the bride and groom can both be Admins. 

- A wedding must always have at least one Admin. 

- Vendor accounts are separate: a vendor signs up through the vendor portal, can serve many weddings, and cannot use the same account as a wedding member. 

## 3. Permissions 

Admins and Managers share every wedding capability except managing members; guests act only through their links, and vendors only inside the vendor portal. 

|Capability|Admin|Manager|Guest (via link)|Vendor (portal)|
|---|---|---|---|---|
|View dashboard,<br>notifications, analytics|Yes|Yes|No|No|
|Manage events, tasks,|Yes|Yes|No|No|
|guests, seating|||||
|Manage budgets,|Yes|Yes|No|No|
|expenses, payment<br>schedules|||||



Page 3 of 30 

Make My Marriage — Product Requirements Document (v1) 

|Capability|Admin|Manager|Guest (via link)|Vendor (portal)|
|---|---|---|---|---|
|Manage vendors, send<br>booking requests, write<br>reviews|Yes|Yes|No|No|
|Send invitations;<br>configure automatic<br>reminders|Yes|Yes|No|No|
|Check guests in at the<br>venue|Yes|Yes|No|No|
|Manage website, photos,<br>live stream|Yes|Yes|No|No|
|Approve or reject guest<br>photos|Yes|Yes|No|No|
|Edit wedding details|Yes|Yes|No|No|
|Invite and remove<br>members|Yes|No|No|No|
|Promote Manager to<br>Admin, demote Admin to<br>Manager|Yes|No|No|No|
|Delete the wedding|Yes|No|No|No|
|RSVP for own invited<br>events; show entry QR|—|—|Yes|No|
|View public website|Yes|Yes|Yes|Yes|
|View gallery and upload<br>photos|Yes|Yes|Yes (uploads<br>need approval)|No|
|Manage own listing;<br>accept or decline<br>bookings|No|No|No|Yes|
|See a wedding's data|Own<br>wedding|Own<br>wedding|Own invitation<br>only|Only booking<br>details sent to<br>them|



Page 4 of 30 

Make My Marriage — Product Requirements Document (v1) 

### Member management rules 

The last Admin cannot be demoted, removed, or leave the wedding. 

- Removing a member keeps everything they created; their assigned tasks become unassigned. Removal affects only this wedding: the person's account is detached and they are free to join or create another wedding. 

- The Settings → Members page is hidden from Managers entirely. 

## 4. Navigation 

The logged-in app uses a left sidebar; each feature page holds its own settings, and Settings keeps only wedding-wide items. 

|Sidebar item|Sub-pages|Module|
|---|---|---|
|Dashboard|—|5.2|
|Events|—|5.3|
|Tasks|—|5.4|
|Guests|Guest List · Invitations · RSVP · Reminders · Seating<br>· Check-in|5.5, 5.6, 5.13, 5.14|
|Money|Budget · Expenses · Payments|5.7|
|Vendors|My Vendors · Marketplace · Bookings · Discover<br>(Google)|5.8|
|Wedding Website|— (includes theme, URL, sections, preview)|5.9|
|Photos|Gallery · Guest Uploads · QR Code|5.10|
|Live Stream|—|5.11|
|Analytics|—|5.16|
|Settings|Wedding Details · Members (Admin only) · Delete<br>Wedding|5.12|



A notification bell sits in the top bar on every page (5.15). 

Vendors use a separate vendor portal with its own navigation: Listing · Booking Requests · Reviews · Account. 

Page 5 of 30 

Make My Marriage — Product Requirements Document (v1) 

The sidebar header shows "Make My Marriage" and the couple's names. My Account (name, email, password) sits at the bottom of the sidebar. 

On mobile the sidebar collapses into a menu; the whole app must be usable on a phone. 

## 5. Functional requirements 

Sixteen modules make up v1; each lists its fields, actions and rules. 

### 5.1 Authentication and wedding setup 

Members sign up with name, email and password; the first member creates the wedding and becomes Admin. 

#### **Sign up and log in** 

- Sign up with name, email and password; log in with email and password. 

- Email verification, and forgot / reset password by email. 

- Guests never see sign-up or login screens. 

#### **Invited members** 

- An Admin invites a person by email; the email contains a join link. 

- The invitee signs up through that link and is attached to the wedding as a Manager. Invites expire after 7 days; Admins can resend or cancel pending invites. 

- An email that already belongs to another wedding cannot accept the invite. 

#### **Create wedding (first-time setup)** 

|Field|Required|Example|
|---|---|---|
|Bride name|Yes|Priya|
|Groom name|Yes|Aarav|
|Wedding title|Yes|Priya weds Aarav|
|Wedding date|Yes|14 February|
|Wedding city|Yes|Jaipur|
|Location / venue|Yes|Rambagh Palace|
|Cover image|No|Uploaded image|



Page 6 of 30 

Make My Marriage — Product Requirements Document (v1) 

|Field|Required|Example|
|---|---|---|
|Description|No|Short welcome message|



After setup the member lands on the Dashboard. A user who already belongs to a wedding is never shown the create-wedding flow. 

### 5.2 Dashboard 

The dashboard is the landing page after login and summarises everything inside the wedding. 

**Header:** cover image, couple names, wedding date and city, and a countdown such as "42 days until your wedding". After the date passes it reads "Married 12 days ago". 

|Card|Shows|Links to|
|---|---|---|
|Events|Total events|Events|
|Tasks|Completed of total (e.g. 18 of 45), overdue count|Tasks|
|Guests|Parties invited and expected headcount|Guest List|
|RSVPs|Responses received vs pending|RSVP|
|Expenses|Total spent vs total budget (₹)|Expenses|
|Vendors|Vendors added|My Vendors|
|Photos|Guest photos pending approval|Guest Uploads|



**Upcoming events:** the next 3 events with date, time and venue. 

**Rules:** data loads on page open, with no live updates. The notification bell (5.15) and the Analytics page (5.16) hold alerts and charts; the dashboard stays a summary. Admins and Managers see the same dashboard. A "Payments due this week" list sits under Upcoming events. 

### 5.3 Events 

Events are a core entity: tasks, guest invitations, vendors, photo albums and the website all link to them. 

Page 7 of 30 

Make My Marriage — Product Requirements Document (v1) 

**Event types:** Engagement, Roka, Mehndi, Haldi, Sangeet, Cocktail, Wedding, Reception, and Custom (free-text name, e.g. Nikah, Walima, Anand Karaj, Tilak). 

|Field|Required|Example|
|---|---|---|
|Event type|Yes|Mehndi|
|Event name|Yes|Mehndi Night|
|Date|Yes|12 February|
|Start time|Yes|4:00 PM|
|End time|No|9:00 PM (may fall after<br>midnight)|
|Venue name|No (shows "Venue to be<br>announced")|Royal Garden|
|Address|No|Full address|
|Description|No|Free text|
|Dress code|No|Green traditional|
|Cover image|No|Uploaded image|
|Show on<br>website|Yes (default on)|Off for a private family roka|



**Actions:** create, edit and delete events; list view in date order; an event detail page showing its linked guests and headcount, tasks, vendors and album. 

#### **Rules** 

- Events can fall on any date, including months before the wedding date. 

- Creating an event also creates its photo album. 

- Deleting an event shows what is linked and asks for confirmation. Its invitations and RSVPs are deleted; tasks, expenses and vendors lose the link but remain; its photos move to the General album. 

### 5.4 Tasks 

Tasks are an internal checklist visible only to members. 

Page 8 of 30 

Make My Marriage — Product Requirements Document (v1) 

|Field|Required|Example|
|---|---|---|
|Title|Yes|Finalize photographer|
|Description|No|Compare three quotes|
|Due date|No|15 September|
|Status|Yes|To Do · In Progress · Completed|
|Priority|Yes (default Medium)|Low · Medium · High|
|Assigned member|No|Rahul|
|Related event|No|Wedding|



**Views:** All tasks, My tasks, Completed tasks, Tasks by event. 

**Filters:** assigned member, event, status, priority. 

#### **Rules** 

- Default sort is by due date, with undated tasks last. 

- Tasks past their due date and not completed are marked Overdue. 

- Removing a member unassigns their tasks; deleting an event removes only the link. 

- No Kanban board, subtasks, dependencies or reminders in v1. 

### 5.5 Guest list and event-wise invitations 

One guest record is one invited party, such as "Rajesh Sharma, up to 4 guests"; family members are not added individually. 

|Field|Required|Example|
|---|---|---|
|Name|Yes|Rajesh Sharma|
|Phone|No|+91 98xxxxxx10 (defaults to +91)|
|Email|No|rajesh@example.com|
|Guests allowed|Yes|4|
|Invited events|Yes (at least one)|Sangeet, Wedding, Reception|
|Notes|No|Arriving from Jaipur|



Page 9 of 30 

Make My Marriage — Product Requirements Document (v1) 

|Field|Required|Example|
|---|---|---|
|Invite link|Auto|Unique, unguessable token|



RSVP status and number attending are stored **per guest, per event** (see 5.6). 

#### **Event-wise invitations** 

- When adding or editing a guest, a member ticks the events that guest is invited to. 

- Each event page shows its own guest list, responses and expected headcount. 

- The guest list can be filtered by event, e.g. everyone invited to the Sangeet. 

- "Guests allowed" is one number per guest and applies to every event they are invited to. 

**Actions:** add, edit and delete guests; search by name or phone; filter by event and RSVP status; copy or share each guest's link. 

**Totals shown:** parties invited, responses received, pending responses and expected headcount, both overall and per event. 

#### **Rules** 

- Adding a phone number already used by another guest shows a duplicate warning. Removing a guest from an event deletes their RSVP for that event. 

- Adding a new event invites nobody automatically. 

- Bulk import from Excel/CSV: members download a template (name, phone, email, guests allowed, invited events), upload it, review a preview that flags errors and duplicate phone numbers, then confirm the import. 

### 5.6 Invitations, WhatsApp share and RSVP 

Each guest's unique link opens their personal invitation, where they RSVP separately for each event they are invited to. 

**Invitation page** (details in section 6) 

- URL format: `makemymarriage.com/i/<token>` ; no login. 

- Shows the greeting, the guest's name, and only their invited events. 

- Uses the same theme as the wedding website. 

#### **Email invitations and reminders** 

Send the invitation email to one guest, selected guests, or all guests with an email. 

Page 10 of 30 

Make My Marriage — Product Requirements Document (v1) 

- Send a reminder to everyone who has not responded, with one click, or to individual guests. 

- Members can send manually at any time, alongside the automatic reminders below. The app records when each invitation and reminder email was sent. 

#### **Automatic reminders** 

- Turned on per wedding from Guests → Reminders; off by default. 

- RSVP reminder: emailed to guests with no response for an event, 14 and 3 days before it by default; members can change the days. 

- Event reminder: emailed to attending guests the day before each event, with time, venue, map link and dress code. 

- Only guests with an email receive automatic reminders; a list shows guests without email so members can share on WhatsApp manually. 

- Each guest receives at most one automatic email per day, and can unsubscribe with one click. 

- A reminder log shows every automatic email sent, to whom and when. 

#### **WhatsApp share (no API)** 

- Every guest row has a Share on WhatsApp button using WhatsApp's standard share link. 

- With a phone number saved, it opens a chat with that guest; without one, it opens the contact picker. 

- Pre-filled message: "Dear Rajesh Sharma, we would love to have you celebrate our wedding with us! View your invitation here: <link> — Priya & Aarav". 

- Members can edit the default message once for the whole wedding, e.g. to write it in Hindi. 

- Tapping the button records "Shared via WhatsApp"; delivery cannot be confirmed. A Copy link button supports SMS or any other channel. 

#### **RSVP rules** 

- Per event, the guest chooses Attending or Not Attending, and if attending, how many people. 

- Number attending must be between 1 and Guests allowed. 

- Guests can change their response through the same link until that event's start time; after that, the event's RSVP is locked and shown read-only. Members can still edit it on the guest's behalf. 

Page 11 of 30 

Make My Marriage — Product Requirements Document (v1) 

**RSVP page for members:** per event, a table of guests with status and headcount, a Not yet responded list feeding the reminder action, and CSV export of headcounts for caterers. 

### 5.7 Money: budget, expenses and payments 

Money tracking covers the budget, every expense, vendor payment schedules, and how costs are split between the two families. 

|Field|Required|Example|
|---|---|---|
|Title|Yes|Photographer advance|
|Amount (₹)|Yes|50,000|
|Date|Yes|10 January|
|Category|Yes|Photography|
|Related event|No|Wedding|
|Related vendor|No|Pixel Photography|
|Notes|No|Paid by UPI|



**Categories:** Venue, Catering, Decoration, Photography, Clothing, Jewellery, Entertainment, Travel, Gifts, Invitations, Miscellaneous. 

**Expenses page:** total spent, total per category and per event, above a full expense list filterable by category, event, vendor and payer. 

#### **Rules** 

- Amounts are in rupees only, positive, with up to 2 decimal places. 

- Deleting a linked event or vendor keeps the expense and its amount, removing only the link. 

#### **Budget** 

- Set an overall wedding budget, plus optional budgets per category and per event. The Budget page shows budget, spent, remaining and percentage used for each category and event. 

- Over-budget lines are highlighted, and a notification fires when spending passes 90% and 100% of a budget. 

Page 12 of 30 

Make My Marriage — Product Requirements Document (v1) 

Budgets are optional; with none set, the module works as a plain expense tracker. No automatic spending recommendations in v1. 

#### **Payment schedules** 

- For any vendor, members add installments with a label (e.g. Advance, Final), amount and due date. 

- Installment status is Upcoming, Due, Overdue or Paid. 

- Marking an installment Paid creates a linked expense with that amount and date. The Payments page lists all installments by due date; each vendor shows total cost, paid so far and balance. 

- Notifications fire 3 days before an installment is due and when it becomes overdue. 

#### **Cost splits between families** 

- Each expense has a Paid by field: Bride's family, Groom's family, Couple, or Shared. Shared expenses split by percentage or fixed amount across the three payers, e.g. 50% / 50%. 

- A default split can be set per category, e.g. Catering 50 / 50, and overridden per expense. 

- A Splits summary shows each payer's total contribution, overall and per category. 

### 5.8 Vendors 

Vendors has four parts: My Vendors (the family's chosen vendors), the Marketplace of vendors with their own accounts, Bookings between the two, and Discover, a Google Places search for vendors not yet on the marketplace. 

#### **My Vendors** 

|Field|Required|Example|
|---|---|---|
|Vendor name|Yes|Pixel Photography|
|Category|Yes|Photographer|
|Phone|No|+91 98xxxxxx21|
|Email|No|hello@pixelphoto.in|
|Address|No|Filled from Discover when available|



Page 13 of 30 

Make My Marriage — Product Requirements Document (v1) 

|Field|Required|Example|
|---|---|---|
|Total cost (₹)|No|1,50,000|
|Related events|No|Haldi, Wedding, Reception|
|Notes|No|Includes drone shots|



**Categories:** Photographer, Videographer, Venue, Caterer, Decorator, DJ, Makeup Artist, Mehndi Artist, Pandit / Priest / Officiant, Choreographer, Wedding Planner, Florist, Transport, Other. 

- Add, edit and delete vendors; filter by category and event; tap to call or email. 

- Each vendor shows "Spent so far", the sum of expenses linked to it, next to its total cost. 

- Each event page lists its vendors. 

- Payment schedules for each vendor are managed in Money (5.7). 

#### **Vendor portal (vendor side)** 

- Vendors sign up with business name, email, password and phone, then verify their email. 

- Listing fields: business name, category, cities served, description, starting price (₹), up to 20 photos, phone, email, and website or Instagram link. 

- The Make My Marriage team approves each listing before it goes live; vendors can pause a listing at any time. 

- The Booking Requests inbox shows each request's events, dates, city, expected headcount and message; vendors can Quote, Accept or Decline. 

- Vendors see only what a wedding sends in a request, never its guest list or other data. 

- The Reviews page shows ratings received; vendors can post one public reply per review. 

#### **Marketplace and bookings (member side)** 

- Browse approved listings by category and city (defaulting to the wedding city), filter by price range, and sort by rating or price. 

- A listing page shows photos, description, starting price, cities served, rating and reviews. 

Page 14 of 30 

Make My Marriage — Product Requirements Document (v1) 

- Send a booking request by choosing events and adding a message; it carries event dates, city and expected headcount. 

- The Bookings page tracks each request as Sent, Quoted, Accepted, Declined or Cancelled. 

- An accepted booking adds the vendor to My Vendors, linked to the chosen events, with the agreed amount as total cost. 

- After the vendor's last linked event, members can leave one 1–5 star rating and written review per vendor. 

No online payments or commission collection in v1 (open question Q7). 

#### **Internal admin** 

- A basic internal screen lets the Make My Marriage team approve, reject or suspend listings and remove abusive reviews. 

#### **Discover Vendors** 

- Choose a category; location defaults to the wedding city and can be changed. Results come from the Google Places API: name, rating and review count, address, phone, and an Open in Google Maps link. 

- "Add to My Vendors" opens the vendor form pre-filled with name, category, phone and address. 

- Results carry the "Powered by Google" attribution Google requires. 

- Searches are cached briefly and capped per wedding per day to control API cost. 

- Discover stays available for vendors not on the marketplace; results are clearly labelled as Google results, separate from marketplace listings. 

### 5.9 Wedding website and themes 

Every wedding gets a public mini website generated from its own data, rendered in one of three themes. 

**URL:** `makemymarriage.com/<slug>` , e.g. `/priya-weds-aarav` . The slug is suggested from the couple's names, editable by members, unique across all weddings, and limited to lowercase letters, numbers and hyphens. 

Page 15 of 30 

Make My Marriage — Product Requirements Document (v1) 

|Section|Content|Source|Shown when|
|---|---|---|---|
|Hero|Cover image, "Priya & Aarav<br>are getting married", date|Wedding details|Always|
|Welcome|Short message from the<br>couple|Wedding description|Description exists|
|Events|Name, date, time, dress code|Events with Show on<br>website on|At least one event|
|Venues|Venue, address, Google Maps<br>link|Same events|At least one event|
|Photo<br>gallery|Link to the private gallery|Photos|Gallery section on|
|Live<br>wedding|Embedded YouTube player|Live stream|Live section on and<br>URL set|



#### **Themes** 

|Theme|Feel|
|---|---|
|Classical Indian|Reds and golds, traditional motifs, ornate serif<br>fonts|
|Minimal Elegant|Soft neutrals, generous white space, refined<br>typography|
|Modern Celebration|Bright colours, bold type, playful layout|



**Members can:** turn the website on or off, choose and switch themes without losing content, show or hide the Gallery and Live sections, edit the slug, and preview before sharing. 

#### **Rules** 

- The website has no RSVP form; RSVP happens only through each guest's personal link. Sites are hidden from search engines (noindex) by default. 

- Every theme must render every section and handle missing content, such as no cover image. 

Page 16 of 30 

Make My Marriage — Product Requirements Document (v1) 

Out of scope: drag-and-drop editing, custom colours or fonts, custom domains, passwords. 

### 5.10 Photos: gallery, guest uploads and QR code 

The gallery is a private, link-only collection organised into event albums, which guests can add to by scanning one wedding QR code. 

#### **Gallery** 

- Private URL `makemymarriage.com/g/<token>` : no login, unguessable, noindex. One album per event, created automatically, plus a General album. 

- Members can bulk-upload into an album, delete photos, move photos between albums, download a photo or a whole album (zip), view the gallery as guests see it, and share the link. 

- Guests browse albums, view photos full-screen with swipe, and download individual photos. 

Previews are compressed thumbnails; originals load on tap. 

#### **Guest uploads** 

1. The guest scans the wedding QR code or opens the shared link. 

2. The page shows "Priya & Aarav — Share your photos" with Upload your photos and View wedding gallery. 

3. The guest optionally enters their name, e.g. "Sunita Bua". 

4. The guest picks an event album and selects multiple photos from their phone. 

5. A progress bar shows uploads; failed photos retry automatically on weak networks. 

6. A thank-you message says photos will appear once the couple approves them. Photos only in v1 (JPEG, PNG, HEIC, WebP), up to 25 MB each and 50 per upload. Uploads are rate-limited per device to prevent abuse. 

   - Members can turn guest uploads on or off at any time. 

#### **Moderation** 

- Guest photos stay Pending and invisible to guests until a member approves them. Guest Uploads shows the pending count and photos grouped by uploader and album. Members approve or reject individually or in bulk, including approve all from one uploader. 

Page 17 of 30 

Make My Marriage — Product Requirements Document (v1) 

- Approved photos go live in their album; rejected photos are permanently deleted. Photos uploaded by members skip moderation. 

- Pending photos count toward the storage limit, and those unreviewed for 60 days are deleted after a warning. 

#### **Wedding QR code** 

- One permanent QR code per wedding, opening the guest upload page. 

- Download as high-resolution PNG and SVG, or as a print-ready A4/A5 PDF poster in the wedding's theme with the text "Share your wedding photos — scan to upload". 

- Because the QR is printed on cards and table signs, it never changes by default; access is controlled with the uploads on/off switch. 

- An emergency link reset exists, with a warning that printed QR codes will stop working. Per-event QR codes are out of scope for v1. 

**Storage:** each wedding has a photo storage limit (see open question Q3). 

### 5.11 Live stream 

Live streaming uses a YouTube Live link embedded on the website; the product builds no streaming infrastructure. 

- Members paste a YouTube Live or video URL and turn the Live section on or off. The URL is validated as a YouTube link (youtube.com/live, youtube.com/watch, youtu.be). 

- The website shows "Watch the wedding live" with the embedded player; guests need no login. 

- After the stream ends, the same link plays YouTube's recording, labelled "Watch the wedding". 

- The page shows a tip: set the stream to Unlisted and allow embedding in YouTube settings. 

- One live link per wedding in v1. 

### 5.12 Settings and member management 

- Settings holds only wedding-wide items; feature settings live on each feature's own page. 

Page 18 of 30 

Make My Marriage — Product Requirements Document (v1) 

|Section|Contents|Access|
|---|---|---|
|Wedding Details|Bride, groom, title, date, city, venue, cover image,<br>description|Admin, Manager|
|Members|Member list with roles; invite by email; resend or<br>cancel invites; remove; promote; demote|Admin only|
|Delete Wedding|Permanently deletes the wedding and all its data<br>after typing the wedding title to confirm|Admin only|
|My Account|Own name, email, password (bottom of sidebar)|Every member|



- Changes to wedding details update the dashboard, invitations, website and QR poster automatically. 

Promote and demote take effect immediately; the last Admin is protected (section 3). 

### 5.13 Seating plans 

Seating is planned per event by placing guest parties at named tables. 

- Members create tables for an event with a name or number and a capacity, e.g. "Table 7, 10 seats". 

- Parties invited to the event are assigned to tables by drag-and-drop on desktop, or a picker on mobile. 

- A party takes seats equal to its number attending, or its guests allowed if it has not responded yet. 

- A party can be split across two tables when needed. 

- Over-capacity tables are highlighted, and an Unseated list shows attending parties without a table. 

- Export the seating chart as a table-wise PDF for printing, or as CSV. 

- A per-event toggle (off by default) shows "Your table: 7" on the guest's invitation page and entry QR. 

- Drawing a floor plan is out of scope; tables appear as a grid of cards. 

### 5.14 QR check-in at venue 

Every attending party gets an entry QR per event, which members scan at the gate to record arrivals. 

Page 19 of 30 

Make My Marriage — Product Requirements Document (v1) 

- Each invitation (guest × event) has a unique entry QR, shown on the invitation page once the guest RSVPs Attending, and included in the event reminder email. 

- Members open Guests → Check-in on a phone, choose the event, and scan with the camera. 

- A scan shows the party name, number attending, guests allowed, table and notes; the member enters how many arrived and taps Check in. 

- Guests without their QR are found by name or phone search. 

- A repeat scan shows "Already checked in at 7:42 PM, 3 people". 

- A party not invited to this event shows "Not on the list for this event"; members can still admit them as a walk-in. 

- A counter shows arrived vs expected headcount, refreshing every 15 seconds. Scans made without signal are queued on the phone and synced when back online. Gate volunteers must be members; Admins can invite them as Managers. 

### 5.15 Notification centre 

A bell in the top bar collects in-app alerts about activity in the wedding. 

|Notification|Sent to|
|---|---|
|New or changed RSVP|All members|
|Guest photos waiting for approval (grouped, at<br>most hourly)|All members|
|Task assigned to you|Assignee|
|Your task is due tomorrow, or overdue|Assignee|
|Payment installment due in 3 days, or overdue|All members|
|Budget passed 90% or 100%|All members|
|Vendor quoted, accepted or declined a booking|All members|
|Member joined or was removed|Admins|



- The bell shows an unread count; the panel lists newest first, and each item opens its source page. 

- Mark one or all as read; each member can mute notification types in My Account. In-app only in v1; the panel refreshes every 60 seconds and on page load. 

Page 20 of 30 

Make My Marriage — Product Requirements Document (v1) 

Vendors get their own portal notifications for new booking requests and new reviews. Notifications older than 90 days are deleted. 

### 5.16 Analytics 

One Analytics page turns existing wedding data into charts; it needs no extra data entry. 

|Chart|Type|Shows|
|---|---|---|
|Spending by category|Grouped bar|Budget vs spent per category|
|Spending over time|Line|Cumulative spend by week|
|Contribution by payer|Bar|Bride's family, groom's family, couple|
|RSVP by event|Stacked bar|Attending, not attending, pending|
|Headcount by event|Bar|Expected vs checked in|
|Task progress|Line|Completed tasks over time|
|Photos by event|Bar|Approved photos, member vs guest|



Filter by event and date range. 

Each chart downloads as PNG, and its data as CSV. 

No custom report builder in v1. 

## 6. Guest-facing experiences 

Guests use three link-based pages, none needing an account, all built mobile-first for relatives opening links from WhatsApp. 

|Page|URL|Access|Purpose|
|---|---|---|---|
|Personal|`/i/<guest token>`|Private, one per|See invited events, RSVP|
|invitation||guest|per event|
|Wedding|`/<slug>`|Public, noindex|Events, venues, gallery|
|website|||link, live stream|
|Gallery and|`/g/<token>`(also the|Private, one per|Browse albums, upload|
|upload|QR code)|wedding|photos|



Page 21 of 30 

Make My Marriage — Product Requirements Document (v1) 

##### `flowchart LR` 

```
  A[Member shares link<br/>email / WhatsApp] --> B[Guest
opens<br/>invitation]
  B --> C[RSVP per event]
  C --> D[Confirmation]
  E[Guest scans QR<br/>at venue] --> F[Upload photos]
  F --> G[Pending approval]
  G --> H[Visible in gallery]
```

### Invitation page example 

"Dear Rajesh Sharma & family — Priya & Aarav invite you to celebrate their wedding." 

|Event|Date and time|Venue|Response|
|---|---|---|---|
|Sangeet|11 Feb, 7:00 PM|Royal Garden|Attending, 4|
|Wedding|12 Feb, 8:00 PM|Rambagh Palace|Attending, 3|
|Reception|13 Feb, 7:00 PM|Rambagh Palace|Not attending|



### Guest experience requirements 

- Load in under 3 seconds on a mid-range Android phone on 4G. 

- Large tap targets and plain wording; no jargon such as "RSVP" without explanation. An invalid or reset link shows a friendly message, never an error page. 

- The invitation page uses the wedding's website theme, and shows an entry QR code for each event the guest is attending (5.14). 

## 7. Data model 

Every record below the Wedding carries its wedding id, so all queries are scoped to one wedding. 

Page 22 of 30 

Make My Marriage — Product Requirements Document (v1) 

##### `flowchart TD` 

```
  U[User] --> WM[WeddingMember<br/>role: Admin/Manager]
  WM --> W[Wedding]
  W --> E[Event]
  W --> T[Task]
  W --> G[Guest]
  W --> V[Vendor]
  W --> X[Expense]
  W --> AL[Album]
  G --> I[Invitation<br/>guest x event + RSVP]
  AL --> P[Photo]
```

|Entity|Key fields|Links|
|---|---|---|
|User|name, email, password hash,<br>email verified|One WeddingMember (unique)|
|WeddingMember|role (Admin / Manager), joined at,<br>muted notification types|User, Wedding|
|MemberInvite|email, token, status, expires at|Wedding, invited by member|
|Wedding|bride, groom, title, date, city,<br>venue, cover, description,<br>website slug, theme, website on,<br>section toggles, YouTube URL,<br>gallery token, uploads on,<br>WhatsApp message, overall<br>budget|—|
|Event|type, name, date, start, end,<br>venue, address, description,<br>dress code, cover, show on<br>website, show table to guests|Wedding|
|Task|title, description, due date,<br>status, priority|Wedding; Event? ; assigned<br>WeddingMember?|
|Guest|name, phone, email, guests<br>allowed, notes, invite token,<br>reminders unsubscribed|Wedding|



Page 23 of 30 

Make My Marriage — Product Requirements Document (v1) 

|Entity|Key fields|Links|
|---|---|---|
|Invitation|RSVP status, number attending,<br>responded at, entry QR token|Guest, Event (unique pair)|
|SeatingTable|name, capacity|Event|
|SeatAssignment|seats|SeatingTable, Invitation|
|CheckIn|arrived count, checked in at,<br>walk-in name?|Invitation? , Event, checked in by<br>WeddingMember|
|ReminderSetting|on / off, RSVP reminder days,<br>event reminder on|Wedding|
|EmailLog|type (invite, reminder, event<br>reminder), sent at, status|Guest, Event?|
|Budget|scope (category or event),<br>amount|Wedding; Event?|
|Expense|title, amount, date, category, paid<br>by, notes|Wedding; Event? ; Vendor? ;<br>Installment?|
|ExpenseSplit|payer, percentage or amount|Expense|
|Installment|label, amount, due date, status,<br>paid on|Vendor|
|Vendor|name, category, phone, email,<br>address, total cost, notes|Wedding; many Events; Listing?|
|VendorAccount|business name, email, password<br>hash, phone, verified|—|
|Listing|category, cities, description,<br>starting price, photos, links,<br>status (Pending / Live / Paused /<br>Suspended)|VendorAccount|
|BookingRequest|events, message, quoted amount,<br>status|Wedding, Listing|
|Review|rating 1–5, text, vendor reply|Wedding, Listing (one per pair)|
|Notification|type, message, link, read at|WeddingMember or<br>VendorAccount|



Page 24 of 30 

Make My Marriage — Product Requirements Document (v1) 

|Entity|Key fields|Links|
|---|---|---|
|Album|name, is General|Wedding; Event?|
|Photo|file key, thumbnail key, size,<br>uploader type, uploader name,<br>status (Pending / Approved),<br>uploaded at|Album|



- `?` marks an optional link. Vendor-to-Event is many-to-many through a join table. 

## 8. Non-functional requirements 

The app must be secure by default, compliant with India's DPDP Act, and fast on midrange phones. 

### Security 

- Passwords hashed with a modern algorithm (bcrypt or Argon2); HTTPS everywhere. Every member request is checked against the member's wedding; one wedding's data is never readable by another. Vendor accounts can read only booking requests addressed to their listing. 

- Guest, gallery and invite tokens are random, at least 128 bits, and never sequential. Rate limits on login, password reset, RSVP submission and photo upload. 

### Privacy (DPDP Act 2023) 

- A plain-language privacy notice at sign-up and on guest pages. 

- Guest contact details are used only for this wedding's invitations and reminders. Deleting a wedding permanently removes all its data and photos within 30 days, including backups. 

- Members can export their wedding's data (guests, expenses, vendors) as CSV. 

### Performance and platform 

- Guest pages load in under 3 seconds on 4G; member pages in under 2 seconds on broadband. 

- Responsive on phones, tablets and desktops; latest two versions of Chrome, Safari, Edge and Firefox. 

Page 25 of 30 

Make My Marriage — Product Requirements Document (v1) 

- English interface in v1, with text stored so Hindi and regional languages can be added later. 

Data hosted in India. 

### Storage and email 

- Photos stored in object storage behind a CDN, with thumbnails generated on upload. Transactional email (invites, reminders, verification) through a delivery service with bounce tracking. 

## 9. Out of scope and future roadmap 

These items were discussed and deliberately left out of v1. 

|Item|Status|
|---|---|
|Multi-wedding planner workspace, switching<br>weddings|Not planned|
|Online payments to vendors, marketplace<br>commission collection|Later (see Q7)|
|WhatsApp / SMS sending via API|Later|
|Face recognition (find my photos)|Later — strongest gallery upgrade|
|Video uploads by guests|Later|
|Per-event QR codes and per-event live links|Later|
|Accommodation, travel, gifts / shagun tracking|Later|
|Floor-plan drawing for seating|Later|
|Email or push delivery of notifications|Later|
|Custom report builder|Later|
|Hindi and regional-language interface|Later|
|Custom domains, website passwords, more<br>themes|Later|
|Native mobile apps|Later|



Page 26 of 30 

Make My Marriage — Product Requirements Document (v1) 

## 10. Open questions and success metrics 

### Open questions 

- **~~Q1 — Guest import:~~** ~~include Excel/CSV bulk import in v1, given families often have 300 to 500 parties? Decided: yes, included in v1 (see 5.5).~~ 

- **Q2 — Bride / groom side tag:** add an optional side tag on guests for filtering? 

- **Q3 — Storage limit:** how many photos or GB per wedding, and does a paid plan raise it? **Q4 — Pricing:** is v1 free, or free with a paid per-wedding upgrade? 

- **~~Q5 — RSVP deadline:~~** ~~add an optional "RSVP by" date that locks responses? Decided: each event's RSVP stays open until that event's start time (see 5.6).~~ 

- **~~Q6 — Removed members:~~** ~~can a removed member's account join a different wedding later? Decided: yes; removal affects only this wedding (see section 3).~~ 

- **Q7 — Marketplace revenue:** free listings at launch, a paid listing fee, or a commission on bookings (which needs online payments)? 

- **Q8 — Vendor supply:** which categories and cities do we recruit vendors in before launch, so the marketplace is not empty? 

- **Q9 — v1 timeline:** with budgets, seating, check-in, notifications, analytics and the marketplace added, is the launch date or team size changing? 

### Success metrics 

|Area|Metric|Initial target (first 3<br>months)|
|---|---|---|
|Activation|Users who sign up, create a wedding and<br>create a first event|60% of sign-ups|
|Setup completion|Weddings with at least one event, one<br>task and one guest|50% of weddings|
|Collaboration|Average members per wedding|3|
|Invitations|Invitations created, invitations sent,<br>invitation open rate|70% of sent invitations<br>opened|
|RSVP|Invited parties who respond through<br>their link|50%|



Page 27 of 30 

Make My Marriage — Product Requirements Document (v1) 

|Area|Metric|Initial target (first 3<br>months)|
|---|---|---|
|Task management|Share of created tasks marked<br>Completed|40%|
|Vendor usage|Vendors added per wedding; Discover<br>searches per wedding|5 vendors|
|Gallery|Weddings using the gallery QR; approved|30% of weddings; 200|
|engagement|guest photos per active gallery|photos|



Targets are initial estimates to be revised after pilot weddings. 

## 11. Edge cases 

The system must never leave a wedding with zero Admins, and must warn before any destructive action that affects invitations. 

|Area|Situation|Expected behaviour|
|---|---|---|
|Members|Invited email already has an account<br>in another wedding|Invite cannot be accepted; the join<br>page explains the email already<br>belongs to a wedding|
|Members|Invited email has an account with no<br>wedding (e.g. previously removed)|The person logs in and joins as<br>Manager|
|Members|Invitation expires (after 7 days)|Join link shows "This invite has<br>expired"; an Admin can resend|
|Members|Admin removes a Manager|Access ends immediately; their<br>records stay; their tasks become<br>unassigned|
|Members|Multiple Admins exist|Any Admin can manage members,<br>including other Admins|
|Members|Admin tries to remove, demote or<br>leave as the final Admin|Blocked with "A wedding needs at<br>least one Admin"|



Page 28 of 30 

Make My Marriage — Product Requirements Document (v1) 

|Area|Situation|Expected behaviour|
|---|---|---|
|Guests|Guest opens an expired, reset or<br>invalid link|Friendly page: "This link isn't working<br>— please ask the couple for a new<br>one"|
|Guests|Guest submits the RSVP twice|The latest submission replaces the<br>earlier one; no duplicates are created|
|Guests|Guest changes their RSVP|Allowed until the event's start time,<br>then locked (5.6)|
|Guests|Guest tries to RSVP for more people<br>than allowed|Blocked with "You can bring up to 4<br>people"|
|Guests|Guest has no email address|Email sends skip them; members<br>share the link via WhatsApp or Copy<br>link|
|Events|Event falls after the main wedding<br>date (e.g. reception)|Allowed; events can be on any date|
|Events|Event venue not decided yet|Allowed; the event shows "Venue to<br>be announced" everywhere|
|Events|Event deleted after guests were<br>invited|Warning lists the invitations and<br>RSVPs that will be removed; requires<br>confirmation|
|Vendors|Vendor exists without an expense|Valid; Spent so far shows₹0|
|Vendors|Expense exists without a vendor|Valid; the vendor field is optional|
|Gallery|Guest uploads an unsupported file|That file is rejected with "Only photos<br>can be uploaded"; other files continue|
|Gallery|Upload fails midway|Automatic retry; still-failed photos<br>show a Retry button|
|Gallery|File exceeds 25 MB|That file is rejected with the size limit<br>shown; other files continue|
|Gallery|Guest scans the QR after the wedding|Gallery keeps working after the<br>wedding; if uploads are off, the page<br>says uploads are closed and still offers<br>View gallery|



Page 29 of 30 

Make My Marriage — Product Requirements Document (v1) 

## 12. Release plan 

All features belong to the v1 vision, but they are built and released incrementally in seven phases. 

|Phase|Focus|Scope|
|---|---|---|
|1|Foundation|Authentication, wedding creation, member<br>management, dashboard shell, sidebar navigation|
|2|Planning|Events, tasks|
|3|Guests|Guest list with Excel/CSV import, event-wise<br>invitations, RSVP, invitation and reminder emails,<br>WhatsApp sharing|
|4|Money and vendors|Expenses, budgets, payment schedules, cost<br>splits, My Vendors, Discover Vendors, marketplace<br>and vendor portal|
|5|Wedding experience|Wedding website, themes, YouTube live stream,<br>seating plans, QR check-in|
|6|Memories|Gallery, albums, guest photo uploads, moderation,<br>private sharing, wedding QR code|
|7|Production readiness|Notification centre, Analytics page, error handling,<br>security review, responsive polish, performance,<br>testing, product analytics, deployment, monitoring|



Each phase ships to pilot weddings before the next begins, so feedback shapes later phases. 

Page 30 of 30 

