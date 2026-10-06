import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  Camera,
  Check,
  CheckSquare,
  ChevronRight,
  Eye,
  FileText,
  Flower2,
  Handshake,
  IndianRupee,
  ListChecks,
  MapPin,
  Music,
  PartyPopper,
  ScanQrCode,
  Send,
  Timer,
  UserPlus,
  Users,
  type LucideIcon,
} from "lucide-react";

export const metadata: Metadata = { title: "Dashboard — Make My Marriage" };

// All figures below are mock data from the design. Replace with module queries
// (wedding, events, tasks, guests, money, vendors, photos) as those land.

const card = "rounded-xl bg-white p-4 shadow-sm transition-shadow hover:shadow-md";
const eyebrow = "text-[11px] font-medium tracking-wider text-ink-2/60 uppercase";

const quickActions: {
  label: string;
  hint: string;
  icon: LucideIcon;
  href: string;
  primary?: boolean;
}[] = [
  { label: "Add Guest", hint: "Invites & tables", icon: UserPlus, href: "/guests", primary: true },
  { label: "Add Expense", hint: "Log payment voucher", icon: IndianRupee, href: "/money" },
  { label: "Add Task", hint: "Assign runsheet item", icon: CheckSquare, href: "/tasks" },
  { label: "Send Reminder", hint: "RSVP broadcast", icon: Send, href: "/guests" },
];

const ceremonies = [
  {
    dow: "SUN",
    day: "14",
    time: "11:00 AM – 3:30 PM IST",
    dayLabel: "Day 01",
    tag: "Run-sheet locked",
    tagTone: "ok",
    title: "The Courtyard Mehendi & Welcome Lunch",
    venue: "Guava Garden & Poolside Terrace, The Leela Palace, Udaipur",
    attire: "Sunny Pastels & Leheriya",
    attending: 164,
    invited: 180,
  },
  {
    dow: "MON",
    day: "15",
    time: "7:00 PM onwards IST",
    dayLabel: "Day 02",
    tag: "Soundcheck 4:00 PM",
    tagTone: "warn",
    title: "Royal Sangeet & Musical Night",
    venue: "Grand Mewar Ballroom, The Leela Palace",
    attire: "Indo-Western & Glamour",
    attending: 412,
    invited: 480,
  },
  {
    dow: "TUE",
    day: "16",
    time: "4:30 PM – 8:00 PM IST",
    dayLabel: "Day 03 • Principal Ritual",
    tag: "Boat transfers scheduled",
    tagTone: "warn",
    title: "Lakeside Pheras & Wedding Ceremony",
    venue: "Jagmandir Island Palace, Lake Pichola",
    attire: "Traditional Formal & Regal",
    attending: 448,
    invited: 480,
  },
];

const rsvps = [
  {
    name: "Dr. Vikram & Sunita Mehta",
    meta: "Party of 2 • Udaipur Flight 6E-204",
    events: "All 5 Events",
    diet: "Strict Jain (No root)",
    transfer: "Innova #12 Assigned",
    transferTone: "text-bronze font-medium",
    status: "Confirmed",
  },
  {
    name: "Ananya Singhania",
    meta: "Solo • Road transfer from Ahmedabad",
    events: "Sangeet • Pheras",
    diet: "Gluten Free",
    transfer: "Self Arranged",
    transferTone: "text-ink-2/60",
    status: "Confirmed",
  },
  {
    name: "Rajesh & Kavita Chopra",
    meta: "Party of 4 • Awaiting Train Schedule",
    events: "Mehendi • Reception",
    diet: "No Restrictions",
    transfer: "Pending Details",
    transferTone: "text-ink-2",
    status: "Pending Arrival",
  },
];

const deliverables: {
  icon: LucideIcon;
  title: string;
  meta: string;
  action: "release" | "review" | "locked";
}[] = [
  {
    icon: Music,
    title: "DJ & Sound Setup Sign-off",
    meta: "Mewar Sound Labs • Tranche 2 (₹1,50,000)",
    action: "release",
  },
  {
    icon: Camera,
    title: "Candid Cinema Crew Shotlist",
    meta: "Stories by Joseph • Family portraits list",
    action: "review",
  },
  {
    icon: Flower2,
    title: "Mandap Floral Mockup",
    meta: "Udaipur Botanicals • 3D rendering approved",
    action: "locked",
  },
];

function CardFooter({
  href,
  label,
  trailing,
}: {
  href: string;
  label: string;
  trailing: React.ReactNode;
}) {
  return (
    <div className="-mx-4 mt-4 -mb-4 flex items-center justify-between rounded-b-xl bg-rose-50 px-4 py-2.5">
      <Link
        href={href}
        className="flex items-center gap-1 text-sm font-semibold text-plum hover:underline"
      >
        {label}
        <ArrowRight className="size-4" />
      </Link>
      {trailing}
    </div>
  );
}

export default function DashboardPage() {
  return (
    <main className="flex w-full flex-col pt-6">
      {/* Hero */}
      <section className="relative mb-6 w-full overflow-hidden rounded-xl bg-plum p-4 text-white shadow-xl sm:p-6 lg:p-10">
        <svg
          aria-hidden
          className="pointer-events-none absolute inset-0 size-full opacity-20"
          fill="none"
          preserveAspectRatio="none"
          viewBox="0 0 1200 480"
        >
          <path
            d="M150 480V240C150 140.589 230.589 60 330 60C429.411 60 510 140.589 510 240V480"
            stroke="#fed488"
            strokeDasharray="4 6"
            strokeWidth="1.5"
          />
          <path
            d="M210 480V270C210 203.726 263.726 150 330 150C396.274 150 450 203.726 450 270V480"
            stroke="#fff"
            strokeOpacity="0.4"
          />
          <path
            d="M720 480V180C720 97.1573 787.157 30 870 30C952.843 30 1020 97.1573 1020 180V480"
            stroke="#fed488"
          />
          <line stroke="#fed488" strokeOpacity="0.3" x1="0" x2="1200" y1="479" y2="479" />
          <circle cx="870" cy="180" r="140" stroke="#fff" strokeOpacity="0.2" strokeWidth="0.75" />
          <circle
            cx="330"
            cy="240"
            r="210"
            stroke="#fed488"
            strokeOpacity="0.25"
            strokeWidth="0.75"
          />
        </svg>

        <div className="relative z-10 flex flex-col justify-between gap-6 xl:flex-row xl:items-end">
          <div className="flex max-w-2xl flex-col">
            <div className="mb-2 flex items-center gap-1">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-medium tracking-wider text-honey uppercase backdrop-blur-md">
                <span className="size-1.5 rounded-full bg-honey" />
                Orchestration Active
              </span>
              <span className="font-mono text-xs tracking-wide text-line-soft">CONF-UDR-2025</span>
            </div>
            <h1 className="mb-1 font-serif text-5xl leading-none tracking-tight">
              Priya &amp; Aarav
            </h1>
            <p className="mb-4 font-serif text-xl text-rose-300/90 italic">
              December 14–17, 2025 • The Leela Palace &amp; Jagmandir Island, Udaipur
            </p>
            <div className="flex max-w-lg flex-col gap-1.5 pt-1">
              <div className="flex items-center justify-between text-[13px]">
                <span className="flex items-center gap-1.5 font-medium text-rose-300">
                  <CheckSquare className="size-4 text-honey" />
                  Readiness Score: 78%
                </span>
                <span className="font-mono text-xs font-medium text-honey">
                  +14 days ahead of scheduled milestones
                </span>
              </div>
              <div
                role="progressbar"
                aria-label="Readiness score"
                aria-valuenow={78}
                aria-valuemin={0}
                aria-valuemax={100}
                className="h-1.5 w-full overflow-hidden rounded-full bg-white/15"
              >
                <div className="h-full w-[78%] rounded-full bg-[#fed488]" />
              </div>
            </div>
          </div>

          <div className="flex shrink-0 flex-col items-start gap-4 rounded-xl bg-white/10 p-4 shadow-sm backdrop-blur-md sm:flex-row sm:items-center sm:self-start xl:self-auto">
            <div className="flex items-baseline gap-2">
              <span className="font-serif text-5xl leading-none">42</span>
              <span className="flex flex-col">
                <span className="text-xs font-semibold tracking-wider text-honey uppercase">
                  Days
                </span>
                <span className="text-[13px] text-rose-300/80">until your wedding</span>
              </span>
            </div>
            <div className="h-px w-full bg-white/20 sm:h-12 sm:w-px" />
            <div className="flex flex-col gap-1">
              <span className="font-mono text-xs tracking-wider text-line-soft uppercase">
                Upcoming Milestone
              </span>
              <span className="text-sm font-semibold">Ceremony 01: Mehendi</span>
              <span className="inline-flex items-center gap-1.5 font-mono text-xs text-honey">
                <Timer className="size-3.5" />
                T-minus 42d 14h 20m
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Quick actions */}
      <section aria-label="Quick actions" className="mb-10 grid grid-cols-2 gap-2 md:grid-cols-4">
        {quickActions.map(({ label, hint, icon: Icon, href, primary }) => (
          <Link
            key={label}
            href={href}
            className={`group flex items-center justify-between rounded-xl p-2 shadow-sm transition-all hover:shadow-md sm:px-4 sm:py-3.5 ${
              primary ? "bg-[#fed488] text-[#785a1a]" : "bg-white text-ink hover:bg-rose-50"
            }`}
          >
            <span className="flex min-w-0 items-center gap-2">
              <span
                className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${
                  primary ? "bg-white/60" : "bg-rose-200"
                }`}
              >
                <Icon className="size-5 transition-transform group-hover:scale-110" />
              </span>
              <span className="flex min-w-0 flex-col text-left">
                <span className="truncate text-sm leading-snug font-semibold">{label}</span>
                <span className="hidden truncate font-mono text-xs opacity-80 sm:inline">
                  {hint}
                </span>
              </span>
            </span>
            <ArrowRight className="size-[18px] opacity-60 transition-transform group-hover:translate-x-0.5" />
          </Link>
        ))}
      </section>

      {/* Telemetry */}
      <section className="mb-10">
        <div className="mb-4 flex items-baseline justify-between">
          <div>
            <h2 className="font-serif text-xl">Command Telemetry</h2>
            <p className="text-[13px] text-ink-2">Real-time status across planning workstreams</p>
          </div>
          <span className="flex items-center gap-1 font-mono text-xs text-bronze">
            <span className="size-2 animate-pulse rounded-full bg-bronze" />
            Sync active (3 min ago)
          </span>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          <div className={`${card} flex flex-col justify-between`}>
            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className={eyebrow}>Ceremonies</span>
                <PartyPopper className="size-5 text-plum" />
              </div>
              <div className="mb-1 flex items-baseline gap-2">
                <span className="font-serif text-2xl">5</span>
                <span className="text-[13px] text-ink-2">total functions</span>
              </div>
              <p className="text-[13px] text-ink-2">Haldi to Grand Reception</p>
            </div>
            <CardFooter
              href="/events"
              label="View run-sheets"
              trailing={
                <span className="rounded bg-rose-100 px-1.5 py-0.5 font-mono text-xs text-ink-2">
                  Dec 14-17
                </span>
              }
            />
          </div>

          <div className={`${card} flex flex-col justify-between`}>
            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className={eyebrow}>Tasks &amp; Milestones</span>
                <span className="rounded-full bg-[#ffdad6] px-2 py-0.5 text-[11px] font-medium text-[#93000a]">
                  3 overdue
                </span>
              </div>
              <div className="mb-1 flex items-baseline gap-2">
                <span className="font-serif text-2xl">
                  18 <span className="font-sans text-sm text-ink-2">/ 45</span>
                </span>
                <span className="text-[13px] text-ink-2">completed</span>
              </div>
              <div className="mt-2 mb-1 h-1.5 w-full overflow-hidden rounded-full bg-rose-100">
                <div className="h-full w-[40%] rounded-full bg-bronze" />
              </div>
              <span className="font-mono text-xs text-ink-2">40% velocity</span>
            </div>
            <CardFooter
              href="/tasks"
              label="Open task board"
              trailing={<ListChecks className="size-4 text-ink-2/60" />}
            />
          </div>

          <div className={`${card} flex flex-col justify-between`}>
            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className={eyebrow}>Guest Coverage</span>
                <Users className="size-5 text-plum" />
              </div>
              <div className="mb-1 flex items-baseline gap-2">
                <span className="font-serif text-2xl">
                  320 <span className="font-sans text-sm text-ink-2">/ 480</span>
                </span>
                <span className="text-[13px] font-medium text-bronze">66.7%</span>
              </div>
              <p className="text-[13px] text-ink-2">168 parties invited • 480 expected</p>
            </div>
            <CardFooter
              href="/guests"
              label="Manage guest list"
              trailing={<span className="font-mono text-xs text-ink-2/60">168 cards out</span>}
            />
          </div>

          <div className={`${card} flex flex-col justify-between`}>
            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className={eyebrow}>RSVP Verification</span>
                <span className="rounded-full bg-honey px-2 py-0.5 text-[11px] font-medium text-amber-deep">
                  High Return
                </span>
              </div>
              <div className="mb-1 flex items-baseline gap-2">
                <span className="font-serif text-2xl">248</span>
                <span className="text-[13px] font-medium text-bronze">Confirmed</span>
              </div>
              <p className="text-[13px] text-ink-2">72 awaiting reply • 24 declined</p>
            </div>
            <CardFooter
              href="/guests"
              label="Track dietary & arrival"
              trailing={<span className="font-mono text-xs text-ink-2/60">77.5% yes</span>}
            />
          </div>

          <div className={`${card} flex flex-col justify-between md:col-span-2`}>
            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className={eyebrow}>Financial Allocation</span>
                <span className="rounded bg-rose-100 px-2 py-0.5 font-mono text-xs font-medium text-ink-2">
                  Cap: ₹60,00,000
                </span>
              </div>
              <div className="mb-1 flex flex-col justify-between gap-2 sm:flex-row sm:items-baseline">
                <div className="flex items-baseline gap-2">
                  <span className="font-serif text-2xl">₹42,80,000</span>
                  <span className="text-[13px] text-ink-2">committed</span>
                </div>
                <span className="font-mono text-xs font-medium text-bronze">
                  ₹17,20,000 unallocated buffer
                </span>
              </div>
              <div className="my-2 flex h-2 w-full overflow-hidden rounded-full bg-rose-100">
                <div className="h-full w-[48%] bg-plum" title="Venues: 48%" />
                <div className="h-full w-[15%] bg-bronze" title="Food & Bev: 15%" />
                <div className="h-full w-[8%] bg-[#e9c176]" title="Production: 8%" />
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[11px] text-ink-2">
                <span className="flex items-center gap-1">
                  <span className="size-2 rounded-full bg-plum" />
                  Venues (48%)
                </span>
                <span className="flex items-center gap-1">
                  <span className="size-2 rounded-full bg-bronze" />
                  Food &amp; Bev (15%)
                </span>
                <span className="flex items-center gap-1">
                  <span className="size-2 rounded-full bg-[#e9c176]" />
                  Production (8%)
                </span>
              </div>
            </div>
            <CardFooter
              href="/money"
              label="Open financial ledger"
              trailing={
                <span className="font-mono text-xs font-medium text-bronze">71.3% Committed</span>
              }
            />
          </div>

          <div className={`${card} flex flex-col justify-between`}>
            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className={eyebrow}>Vendor Operations</span>
                <Handshake className="size-5 text-plum" />
              </div>
              <div className="mb-1 flex items-baseline gap-2">
                <span className="font-serif text-2xl">12</span>
                <span className="text-[13px] text-ink-2">partners on-board</span>
              </div>
              <p className="text-[13px] text-ink-2">9 contracted • 3 shortlisted in review</p>
            </div>
            <CardFooter
              href="/vendors"
              label="Review contracts"
              trailing={<FileText className="size-4 text-ink-2/60" />}
            />
          </div>

          <div className={`${card} flex flex-col justify-between`}>
            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className={eyebrow}>Live Guest Stream</span>
                <ScanQrCode className="size-5 text-bronze" />
              </div>
              <div className="mb-1 flex items-baseline gap-2">
                <span className="font-serif text-2xl">142</span>
                <span className="text-[13px] font-medium text-bronze">Pending queue</span>
              </div>
              <p className="text-[13px] text-ink-2">Live QR uploads from trial shoot</p>
            </div>
            <CardFooter
              href="/photos"
              label="Open gallery review"
              trailing={<span className="font-mono text-xs text-ink-2/60">Moderate</span>}
            />
          </div>
        </div>
      </section>

      {/* Run-of-show */}
      <section className="mb-6">
        <div className="mb-4 flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
          <div>
            <h2 className="font-serif text-2xl">Ceremonial Run-of-Show</h2>
            <p className="text-[13px] text-ink-2">
              Detailed itinerary, logistical parameters, and on-ground headcount
            </p>
          </div>
          <Link
            href="/events"
            className="flex items-center gap-0.5 text-sm font-semibold text-plum hover:underline"
          >
            View full schedule
            <ChevronRight className="size-4" />
          </Link>
        </div>

        <div className="flex flex-col gap-4">
          {ceremonies.map((c) => (
            <article key={c.title} className={`${card} lg:p-6`}>
              <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
                <div className="flex min-w-0 items-start gap-4">
                  <div className="flex size-16 shrink-0 flex-col items-center justify-center rounded-xl bg-rose-50 p-1 text-plum">
                    <span className="text-[11px] font-medium tracking-wider text-bronze uppercase">
                      {c.dow}
                    </span>
                    <span className="font-serif text-2xl leading-none">{c.day}</span>
                    <span className="font-mono text-[10px] text-ink-2/60">DEC</span>
                  </div>
                  <div className="flex min-w-0 flex-col">
                    <div className="mb-1 flex flex-wrap items-center gap-1">
                      <span className="font-mono text-xs font-medium text-bronze">{c.time}</span>
                      <span className="text-ink-2/60">•</span>
                      <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 text-[11px] font-medium text-ink">
                        <span className="size-1.5 rounded-full bg-bronze" />
                        {c.dayLabel}
                      </span>
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${
                          c.tagTone === "ok"
                            ? "bg-[#f2f7f2] text-forest"
                            : "bg-honey text-amber-deep"
                        }`}
                      >
                        {c.tag}
                      </span>
                    </div>
                    <h3 className="truncate font-serif text-xl">{c.title}</h3>
                    <p className="mt-1 flex items-center gap-1 truncate text-[13px] text-ink-2">
                      <MapPin className="size-4 shrink-0 text-ink-2/60" />
                      {c.venue}
                    </p>
                  </div>
                </div>

                <div className="flex shrink-0 flex-wrap items-center gap-4 pt-1 sm:flex-nowrap lg:justify-end lg:pt-0">
                  <div className="flex flex-col">
                    <span className="font-mono text-xs tracking-wider text-ink-2/60 uppercase">
                      Prescribed Attire
                    </span>
                    <span className="text-sm font-semibold">{c.attire}</span>
                  </div>
                  <div className="hidden h-8 w-px bg-rose-200 sm:block" />
                  <div className="flex flex-col">
                    <span className="font-mono text-xs tracking-wider text-ink-2/60 uppercase">
                      Attendance Status
                    </span>
                    <span className="text-sm font-semibold">
                      {c.attending} attending{" "}
                      <span className="font-mono text-[11px] font-normal text-ink-2">
                        ({c.invited} invited)
                      </span>
                    </span>
                  </div>
                  <Link
                    href="/events"
                    className="flex shrink-0 items-center gap-1 rounded-lg bg-rose-100 px-2 py-2 text-xs font-semibold text-ink transition-colors hover:bg-rose-200"
                  >
                    <Eye className="size-4" />
                    Run-sheet
                  </Link>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* RSVP + vendors */}
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div className="flex flex-col rounded-xl bg-white p-4 shadow-sm lg:col-span-7">
          <div className="mb-2 flex items-center justify-between">
            <div>
              <h3 className="font-serif text-xl">Recent RSVP Ingestion</h3>
              <p className="text-[13px] text-ink-2">
                Arrival logistics &amp; dietary notifications
              </p>
            </div>
            <button type="button" className="text-xs font-semibold text-plum hover:underline">
              Download CSV
            </button>
          </div>
          <div className="-mx-4 overflow-x-auto">
            <table className="w-full min-w-[500px] text-left text-[13px]">
              <thead>
                <tr className="bg-rose-50 text-[11px] font-medium tracking-wider text-ink-2 uppercase">
                  <th className="px-4 py-2.5">Guest / Party</th>
                  <th className="px-4 py-2.5">Ceremonies</th>
                  <th className="px-4 py-2.5">Special Diet</th>
                  <th className="px-4 py-2.5">Airport Transfer</th>
                  <th className="px-4 py-2.5 text-right">Status</th>
                </tr>
              </thead>
              <tbody>
                {rsvps.map((r) => (
                  <tr key={r.name} className="transition-colors hover:bg-rose-50/50">
                    <td className="px-4 py-3 font-medium">
                      {r.name}
                      <span className="block font-mono text-xs font-normal text-ink-2">
                        {r.meta}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">{r.events}</td>
                    <td className="px-4 py-3">
                      <span className="rounded bg-rose-100 px-2 py-0.5 font-mono text-[11px]">
                        {r.diet}
                      </span>
                    </td>
                    <td className={`px-4 py-3 font-mono text-xs ${r.transferTone}`}>
                      {r.transfer}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${
                          r.status === "Confirmed"
                            ? "bg-[#f2f7f2] text-forest"
                            : "bg-honey text-amber-deep"
                        }`}
                      >
                        {r.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex flex-col justify-between rounded-xl bg-white p-4 shadow-sm lg:col-span-5">
          <div>
            <div className="mb-2 flex items-center justify-between">
              <div>
                <h3 className="font-serif text-xl">Vendor Deliverables</h3>
                <p className="text-[13px] text-ink-2">Immediate action gates &amp; deposits</p>
              </div>
              <span className="font-mono text-xs text-ink-2/60">Next 7 days</span>
            </div>
            <ul className="mt-2 flex flex-col gap-2">
              {deliverables.map(({ icon: Icon, title, meta, action }) => (
                <li
                  key={title}
                  className="flex items-start justify-between gap-2 rounded-lg bg-rose-50 p-2"
                >
                  <div className="flex items-start gap-1">
                    <Icon className="mt-0.5 size-[18px] shrink-0 text-bronze" />
                    <div className="flex flex-col">
                      <span className="text-sm leading-tight font-medium">{title}</span>
                      <span className="font-mono text-xs text-ink-2">{meta}</span>
                    </div>
                  </div>
                  {action === "release" && (
                    <button
                      type="button"
                      className="shrink-0 rounded bg-plum px-2 py-1 text-[11px] font-semibold text-white hover:opacity-95"
                    >
                      Release
                    </button>
                  )}
                  {action === "review" && (
                    <button
                      type="button"
                      className="shrink-0 rounded bg-rose-100 px-2 py-1 text-[11px] font-semibold text-ink hover:bg-rose-200"
                    >
                      Review
                    </button>
                  )}
                  {action === "locked" && (
                    <span className="inline-flex shrink-0 items-center gap-1 font-mono text-xs font-medium text-forest">
                      <Check className="size-4" />
                      Locked
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
          <div className="mt-4 flex items-center justify-between pt-4 text-[13px] text-ink-2">
            <span>3 contracts due for milestone release</span>
            <Link href="/vendors" className="text-sm font-semibold text-plum hover:underline">
              Vendor hub →
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
