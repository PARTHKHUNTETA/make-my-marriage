import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowRight,
  CalendarPlus,
  CheckSquare,
  ChevronRight,
  Handshake,
  IndianRupee,
  ListChecks,
  ListPlus,
  MapPin,
  PartyPopper,
  Camera,
  Send,
  Timer,
  UserPlus,
  Users,
  type LucideIcon,
} from "lucide-react";

import { requireMember } from "@/lib/authz";
import { daysUntil, formatLongDate } from "@/lib/dates";
import { EVENT_TYPE_LABELS, eventStartsAt, formatTime } from "@/modules/events/schema";
import { listEvents } from "@/modules/events/service";
import { RSVP_LABELS } from "@/modules/guests/schema";
import { getStats, listEveryGuest } from "@/modules/guests/service";
import { formatRupees } from "@/lib/money";
import { getSummary as getMoneySummary } from "@/modules/money/service";
import { listTasks } from "@/modules/tasks/service";
import { getWedding } from "@/modules/wedding/service";

export const metadata: Metadata = { title: "Dashboard — Make My Marriage" };

// Everything on this page is read from the wedding's own data: events, tasks and guests. Money,
// vendors and photos show as "coming soon" until their release phases exist.

const card = "rounded-xl bg-white p-4 shadow-sm transition-shadow hover:shadow-md";
const eyebrow = "text-[11px] font-medium tracking-wider text-ink-2/60 uppercase";

const quickActions: {
  label: string;
  hint: string;
  icon: LucideIcon;
  href: string;
  primary?: boolean;
}[] = [
  {
    label: "Add Guest",
    hint: "Invite a party",
    icon: UserPlus,
    href: "/guests/new",
    primary: true,
  },
  { label: "Add Event", hint: "A new function", icon: CalendarPlus, href: "/events/new" },
  { label: "Add Task", hint: "Checklist item", icon: ListPlus, href: "/tasks/new" },
  { label: "Send Reminder", hint: "Emails to guests", icon: Send, href: "/guests/reminders" },
];

const dayParts = (date: Date) => ({
  dow: new Intl.DateTimeFormat("en-IN", { weekday: "short", timeZone: "Asia/Kolkata" }).format(
    date,
  ),
  day: new Intl.DateTimeFormat("en-IN", { day: "numeric", timeZone: "Asia/Kolkata" }).format(date),
  month: new Intl.DateTimeFormat("en-IN", { month: "short", timeZone: "Asia/Kolkata" }).format(
    date,
  ),
});
const shortDate = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  timeZone: "Asia/Kolkata",
});

function CardFooter({
  href,
  label,
  trailing,
}: {
  href: string;
  label: string;
  trailing?: React.ReactNode;
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

function SoonCard({ title, icon: Icon, text }: { title: string; icon: LucideIcon; text: string }) {
  return (
    <div className="flex flex-col justify-between rounded-xl border border-dashed border-line bg-white/60 p-4">
      <div className="mb-2 flex items-center justify-between">
        <span className={eyebrow}>{title}</span>
        <Icon className="size-5 text-ink-2/50" />
      </div>
      <p className="text-[13px] text-ink-2">{text}</p>
      <span className="mt-3 self-start rounded-full bg-rose-100 px-2.5 py-0.5 text-[11px] font-medium text-ink-2">
        Coming soon
      </span>
    </div>
  );
}

export default async function DashboardPage() {
  const ctx = await requireMember();
  const now = new Date();
  const [wedding, events, tasks, stats, guests, money] = await Promise.all([
    getWedding(ctx.weddingId),
    listEvents(ctx.weddingId),
    listTasks(ctx.weddingId, { view: "all" }, ctx.memberId),
    getStats(ctx.weddingId),
    listEveryGuest(ctx.weddingId),
    getMoneySummary(ctx.weddingId),
  ]);
  if (!wedding) notFound();

  const days = daysUntil(wedding.date);
  const daysShown = Math.abs(days);
  const upcoming = events.filter((e) => eventStartsAt(e) > now);
  const nextEvent = upcoming[0];
  const nextDays = nextEvent ? daysUntil(nextEvent.date) : null;

  const done = tasks.filter((t) => t.status === "completed").length;
  const overdue = tasks.filter((t) => t.overdue);
  const percentDone = tasks.length > 0 ? Math.round((done / tasks.length) * 100) : 0;
  const eventNames = new Map(events.map((e) => [e.id, e.name]));
  const statsByEvent = new Map(stats.perEvent.map((e) => [e.eventId, e]));

  const attendingParties = guests.filter((g) =>
    g.invitations.some((i) => i.rsvpStatus === "attending"),
  ).length;
  const declined = guests.filter(
    (g) => g.invitations.length > 0 && g.invitations.every((i) => i.rsvpStatus === "not_attending"),
  ).length;

  const recentReplies = guests
    .flatMap((g) =>
      g.invitations
        .filter((i) => i.rsvpStatus !== "pending" && i.respondedAt)
        .map((i) => ({ guest: g, invitation: i })),
    )
    .sort((a, b) => b.invitation.respondedAt!.getTime() - a.invitation.respondedAt!.getTime())
    .slice(0, 5);

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
            <h1 className="mb-1 font-serif text-5xl leading-none tracking-tight">
              {wedding.brideName} &amp; {wedding.groomName}
            </h1>
            <p className="mb-4 font-serif text-xl text-rose-300/90 italic">
              {formatLongDate(wedding.date)} •{" "}
              {wedding.venue ? `${wedding.venue}, ${wedding.city}` : wedding.city}
            </p>
            <div className="flex max-w-lg flex-col gap-1.5 pt-1">
              <div className="flex items-center justify-between text-[13px]">
                <span className="flex items-center gap-1.5 font-medium text-rose-300">
                  <CheckSquare className="size-4 text-honey" />
                  {tasks.length > 0 ? `${done} of ${tasks.length} tasks done` : "No tasks yet"}
                </span>
                <span className="font-mono text-xs font-medium text-honey">
                  {tasks.length > 0 ? `${percentDone}%` : "Add tasks to track your progress"}
                </span>
              </div>
              <div
                role="progressbar"
                aria-label="Tasks completed"
                aria-valuenow={percentDone}
                aria-valuemin={0}
                aria-valuemax={100}
                className="h-1.5 w-full overflow-hidden rounded-full bg-white/15"
              >
                <div
                  className="h-full rounded-full bg-[#fed488]"
                  style={{ width: `${percentDone}%` }}
                />
              </div>
            </div>
          </div>

          <div className="flex shrink-0 flex-col items-start gap-4 rounded-xl bg-white/10 p-4 shadow-sm backdrop-blur-md sm:flex-row sm:items-center sm:self-start xl:self-auto">
            <div className="flex items-baseline gap-2">
              <span className="font-serif text-5xl leading-none">{daysShown}</span>
              <span className="flex flex-col">
                <span className="text-xs font-semibold tracking-wider text-honey uppercase">
                  {daysShown === 1 ? "Day" : "Days"}
                </span>
                <span className="text-[13px] text-rose-300/80">
                  {days > 0
                    ? "until your wedding"
                    : days === 0
                      ? "it’s your wedding day"
                      : "since your wedding"}
                </span>
              </span>
            </div>
            <div className="h-px w-full bg-white/20 sm:h-12 sm:w-px" />
            <div className="flex flex-col gap-1">
              <span className="font-mono text-xs tracking-wider text-line-soft uppercase">
                Next event
              </span>
              <span className="text-sm font-semibold">
                {nextEvent ? nextEvent.name : "Nothing scheduled"}
              </span>
              <span className="inline-flex items-center gap-1.5 font-mono text-xs text-honey">
                <Timer className="size-3.5" />
                {nextEvent && nextDays !== null
                  ? nextDays > 1
                    ? `In ${nextDays} days`
                    : nextDays === 1
                      ? "Tomorrow"
                      : "Today"
                  : "Add an event"}
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

      {/* Status cards */}
      <section className="mb-10">
        <div className="mb-4">
          <h2 className="font-serif text-xl">Where things stand</h2>
          <p className="text-[13px] text-ink-2">Live from your events, tasks and guest list</p>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          <div className={`${card} flex flex-col justify-between`}>
            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className={eyebrow}>Events</span>
                <PartyPopper className="size-5 text-plum" />
              </div>
              <div className="mb-1 flex items-baseline gap-2">
                <span className="font-serif text-2xl">{events.length}</span>
                <span className="text-[13px] text-ink-2">
                  {events.length === 1 ? "event" : "events"}
                </span>
              </div>
              <p className="text-[13px] text-ink-2">
                {events.length === 0
                  ? "Add the mehndi, sangeet, wedding and more."
                  : events.length === 1
                    ? events[0]!.name
                    : `${events[0]!.name} to ${events[events.length - 1]!.name}`}
              </p>
            </div>
            <CardFooter
              href={events.length === 0 ? "/events/new" : "/events"}
              label={events.length === 0 ? "Add an event" : "View events"}
              trailing={
                events.length > 0 ? (
                  <span className="rounded bg-rose-100 px-1.5 py-0.5 font-mono text-xs text-ink-2">
                    {shortDate.format(events[0]!.date)}
                    {events.length > 1
                      ? ` – ${shortDate.format(events[events.length - 1]!.date)}`
                      : ""}
                  </span>
                ) : null
              }
            />
          </div>

          <div className={`${card} flex flex-col justify-between`}>
            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className={eyebrow}>Tasks</span>
                {overdue.length > 0 ? (
                  <span className="rounded-full bg-[#ffdad6] px-2 py-0.5 text-[11px] font-medium text-[#93000a]">
                    {overdue.length} overdue
                  </span>
                ) : null}
              </div>
              <div className="mb-1 flex items-baseline gap-2">
                <span className="font-serif text-2xl">
                  {done} <span className="font-sans text-sm text-ink-2">/ {tasks.length}</span>
                </span>
                <span className="text-[13px] text-ink-2">completed</span>
              </div>
              <div className="mt-2 mb-1 h-1.5 w-full overflow-hidden rounded-full bg-rose-100">
                <div
                  className="h-full rounded-full bg-bronze"
                  style={{ width: `${percentDone}%` }}
                />
              </div>
              <span className="font-mono text-xs text-ink-2">
                {tasks.length === 0 ? "No tasks yet" : `${percentDone}% done`}
              </span>
            </div>
            <CardFooter
              href={tasks.length === 0 ? "/tasks/new" : "/tasks"}
              label={tasks.length === 0 ? "Add a task" : "Open tasks"}
              trailing={<ListChecks className="size-4 text-ink-2/60" />}
            />
          </div>

          <div className={`${card} flex flex-col justify-between`}>
            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className={eyebrow}>Guests</span>
                <Users className="size-5 text-plum" />
              </div>
              <div className="mb-1 flex items-baseline gap-2">
                <span className="font-serif text-2xl">{stats.parties}</span>
                <span className="text-[13px] text-ink-2">
                  {stats.parties === 1 ? "party invited" : "parties invited"}
                </span>
              </div>
              <p className="text-[13px] text-ink-2">
                {stats.headcount} {stats.headcount === 1 ? "person" : "people"} expected so far
              </p>
            </div>
            <CardFooter
              href={stats.parties === 0 ? "/guests/new" : "/guests"}
              label={stats.parties === 0 ? "Add a guest" : "Manage guests"}
            />
          </div>

          <div className={`${card} flex flex-col justify-between`}>
            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className={eyebrow}>Replies</span>
              </div>
              <div className="mb-1 flex items-baseline gap-2">
                <span className="font-serif text-2xl">{stats.responded}</span>
                <span className="text-[13px] font-medium text-bronze">
                  of {stats.parties} replied
                </span>
              </div>
              <p className="text-[13px] text-ink-2">
                {attendingParties} coming • {declined} declined • {stats.pending} waiting
              </p>
            </div>
            <CardFooter
              href="/guests/rsvp"
              label="See replies"
              trailing={
                stats.parties > 0 ? (
                  <span className="font-mono text-xs text-ink-2/60">
                    {Math.round((stats.responded / stats.parties) * 100)}% replied
                  </span>
                ) : null
              }
            />
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className={`${card} flex flex-col justify-between`}>
            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className={eyebrow}>Budget &amp; expenses</span>
                <IndianRupee className="size-5 text-plum" />
              </div>
              <div className="mb-1 flex items-baseline gap-2">
                <span className="font-serif text-2xl">{formatRupees(money.total)}</span>
                <span className="text-[13px] text-ink-2">spent</span>
              </div>
              {wedding.overallBudget ? (
                <>
                  <div className="mt-2 mb-1 h-1.5 w-full overflow-hidden rounded-full bg-rose-100">
                    <div
                      className={`h-full rounded-full ${money.total > wedding.overallBudget ? "bg-destructive" : "bg-bronze"}`}
                      style={{
                        width: `${Math.min(100, Math.round((money.total / wedding.overallBudget) * 100))}%`,
                      }}
                    />
                  </div>
                  <p
                    className={`text-[13px] ${money.total > wedding.overallBudget ? "font-semibold text-destructive" : "text-ink-2"}`}
                  >
                    {money.total > wedding.overallBudget
                      ? `${formatRupees(money.total - wedding.overallBudget)} over your ${formatRupees(wedding.overallBudget)} budget`
                      : `${formatRupees(wedding.overallBudget - money.total)} left of ${formatRupees(wedding.overallBudget)}`}
                  </p>
                </>
              ) : (
                <p className="text-[13px] text-ink-2">
                  {money.total === 0 ? "No expenses yet." : "No budget set."}
                </p>
              )}
            </div>
            <CardFooter
              href={money.total === 0 && !wedding.overallBudget ? "/money/new" : "/money"}
              label={
                money.total === 0 && !wedding.overallBudget ? "Add an expense" : "Open expenses"
              }
            />
          </div>
          <SoonCard
            title="Vendors"
            icon={Handshake}
            text="Keep your vendors, contracts and payments in one place."
          />
          <SoonCard
            title="Photos"
            icon={Camera}
            text="Collect and approve photos from guests, in shared albums."
          />
        </div>
      </section>

      {/* Events */}
      <section className="mb-6">
        <div className="mb-4 flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
          <div>
            <h2 className="font-serif text-2xl">Coming up</h2>
            <p className="text-[13px] text-ink-2">Your next events and who is coming</p>
          </div>
          <Link
            href="/events"
            className="flex items-center gap-0.5 text-sm font-semibold text-plum hover:underline"
          >
            All events
            <ChevronRight className="size-4" />
          </Link>
        </div>

        {upcoming.length === 0 ? (
          <div className="rounded-xl bg-white p-8 text-center shadow-sm">
            <p className="font-serif text-xl text-ink">
              {events.length === 0 ? "No events yet" : "No upcoming events"}
            </p>
            <p className="mt-1 text-sm text-ink-2">
              {events.length === 0
                ? "Add your events and they will show up here."
                : "All your events have taken place."}
            </p>
            <Link
              href="/events/new"
              className="mt-4 inline-flex h-10 items-center rounded-lg bg-bronze px-5 text-sm font-semibold text-white hover:bg-bronze/90"
            >
              Add an event
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {upcoming.slice(0, 3).map((event) => {
              const { dow, day, month } = dayParts(event.date);
              const counts = statsByEvent.get(event.id);
              return (
                <article key={event.id} className={`${card} lg:p-6`}>
                  <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
                    <div className="flex min-w-0 items-start gap-4">
                      <div className="flex size-16 shrink-0 flex-col items-center justify-center rounded-xl bg-rose-50 p-1 text-plum">
                        <span className="text-[11px] font-medium tracking-wider text-bronze uppercase">
                          {dow}
                        </span>
                        <span className="font-serif text-2xl leading-none">{day}</span>
                        <span className="font-mono text-[10px] text-ink-2/60 uppercase">
                          {month}
                        </span>
                      </div>
                      <div className="flex min-w-0 flex-col">
                        <div className="mb-1 flex flex-wrap items-center gap-1">
                          <span className="font-mono text-xs font-medium text-bronze">
                            {formatTime(event.startTime)}
                            {event.endTime ? ` – ${formatTime(event.endTime)}` : ""}
                          </span>
                          <span className="text-ink-2/60">•</span>
                          <span className="inline-flex items-center rounded-full bg-rose-100 px-2 py-0.5 text-[11px] font-medium text-ink">
                            {EVENT_TYPE_LABELS[event.type]}
                          </span>
                        </div>
                        <h3 className="truncate font-serif text-xl">{event.name}</h3>
                        <p className="mt-1 flex items-center gap-1 truncate text-[13px] text-ink-2">
                          <MapPin className="size-4 shrink-0 text-ink-2/60" />
                          {event.venueName ?? "Venue to be announced"}
                        </p>
                      </div>
                    </div>

                    <div className="flex shrink-0 flex-wrap items-center gap-4 pt-1 sm:flex-nowrap lg:justify-end lg:pt-0">
                      {event.dressCode ? (
                        <>
                          <div className="flex flex-col">
                            <span className="font-mono text-xs tracking-wider text-ink-2/60 uppercase">
                              Dress code
                            </span>
                            <span className="text-sm font-semibold">{event.dressCode}</span>
                          </div>
                          <div className="hidden h-8 w-px bg-rose-200 sm:block" />
                        </>
                      ) : null}
                      <div className="flex flex-col">
                        <span className="font-mono text-xs tracking-wider text-ink-2/60 uppercase">
                          Guests
                        </span>
                        <span className="text-sm font-semibold">
                          {counts?.headcount ?? 0} expected{" "}
                          <span className="font-mono text-[11px] font-normal text-ink-2">
                            ({counts?.invited ?? 0} invited, {counts?.pending ?? 0} waiting)
                          </span>
                        </span>
                      </div>
                      <Link
                        href={`/events/${event.id}`}
                        className="flex shrink-0 items-center gap-1 rounded-lg bg-rose-100 px-3 py-2 text-xs font-semibold text-ink transition-colors hover:bg-rose-200"
                      >
                        Open
                      </Link>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* Recent replies + overdue tasks */}
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div className="flex flex-col rounded-xl bg-white p-4 shadow-sm lg:col-span-7">
          <div className="mb-2 flex items-center justify-between">
            <div>
              <h3 className="font-serif text-xl">Recent replies</h3>
              <p className="text-[13px] text-ink-2">The latest answers from your guests</p>
            </div>
            <Link href="/guests/rsvp" className="text-xs font-semibold text-plum hover:underline">
              All replies
            </Link>
          </div>
          {recentReplies.length === 0 ? (
            <p className="py-6 text-center text-[13px] text-ink-2">
              {stats.parties === 0
                ? "Add guests and share their invitation links. Replies will appear here."
                : "No replies yet. Share invitations or send a reminder."}
            </p>
          ) : (
            <ul className="divide-y divide-line">
              {recentReplies.map(({ guest, invitation }) => (
                <li
                  key={`${guest.id}-${invitation.eventId}`}
                  className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-[13px]"
                >
                  <div className="min-w-0">
                    <Link
                      href={`/guests/${guest.id}`}
                      className="font-medium text-ink hover:underline"
                    >
                      {guest.name}
                    </Link>
                    <span className="block font-mono text-xs text-ink-2">
                      {eventNames.get(invitation.eventId) ?? "Event"} •{" "}
                      {shortDate.format(invitation.respondedAt!)}
                    </span>
                  </div>
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${
                      invitation.rsvpStatus === "attending"
                        ? "bg-[#f2f7f2] text-forest"
                        : "bg-rose-100 text-ink-2"
                    }`}
                  >
                    {RSVP_LABELS[invitation.rsvpStatus]}
                    {invitation.rsvpStatus === "attending" && invitation.numberAttending
                      ? ` (${invitation.numberAttending})`
                      : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex flex-col rounded-xl bg-white p-4 shadow-sm lg:col-span-5">
          <div className="mb-2 flex items-center justify-between">
            <div>
              <h3 className="font-serif text-xl">Needs attention</h3>
              <p className="text-[13px] text-ink-2">Tasks past their due date</p>
            </div>
            <Link href="/tasks" className="text-xs font-semibold text-plum hover:underline">
              All tasks
            </Link>
          </div>
          {overdue.length === 0 ? (
            <p className="py-6 text-center text-[13px] text-ink-2">
              {tasks.length === 0 ? "No tasks yet." : "Nothing is overdue. Nice work."}
            </p>
          ) : (
            <ul className="divide-y divide-line">
              {overdue.slice(0, 5).map((task) => (
                <li
                  key={task.id}
                  className="flex items-center justify-between gap-2 py-2.5 text-[13px]"
                >
                  <Link
                    href={`/tasks/${task.id}`}
                    className="min-w-0 truncate font-medium text-ink hover:underline"
                  >
                    {task.title}
                  </Link>
                  <span className="shrink-0 font-mono text-xs font-medium text-destructive">
                    Due {task.dueDate ? shortDate.format(task.dueDate) : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </main>
  );
}
