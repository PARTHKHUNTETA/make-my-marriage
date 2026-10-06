import type { Metadata } from "next";
import Link from "next/link";
import { Download, Printer } from "lucide-react";
import { GuestsHeader } from "@/components/guests/guests-header";
import { SeatingBoard } from "@/components/seating/seating-board";
import { requireMember } from "@/lib/authz";
import { formatLongDate } from "@/lib/dates";
import { formatTime } from "@/modules/events/schema";
import { listEvents } from "@/modules/events/service";
import { getSeatingPlan } from "@/modules/seating/plan";

export const metadata: Metadata = { title: "Seating — Make My Marriage" };

export default async function SeatingPage({
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
      <main className="mx-auto w-full max-w-4xl pt-6">
        <GuestsHeader active="seating" />
        <div className="mt-6 rounded-xl bg-white p-8 text-center shadow-[0_1px_3px_rgba(35,31,32,0.04)]">
          <p className="font-serif text-xl text-ink">No events yet</p>
          <p className="mt-1 text-sm text-ink-2">Seating is planned per event. Add one first.</p>
        </div>
      </main>
    );

  const plan = await getSeatingPlan(ctx.weddingId, event.id);
  const action =
    plan.tables.length > 0 ? (
      <div className="flex flex-wrap gap-2">
        <Link
          href={`/guests/seating/print?eventId=${event.id}`}
          className="inline-flex h-11 items-center gap-2 rounded-lg bg-white px-5 text-sm font-semibold text-ink shadow-[0_1px_3px_rgba(35,31,32,0.08)] hover:bg-rose-100"
        >
          <Printer className="size-4" aria-hidden /> Print or save as PDF
        </Link>
        <a
          href={`/api/seating/export?eventId=${event.id}`}
          className="inline-flex h-11 items-center gap-2 rounded-lg bg-white px-5 text-sm font-semibold text-ink shadow-[0_1px_3px_rgba(35,31,32,0.08)] hover:bg-rose-100"
        >
          <Download className="size-4" aria-hidden /> CSV
        </a>
      </div>
    ) : undefined;

  return (
    <main className="mx-auto w-full max-w-5xl pt-6">
      <GuestsHeader active="seating" action={action} />
      <div role="tablist" aria-label="Events" className="mt-5 flex flex-wrap gap-2">
        {events.map((e) => (
          <Link
            key={e.id}
            href={`/guests/seating?eventId=${e.id}`}
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
      <SeatingBoard key={event.id} eventId={event.id} plan={plan} showTable={event.showTable} />
    </main>
  );
}
