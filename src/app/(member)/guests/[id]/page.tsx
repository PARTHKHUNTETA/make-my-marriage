import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { DeleteGuestButton } from "@/components/guests/delete-guest-button";
import { GuestForm } from "@/components/guests/guest-form";
import { requireMember } from "@/lib/authz";
import { listEvents } from "@/modules/events/service";
import { getGuest } from "@/modules/guests/service";

export const metadata: Metadata = { title: "Guest — Make My Marriage" };

export default async function GuestPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireMember();
  const { id } = await params;
  const [guest, events] = await Promise.all([
    getGuest(ctx.weddingId, id),
    listEvents(ctx.weddingId),
  ]);
  if (!guest) notFound();
  const known = new Set(events.map((e) => e.id));
  return (
    <main className="mx-auto w-full max-w-3xl pt-6">
      <Link
        href="/guests"
        className="mb-4 inline-flex items-center gap-2 text-[13px] font-semibold text-ink-2 hover:text-ink"
      >
        <ArrowLeft className="size-4" aria-hidden /> Guests
      </Link>
      <h1 className="mb-6 font-serif text-4xl leading-11 tracking-tight text-plum">{guest.name}</h1>
      <div className="flex flex-col gap-6">
        <GuestForm
          guestId={guest.id}
          initial={{
            name: guest.name,
            phone: guest.phone ?? "",
            email: guest.email ?? "",
            guestsAllowed: guest.guestsAllowed,
            invitedEventIds: guest.invitations.map((i) => i.eventId).filter((e) => known.has(e)),
            notes: guest.notes ?? "",
          }}
          events={events.map((e) => ({ id: e.id, name: e.name }))}
          answeredEventIds={guest.invitations
            .filter((i) => i.rsvpStatus !== "pending")
            .map((i) => i.eventId)}
        />
        <DeleteGuestButton guestId={guest.id} name={guest.name} />
      </div>
    </main>
  );
}
