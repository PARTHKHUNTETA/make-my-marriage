import type { Metadata } from "next";
import Link from "next/link";
import { CheckInConsole } from "@/components/checkin/checkin-console";
import { GuestsHeader } from "@/components/guests/guests-header";
import { requireMember } from "@/lib/authz";
import { formatLongDate } from "@/lib/dates";
import { formatTime } from "@/modules/events/schema";
import { listEvents } from "@/modules/events/service";
import { getCounter } from "@/modules/checkin/service";

export const metadata: Metadata = { title: "Check-in — Make My Marriage" };
export const dynamic = "force-dynamic";

// Opened on a phone at the gate. Gate volunteers are members: an Admin invites them as Managers.
export default async function CheckInPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const ctx = await requireMember();
  const raw = await searchParams;
  const events = await listEvents(ctx.weddingId);
  const requested = typeof raw.eventId === "string" ? raw.eventId : undefined;
  const event = events.find((e) => e.id === requested) ?? events[0];

  if (!event)
    return (
      <main className="mx-auto w-full max-w-3xl pt-6">
        <GuestsHeader active="checkin" />
        <div className="mt-6 rounded-xl bg-white p-8 text-center shadow-[0_1px_3px_rgba(35,31,32,0.04)]">
          <p className="font-serif text-xl text-ink">No events yet</p>
          <p className="mt-1 text-sm text-ink-2">Check-in is for an event. Add one first.</p>
        </div>
      </main>
    );

  const counter = await getCounter(ctx.weddingId, event.id);
  return (
    <main className="mx-auto w-full max-w-3xl pt-6">
      <GuestsHeader active="checkin" />
      <div role="tablist" aria-label="Events" className="mt-5 flex flex-wrap gap-2">
        {events.map((e) => (
          <Link
            key={e.id}
            href={`/guests/checkin?eventId=${e.id}`}
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
      <p className="mt-4 mb-4 text-[13px] text-ink-2">
        {formatLongDate(event.date)} · {formatTime(event.startTime)}
      </p>
      <CheckInConsole key={event.id} eventId={event.id} initial={counter} />
    </main>
  );
}
