import type { Metadata } from "next";
import Link from "next/link";
import { ChartCard } from "@/components/analytics/chart-card";
import { requireMember } from "@/lib/authz";
import { analyticsFilterSchema } from "@/modules/analytics/schema";
import { getAnalytics } from "@/modules/analytics/service";

export const metadata: Metadata = { title: "Analytics — Make My Marriage" };
export const dynamic = "force-dynamic";

const field = "rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink";

// Charts worked out from what the wedding already holds, with an event and date-range filter that
// lives in the address so a view can be shared and bookmarked.
export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const ctx = await requireMember();
  const raw = await searchParams;
  const pick = (k: string) =>
    typeof raw[k] === "string" && raw[k] !== "" ? (raw[k] as string) : undefined;
  const parsed = analyticsFilterSchema.safeParse({
    eventId: pick("event"),
    from: pick("from"),
    to: pick("to"),
  });
  const filter = parsed.success ? parsed.data : {};
  const { charts, events, notes } = await getAnalytics(ctx.weddingId, filter, ctx.memberId);
  // Any filter in the address counts, even one that was not valid and so was ignored.
  const filtered = Boolean(pick("event") || pick("from") || pick("to"));

  return (
    <main className="mx-auto w-full max-w-6xl pt-6">
      <p className="text-xs font-semibold tracking-[0.6px] text-bronze uppercase">Insights</p>
      <h1 className="mt-1 font-serif text-4xl leading-11 tracking-tight text-plum">Analytics</h1>
      <p className="mt-1 text-sm text-ink-2">
        Charts from the details you have already added. Nothing extra to enter.
      </p>

      <form
        method="get"
        className="mt-5 flex flex-wrap items-end gap-3 rounded-xl bg-white p-4 shadow-[0_1px_3px_rgba(35,31,32,0.04)]"
      >
        <label className="flex flex-col gap-1 text-xs font-semibold text-ink-2">
          Event
          <select name="event" defaultValue={filter.eventId ?? ""} className={field}>
            <option value="">All events</option>
            {events.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-semibold text-ink-2">
          From
          <input type="date" name="from" defaultValue={filter.from ?? ""} className={field} />
        </label>
        <label className="flex flex-col gap-1 text-xs font-semibold text-ink-2">
          To
          <input type="date" name="to" defaultValue={filter.to ?? ""} className={field} />
        </label>
        <button
          type="submit"
          className="rounded-lg bg-plum px-4 py-2 text-sm font-semibold text-white hover:bg-plum/90"
        >
          Apply
        </button>
        {filtered ? (
          <Link
            href="/analytics"
            className="py-2 text-[13px] font-semibold text-bronze hover:underline"
          >
            Clear filters
          </Link>
        ) : null}
      </form>
      {!parsed.success ? (
        <p role="alert" className="mt-3 text-[13px] text-destructive">
          {parsed.error.issues[0]?.message ?? "Those filters aren't valid."} Showing everything
          instead.
        </p>
      ) : null}
      {notes.map((n) => (
        <p key={n} className="mt-3 text-[13px] text-ink-2">
          {n}
        </p>
      ))}

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        {charts.map((c) => (
          <ChartCard key={c.id} data={c} />
        ))}
      </div>
    </main>
  );
}
