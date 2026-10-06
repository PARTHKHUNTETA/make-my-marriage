import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { DeleteEventButton } from "@/components/events/delete-event-button";
import { EventForm } from "@/components/events/event-form";
import { requireMember } from "@/lib/authz";
import { toIstYmd } from "@/lib/dates";
import { getEvent } from "@/modules/events/service";
import { listTeam } from "@/modules/members/service";
import { PRIORITY_LABELS, STATUS_LABELS } from "@/modules/tasks/schema";
import { listTasks } from "@/modules/tasks/service";

export const metadata: Metadata = { title: "Event — Make My Marriage" };

export default async function EventPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireMember();
  const { id } = await params;
  const event = await getEvent(ctx.weddingId, id);
  if (!event) notFound();
  const [tasks, team] = await Promise.all([
    listTasks(ctx.weddingId, { view: "all", eventId: event.id }, ctx.memberId),
    listTeam(ctx.weddingId),
  ]);
  const names = new Map(team.members.map((m) => [m.memberId, m.name]));

  return (
    <main className="mx-auto w-full max-w-3xl pt-6">
      <Link
        href="/events"
        className="mb-4 inline-flex items-center gap-2 text-[13px] font-semibold text-ink-2 hover:text-ink"
      >
        <ArrowLeft className="size-4" aria-hidden /> Events
      </Link>
      <h1 className="font-serif text-4xl leading-11 tracking-tight text-plum">{event.name}</h1>
      <div className="mt-6 flex flex-col gap-6">
        <EventForm
          eventId={event.id}
          initial={{
            type: event.type,
            name: event.name,
            date: toIstYmd(event.date),
            startTime: event.startTime,
            endTime: event.endTime ?? "",
            venueName: event.venueName ?? "",
            address: event.address ?? "",
            description: event.description ?? "",
            dressCode: event.dressCode ?? "",
            showOnWebsite: event.showOnWebsite,
          }}
        />

        <section className="rounded-xl bg-white shadow-[0_1px_3px_rgba(35,31,32,0.04)]">
          <div className="flex items-center justify-between px-5 pt-5">
            <h2 className="font-serif text-xl text-ink">
              Tasks <span className="font-sans text-sm text-ink-2">({tasks.length})</span>
            </h2>
            <Link
              href={`/tasks/new?eventId=${event.id}`}
              className="text-[13px] font-semibold text-bronze hover:underline"
            >
              Add a task
            </Link>
          </div>
          {tasks.length === 0 ? (
            <p className="px-5 pt-2 pb-5 text-[13px] text-ink-2">No tasks linked to this event.</p>
          ) : (
            <ul className="mt-2 divide-y divide-line">
              {tasks.map((task) => (
                <li key={task.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                  <Link
                    href={`/tasks/${task.id}`}
                    className="min-w-0 flex-1 text-sm font-semibold text-ink hover:underline"
                  >
                    {task.title}
                  </Link>
                  <span className="text-[13px] text-ink-2">
                    {(task.assignedMemberId && names.get(task.assignedMemberId)) || "Unassigned"}
                  </span>
                  <span className="text-[13px] text-ink-2">
                    {PRIORITY_LABELS[task.priority]} · {STATUS_LABELS[task.status]}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <p className="px-5 pt-1 pb-5 text-[13px] text-ink-2">
            Guests, vendors and the photo album for this event will appear here as those features
            arrive.
          </p>
        </section>

        <DeleteEventButton eventId={event.id} name={event.name} />
      </div>
    </main>
  );
}
