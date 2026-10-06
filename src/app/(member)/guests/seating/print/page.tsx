import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PrintButton } from "@/components/seating/print-button";
import { requireMember } from "@/lib/authz";
import { formatLongDate } from "@/lib/dates";
import { getEvent } from "@/modules/events/service";
import { getSeatingPlan } from "@/modules/seating/plan";

export const metadata: Metadata = {
  title: "Seating chart — Make My Marriage",
  robots: { index: false },
};
export const dynamic = "force-dynamic";

// A clean, table-by-table page for printing. "Print" then "Save as PDF" in the browser's print
// dialog gives a PDF with no extra software; the app's own menus are hidden when printing.
export default async function PrintSeatingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const ctx = await requireMember();
  const { eventId } = await searchParams;
  const event = typeof eventId === "string" ? await getEvent(ctx.weddingId, eventId) : null;
  if (!event) notFound();
  const plan = await getSeatingPlan(ctx.weddingId, event.id);

  return (
    <main className="mx-auto max-w-3xl pt-6 print:max-w-none print:pt-0">
      <div className="mb-4 flex items-center justify-between gap-3 print:hidden">
        <Link
          href={`/guests/seating?eventId=${event.id}`}
          className="text-[13px] font-semibold text-bronze hover:underline"
        >
          ← Back to seating
        </Link>
        <PrintButton />
      </div>
      <h1 className="font-serif text-3xl text-plum print:text-black">
        {event.name}: seating chart
      </h1>
      <p className="mb-6 text-sm text-ink-2">{formatLongDate(event.date)}</p>
      {plan.tables.length === 0 ? (
        <p className="text-sm text-ink-2">No tables yet.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 print:grid-cols-2">
          {plan.tables.map((t) => (
            <section
              key={t.table.id}
              className="break-inside-avoid rounded-lg border border-line p-4 print:border-black"
            >
              <h2 className="font-serif text-xl">
                {t.table.name}{" "}
                <span className="font-sans text-xs text-ink-2 print:text-black">
                  {t.used} / {t.table.capacity} seats
                </span>
              </h2>
              {t.seated.length === 0 ? (
                <p className="mt-2 text-sm text-ink-2 print:text-black">Empty</p>
              ) : (
                <ul className="mt-2 text-sm">
                  {t.seated.map((s) => (
                    <li
                      key={s.party.id}
                      className="flex justify-between gap-3 border-b border-line py-1 last:border-0 print:border-black/30"
                    >
                      <span>{s.party.name}</span>
                      <span>{s.seats}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>
      )}
      {plan.unseated.length > 0 ? (
        <section className="mt-6 break-inside-avoid">
          <h2 className="font-serif text-xl">Still to seat</h2>
          <p className="text-sm">
            {plan.unseated.map((u) => `${u.party.name} (${u.remaining})`).join(", ")}
          </p>
        </section>
      ) : null}
    </main>
  );
}
