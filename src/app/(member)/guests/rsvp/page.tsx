import type { Metadata } from "next";
import Link from "next/link";
import { Download } from "lucide-react";
import { GuestsHeader, StatCard } from "@/components/guests/guests-header";
import { RsvpOverride } from "@/components/guests/rsvp-override";
import { requireMember } from "@/lib/authz";
import { formatLongDate } from "@/lib/dates";
import { EVENT_TYPE_LABELS, formatTime } from "@/modules/events/schema";
import { listEvents } from "@/modules/events/service";
import { getStats, listEveryGuest } from "@/modules/guests/service";

export const metadata: Metadata = { title: "Replies — Make My Marriage" };

export default async function RsvpPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const ctx = await requireMember();
  const raw = await searchParams;
  const events = await listEvents(ctx.weddingId);
  const requested = typeof raw.eventId === "string" ? raw.eventId : undefined;
  const event = events.find((e) => e.id === requested) ?? events[0];

  if (!event) {
    return (
      <main className="mx-auto w-full max-w-4xl pt-6">
        <GuestsHeader active="rsvps" />
        <div className="mt-6 rounded-xl bg-white p-8 text-center shadow-[0_1px_3px_rgba(35,31,32,0.04)]">
          <p className="font-serif text-xl text-ink">No events yet</p>
          <p className="mt-1 text-sm text-ink-2">Replies are collected per event. Add one first.</p>
        </div>
      </main>
    );
  }

  const [stats, guests] = await Promise.all([
    getStats(ctx.weddingId),
    listEveryGuest(ctx.weddingId, { eventId: event.id }),
  ]);
  const mine = stats.perEvent.find((e) => e.eventId === event.id);
  const replyOf = (guest: (typeof guests)[number]) =>
    guest.invitations.find((i) => i.eventId === event.id);
  const waiting = guests.filter((g) => replyOf(g)?.rsvpStatus === "pending");

  return (
    <main className="mx-auto w-full max-w-4xl pt-6">
      <GuestsHeader
        active="rsvps"
        action={
          <a
            href={`/api/guests/export?eventId=${event.id}`}
            className="inline-flex h-11 items-center gap-2 rounded-lg bg-white px-5 text-sm font-semibold text-ink shadow-[0_1px_3px_rgba(35,31,32,0.08)] hover:bg-rose-100"
          >
            <Download className="size-4" aria-hidden /> Export for caterer (CSV)
          </a>
        }
      />

      <div role="tablist" aria-label="Events" className="mt-5 flex flex-wrap gap-2">
        {events.map((e) => (
          <Link
            key={e.id}
            href={`/guests/rsvp?eventId=${e.id}`}
            role="tab"
            aria-selected={e.id === event.id}
            className={`rounded-full px-4 py-1.5 text-[13px] font-semibold transition-colors ${
              e.id === event.id ? "bg-bronze text-white" : "bg-white text-ink-2 hover:bg-rose-200"
            }`}
          >
            {e.name}
          </Link>
        ))}
      </div>

      <p className="mt-4 text-[13px] text-ink-2">
        {EVENT_TYPE_LABELS[event.type]} · {formatLongDate(event.date)} ·{" "}
        {formatTime(event.startTime)}
      </p>

      <section
        aria-label="Totals for this event"
        className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4"
      >
        <StatCard label="Parties invited" value={mine?.invited ?? 0} />
        <StatCard label="Replied" value={(mine?.attending ?? 0) + (mine?.notAttending ?? 0)} />
        <StatCard label="Waiting for a reply" value={mine?.pending ?? 0} />
        <StatCard label="People expected" value={mine?.headcount ?? 0} />
      </section>

      {guests.length === 0 ? (
        <p className="mt-6 rounded-xl bg-white p-6 text-center text-sm text-ink-2 shadow-[0_1px_3px_rgba(35,31,32,0.04)]">
          Nobody is invited to this event yet. Adding an event doesn&rsquo;t invite anyone
          automatically; tick it when you add or edit a guest.
        </p>
      ) : (
        <>
          <ul className="mt-6 divide-y divide-line rounded-xl bg-white shadow-[0_1px_3px_rgba(35,31,32,0.04)]">
            {guests.map((guest) => {
              const reply = replyOf(guest);
              if (!reply) return null;
              return (
                <li
                  key={guest.id}
                  className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3"
                >
                  <div className="min-w-0 flex-1 basis-48">
                    <Link
                      href={`/guests/${guest.id}`}
                      className="text-sm font-semibold text-ink hover:underline"
                    >
                      {guest.name}
                    </Link>
                    <p className="text-[13px] text-ink-2">Up to {guest.guestsAllowed}</p>
                  </div>
                  <RsvpOverride
                    key={`${reply.rsvpStatus}-${reply.numberAttending ?? ""}`}
                    guestId={guest.id}
                    eventId={event.id}
                    guestName={guest.name}
                    guestsAllowed={guest.guestsAllowed}
                    status={reply.rsvpStatus}
                    numberAttending={reply.numberAttending}
                  />
                </li>
              );
            })}
          </ul>

          <section className="mt-6 rounded-xl bg-white p-5 shadow-[0_1px_3px_rgba(35,31,32,0.04)]">
            <h2 className="font-serif text-xl text-ink">
              Not yet responded{" "}
              <span className="font-sans text-sm text-ink-2">({waiting.length})</span>
            </h2>
            {waiting.length === 0 ? (
              <p className="mt-1 text-[13px] text-ink-2">Everyone has replied.</p>
            ) : (
              <p className="mt-1 text-[13px] text-ink-2">{waiting.map((g) => g.name).join(", ")}</p>
            )}
          </section>
        </>
      )}
    </main>
  );
}
