import type { Metadata } from "next";
import Link from "next/link";
import { Download, Plus } from "lucide-react";
import { ExpenseFilters } from "@/components/money/expense-filters";
import { MoneyHeader } from "@/components/money/money-header";
import { requireMember } from "@/lib/authz";
import { formatLongDate } from "@/lib/dates";
import { formatRupees } from "@/lib/money";
import { listEvents } from "@/modules/events/service";
import { listVendors } from "@/modules/vendors/service";
import {
  CATEGORY_LABELS,
  EXPENSE_CATEGORIES,
  PAYER_LABELS,
  parseExpenseQuery,
} from "@/modules/money/schema";
import { getSummary, listExpenses } from "@/modules/money/service";

export const metadata: Metadata = { title: "Expenses — Make My Marriage" };

const box = "rounded-xl bg-white p-5 shadow-[0_1px_3px_rgba(35,31,32,0.04)]";

export default async function MoneyPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const ctx = await requireMember();
  const raw = await searchParams;
  const query = parseExpenseQuery(raw);
  const [events, vendors, summary, list] = await Promise.all([
    listEvents(ctx.weddingId),
    listVendors(ctx.weddingId),
    getSummary(ctx.weddingId),
    listExpenses(ctx.weddingId, query),
  ]);
  const eventNames = new Map(events.map((e) => [e.id, e.name]));
  const vendorNames = new Map(vendors.map((v) => [v.vendor.id, v.vendor.name]));
  const filtered = Boolean(query.category || query.eventId || query.vendorId || query.paidBy);
  const pages = Math.max(1, Math.ceil(list.total / list.pageSize));
  const categories = EXPENSE_CATEGORIES.filter((c) => summary.byCategory[c]).sort(
    (a, b) => (summary.byCategory[b] ?? 0) - (summary.byCategory[a] ?? 0),
  );
  const eventRows = [
    ...events
      .filter((e) => summary.byEvent[e.id])
      .map((e) => ({ name: e.name, amount: summary.byEvent[e.id]! })),
    ...(summary.byEvent.none ? [{ name: "No event", amount: summary.byEvent.none }] : []),
  ];

  const pageHref = (page: number) => {
    const next = new URLSearchParams();
    for (const key of ["category", "eventId", "vendorId", "paidBy"] as const) {
      const value = raw[key];
      if (typeof value === "string" && value) next.set(key, value);
    }
    if (page > 1) next.set("page", String(page));
    const q = next.toString();
    return q ? `/money?${q}` : "/money";
  };

  return (
    <main className="mx-auto w-full max-w-4xl pt-6">
      <MoneyHeader
        active="expenses"
        title="Expenses"
        blurb="Everything spent on the wedding, by category, event and who paid."
        action={
          <div className="flex flex-wrap gap-2">
            <a
              href="/api/money/export"
              download
              className="inline-flex h-11 items-center gap-2 rounded-lg bg-white px-5 text-sm font-semibold text-ink shadow-[0_1px_3px_rgba(35,31,32,0.08)] hover:bg-rose-100"
            >
              <Download className="size-4" aria-hidden /> Export
            </a>
            <Link
              href="/money/new"
              className="inline-flex h-11 items-center gap-2 rounded-lg bg-bronze px-5 text-sm font-semibold text-white hover:bg-bronze/90"
            >
              <Plus className="size-4" aria-hidden /> Add expense
            </Link>
          </div>
        }
      />

      <section aria-label="Totals" className="mt-6 grid gap-3 sm:grid-cols-3">
        <div className={box}>
          <p className="font-serif text-3xl text-plum">{formatRupees(summary.total)}</p>
          <p className="text-[13px] text-ink-2">Total spent</p>
        </div>
        <div className={`${box} sm:col-span-2`}>
          <p className="text-xs font-semibold text-ink-2">By category</p>
          {categories.length === 0 ? (
            <p className="mt-1 text-[13px] text-ink-2">Nothing spent yet.</p>
          ) : (
            <ul className="mt-2 grid gap-x-6 gap-y-1 sm:grid-cols-2">
              {categories.map((c) => (
                <li key={c} className="flex justify-between text-[13px]">
                  <span className="text-ink-2">{CATEGORY_LABELS[c]}</span>
                  <span className="font-semibold text-ink">
                    {formatRupees(summary.byCategory[c]!)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {eventRows.length > 0 ? (
        <section className={`${box} mt-3`}>
          <p className="text-xs font-semibold text-ink-2">By event</p>
          <ul className="mt-2 grid gap-x-6 gap-y-1 sm:grid-cols-2">
            {eventRows.map((row) => (
              <li key={row.name} className="flex justify-between text-[13px]">
                <span className="text-ink-2">{row.name}</span>
                <span className="font-semibold text-ink">{formatRupees(row.amount)}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="mt-6">
        <ExpenseFilters
          events={events.map((e) => ({ id: e.id, name: e.name }))}
          vendors={vendors.map((v) => ({ id: v.vendor.id, name: v.vendor.name }))}
        />
      </div>

      {list.items.length === 0 ? (
        <div className={`${box} mt-6 text-center`}>
          <p className="font-serif text-xl text-ink">
            {filtered ? "No expenses match" : "No expenses yet"}
          </p>
          <p className="mt-1 text-sm text-ink-2">
            {filtered
              ? "Try different filters."
              : "Add what you have paid so far, like the venue advance."}
          </p>
        </div>
      ) : (
        <>
          <p className="mt-4 text-[13px] text-ink-2">
            {list.total} {list.total === 1 ? "expense" : "expenses"}
            {filtered ? " match" : ""}
          </p>
          <ul className="mt-2 divide-y divide-line rounded-xl bg-white shadow-[0_1px_3px_rgba(35,31,32,0.04)]">
            {list.items.map((e) => (
              <li key={e.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3.5">
                <div className="min-w-0 flex-1 basis-56">
                  <Link
                    href={`/money/${e.id}`}
                    className="text-sm font-semibold text-ink hover:underline"
                  >
                    {e.title}
                  </Link>
                  <p className="text-[13px] text-ink-2">
                    {formatLongDate(e.date)} · {CATEGORY_LABELS[e.category]}
                    {e.eventId && eventNames.get(e.eventId)
                      ? ` · ${eventNames.get(e.eventId)}`
                      : ""}
                    {e.vendorId && vendorNames.get(e.vendorId)
                      ? ` · ${vendorNames.get(e.vendorId)}`
                      : ""}
                  </p>
                </div>
                <span className="text-[13px] text-ink-2">{PAYER_LABELS[e.paidBy]}</span>
                <span className="w-28 text-right text-sm font-semibold text-ink">
                  {formatRupees(e.amount)}
                </span>
              </li>
            ))}
          </ul>
          {pages > 1 ? (
            <nav aria-label="Pages" className="mt-4 flex items-center justify-between text-[13px]">
              {list.page > 1 ? (
                <Link
                  href={pageHref(list.page - 1)}
                  className="font-semibold text-bronze hover:underline"
                >
                  Previous
                </Link>
              ) : (
                <span />
              )}
              <span className="text-ink-2">
                Page {list.page} of {pages}
              </span>
              {list.page < pages ? (
                <Link
                  href={pageHref(list.page + 1)}
                  className="font-semibold text-bronze hover:underline"
                >
                  Next
                </Link>
              ) : (
                <span />
              )}
            </nav>
          ) : null}
        </>
      )}
    </main>
  );
}
