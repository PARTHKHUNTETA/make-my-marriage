import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { GuestImport } from "@/components/guests/guest-import";
import { requireMember } from "@/lib/authz";
import { listEvents } from "@/modules/events/service";

export const metadata: Metadata = { title: "Import guests — Make My Marriage" };

export default async function ImportGuestsPage() {
  const ctx = await requireMember();
  const events = await listEvents(ctx.weddingId);
  return (
    <main className="mx-auto w-full max-w-4xl pt-6">
      <Link
        href="/guests"
        className="mb-4 inline-flex items-center gap-2 text-[13px] font-semibold text-ink-2 hover:text-ink"
      >
        <ArrowLeft className="size-4" aria-hidden /> Guests
      </Link>
      <h1 className="font-serif text-4xl leading-11 tracking-tight text-plum">Import guests</h1>
      <p className="mt-1 mb-6 text-sm text-ink-2">
        Bring in a whole list from Excel or a CSV file.
      </p>
      {events.length === 0 ? (
        <p className="rounded-xl bg-white p-6 text-sm text-ink-2 shadow-[0_1px_3px_rgba(35,31,32,0.04)]">
          Add your events first: each guest is invited to events.{" "}
          <Link href="/events/new" className="font-semibold text-bronze hover:underline">
            Add an event
          </Link>
        </p>
      ) : (
        <>
          <p className="mb-4 text-[13px] text-ink-2">
            Your events:{" "}
            <strong className="text-ink">{events.map((e) => e.name).join(", ")}</strong>
          </p>
          <GuestImport />
        </>
      )}
    </main>
  );
}
