import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { EventForm } from "@/components/events/event-form";
import { requireMember } from "@/lib/authz";

export const metadata: Metadata = { title: "Add event — Make My Marriage" };

export default async function NewEventPage() {
  await requireMember();
  return (
    <main className="mx-auto w-full max-w-3xl pt-6">
      <Link
        href="/events"
        className="mb-4 inline-flex items-center gap-2 text-[13px] font-semibold text-ink-2 hover:text-ink"
      >
        <ArrowLeft className="size-4" aria-hidden /> Events
      </Link>
      <h1 className="font-serif text-4xl leading-11 tracking-tight text-plum">Add event</h1>
      <p className="mt-1 mb-6 text-sm text-ink-2">
        Events can fall on any date, including months before the wedding.
      </p>
      <EventForm
        initial={{
          type: "mehndi",
          name: "Mehndi",
          date: "",
          startTime: "",
          endTime: "",
          venueName: "",
          address: "",
          description: "",
          dressCode: "",
          showOnWebsite: true,
        }}
      />
    </main>
  );
}
