import type { Metadata } from "next";
import Link from "next/link";
import { CalendarPlus, MapPin } from "lucide-react";
import { requireMember } from "@/lib/authz";
import { formatLongDate } from "@/lib/dates";
import { EVENT_TYPE_LABELS, formatTime } from "@/modules/events/schema";
import { listEvents } from "@/modules/events/service";
import { taskCountsByEvent } from "@/modules/tasks/service";

export const metadata: Metadata = { title: "Events — Make My Marriage" };

export default async function EventsPage() {
  const ctx = await requireMember();
  const [events, taskCounts] = await Promise.all([
    listEvents(ctx.weddingId),
    taskCountsByEvent(ctx.weddingId),
  ]);

  return (
    <main className="mx-auto w-full max-w-4xl pt-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold tracking-[0.6px] text-bronze uppercase">Planning</p>
          <h1 className="mt-1 font-serif text-4xl leading-11 tracking-tight text-plum">Events</h1>
          <p className="mt-1 text-sm text-ink-2">
            Every function, from the roka to the reception, in date order.
          </p>
        </div>
        <Link
          href="/events/new"
          className="inline-flex h-11 items-center gap-2 rounded-lg bg-bronze px-5 text-sm font-semibold text-white hover:bg-bronze/90"
        >
          <CalendarPlus className="size-4" aria-hidden /> Add event
        </Link>
      </div>

      {events.length === 0 ? (
        <div className="mt-6 rounded-xl bg-white p-8 text-center shadow-[0_1px_3px_rgba(35,31,32,0.04)]">
          <p className="font-serif text-xl text-ink">No events yet</p>
          <p className="mt-1 text-sm text-ink-2">
            Add the mehndi, sangeet, wedding and the rest. Guests and tasks link to these.
          </p>
        </div>
      ) : (
        <ul className="mt-6 flex flex-col gap-3">
          {events.map((event) => {
            const tasks = taskCounts.get(event.id) ?? 0;
            return (
              <li key={event.id}>
                <Link
                  href={`/events/${event.id}`}
                  className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-xl bg-white p-5 shadow-[0_1px_3px_rgba(35,31,32,0.04)] transition-shadow hover:shadow-md"
                >
                  <div className="min-w-0 flex-1 basis-64">
                    <span className="rounded-full bg-rose-200 px-2.5 py-0.5 text-[11px] font-semibold text-ink-2">
                      {EVENT_TYPE_LABELS[event.type]}
                    </span>
                    <h2 className="mt-2 font-serif text-xl text-ink">{event.name}</h2>
                    <p className="mt-1 text-[13px] text-ink-2">
                      {formatLongDate(event.date)} · {formatTime(event.startTime)}
                      {event.endTime ? ` – ${formatTime(event.endTime)}` : ""}
                    </p>
                    <p className="mt-0.5 flex items-center gap-1 text-[13px] text-ink-2">
                      <MapPin className="size-3.5" aria-hidden />
                      {event.venueName ?? "Venue to be announced"}
                    </p>
                  </div>
                  <div className="text-right text-[13px] text-ink-2">
                    {tasks > 0 ? `${tasks} ${tasks === 1 ? "task" : "tasks"}` : "No tasks"}
                    {event.showOnWebsite ? null : (
                      <p className="mt-1 text-xs font-semibold text-bronze">Private</p>
                    )}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
