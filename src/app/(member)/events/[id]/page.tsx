import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { CoverImageField } from "@/components/photos/cover-image-field";
import { DeleteEventButton } from "@/components/events/delete-event-button";
import { EventForm } from "@/components/events/event-form";
import { requireMember } from "@/lib/authz";
import { toIstYmd } from "@/lib/dates";
import { getEvent } from "@/modules/events/service";
import { coverUrl } from "@/modules/photos/covers";
import { getStats, listEveryGuest } from "@/modules/guests/service";
import { VENDOR_CATEGORY_LABELS } from "@/modules/vendors/schema";
import { listVendors } from "@/modules/vendors/service";
import { RSVP_LABELS } from "@/modules/guests/schema";
import { listTeam } from "@/modules/members/service";
import { PRIORITY_LABELS, STATUS_LABELS } from "@/modules/tasks/schema";
import { listTasks } from "@/modules/tasks/service";

export const metadata: Metadata = { title: "Event — Make My Marriage" };

export default async function EventPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireMember();
  const { id } = await params;
  const event = await getEvent(ctx.weddingId, id);
  if (!event) notFound();
  const [tasks, team, stats, guests, vendors] = await Promise.all([
    listTasks(ctx.weddingId, { view: "all", eventId: event.id }, ctx.memberId),
    listTeam(ctx.weddingId),
    getStats(ctx.weddingId),
    listEveryGuest(ctx.weddingId, { eventId: event.id }),
    listVendors(ctx.weddingId, { eventId: event.id }),
  ]);
  const mine = stats.perEvent.find((e) => e.eventId === event.id);
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

        <CoverImageField
          target={{ kind: "event", eventId: event.id }}
          currentUrl={await coverUrl(event.coverImageKey)}
          title="Event picture"
          hint="Shown on this event's card on your wedding website."
        />

        <section className="rounded-xl bg-white shadow-[0_1px_3px_rgba(35,31,32,0.04)]">
          <div className="flex items-center justify-between px-5 pt-5">
            <h2 className="font-serif text-xl text-ink">
              Guests <span className="font-sans text-sm text-ink-2">({guests.length})</span>
            </h2>
            <Link
              href={`/guests/rsvp?eventId=${event.id}`}
              className="text-[13px] font-semibold text-bronze hover:underline"
            >
              Replies
            </Link>
          </div>
          {guests.length === 0 ? (
            <p className="px-5 pt-2 pb-5 text-[13px] text-ink-2">
              Nobody is invited yet. Tick this event when you add or edit a guest.
            </p>
          ) : (
            <>
              <p className="px-5 pt-1 text-[13px] text-ink-2">
                {mine?.attending ?? 0} attending · {mine?.notAttending ?? 0} not attending ·{" "}
                {mine?.pending ?? 0} waiting · <strong>{mine?.headcount ?? 0}</strong> people
                expected
              </p>
              <ul className="mt-2 divide-y divide-line">
                {guests.map((guest) => {
                  const reply = guest.invitations.find((i) => i.eventId === event.id);
                  return (
                    <li key={guest.id} className="flex flex-wrap items-center gap-3 px-5 py-2.5">
                      <Link
                        href={`/guests/${guest.id}`}
                        className="min-w-0 flex-1 text-sm font-semibold text-ink hover:underline"
                      >
                        {guest.name}
                      </Link>
                      <span className="text-[13px] text-ink-2">
                        {reply ? RSVP_LABELS[reply.rsvpStatus] : ""}
                        {reply?.rsvpStatus === "attending" && reply.numberAttending
                          ? ` (${reply.numberAttending})`
                          : ""}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </section>

        <section className="rounded-xl bg-white shadow-[0_1px_3px_rgba(35,31,32,0.04)]">
          <div className="flex items-center justify-between px-5 pt-5">
            <h2 className="font-serif text-xl text-ink">
              Vendors <span className="font-sans text-sm text-ink-2">({vendors.length})</span>
            </h2>
            <Link href="/vendors" className="text-[13px] font-semibold text-bronze hover:underline">
              All vendors
            </Link>
          </div>
          {vendors.length === 0 ? (
            <p className="px-5 pt-2 pb-5 text-[13px] text-ink-2">
              No vendors are linked to this event. Tick it on a vendor&rsquo;s page.
            </p>
          ) : (
            <ul className="mt-2 divide-y divide-line pb-2">
              {vendors.map(({ vendor }) => (
                <li key={vendor.id} className="flex flex-wrap items-center gap-3 px-5 py-2.5">
                  <Link
                    href={`/vendors/${vendor.id}`}
                    className="min-w-0 flex-1 text-sm font-semibold text-ink hover:underline"
                  >
                    {vendor.name}
                  </Link>
                  <span className="text-[13px] text-ink-2">
                    {VENDOR_CATEGORY_LABELS[vendor.category]}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

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
            The photo album for this event will appear here when photos arrive.
          </p>
        </section>

        <DeleteEventButton eventId={event.id} name={event.name} />
      </div>
    </main>
  );
}
