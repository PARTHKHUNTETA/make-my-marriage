import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { GuestForm } from "@/components/guests/guest-form";
import { requireMember } from "@/lib/authz";
import { listEvents } from "@/modules/events/service";

export const metadata: Metadata = { title: "Add guest — Make My Marriage" };

export default async function NewGuestPage() {
  const ctx = await requireMember();
  const events = await listEvents(ctx.weddingId);
  return (
    <main className="mx-auto w-full max-w-3xl pt-6">
      <Link
        href="/guests"
        className="mb-4 inline-flex items-center gap-2 text-[13px] font-semibold text-ink-2 hover:text-ink"
      >
        <ArrowLeft className="size-4" aria-hidden /> Guests
      </Link>
      <h1 className="mb-6 font-serif text-4xl leading-11 tracking-tight text-plum">Add guest</h1>
      <GuestForm
        initial={{
          name: "",
          phone: "",
          email: "",
          guestsAllowed: 2,
          invitedEventIds: [],
          notes: "",
        }}
        events={events.map((e) => ({ id: e.id, name: e.name }))}
      />
    </main>
  );
}
