import type { Metadata } from "next";
import { BudgetEditor } from "@/components/money/budget-editor";
import { MoneyHeader } from "@/components/money/money-header";
import { requireMember } from "@/lib/authz";
import { formatRupees } from "@/lib/money";
import { listEvents } from "@/modules/events/service";
import type { BudgetRow } from "@/modules/money/calc";
import type { ExpenseCategory } from "@/modules/money/schema";
import { getBudgetOverview } from "@/modules/money/service";
import { getWedding } from "@/modules/wedding/service";

export const metadata: Metadata = { title: "Budget — Make My Marriage" };

const box = "rounded-xl bg-white shadow-[0_1px_3px_rgba(35,31,32,0.04)]";

function Bar({ row }: { row: BudgetRow }) {
  if (row.percentUsed === null) return null;
  return (
    <div
      role="progressbar"
      aria-label={`${row.label} budget used`}
      aria-valuenow={Math.min(row.percentUsed, 100)}
      aria-valuemin={0}
      aria-valuemax={100}
      className="h-1.5 w-full overflow-hidden rounded-full bg-rose-100"
    >
      <div
        className={`h-full rounded-full ${row.over ? "bg-destructive" : row.percentUsed >= 90 ? "bg-honey" : "bg-forest"}`}
        style={{ width: `${Math.min(row.percentUsed, 100)}%` }}
      />
    </div>
  );
}

function Status({ row }: { row: BudgetRow }) {
  if (row.budget === null)
    return <span className="text-xs text-ink-2">{row.spent ? "No budget set" : ""}</span>;
  return (
    <span className={`text-xs ${row.over ? "font-semibold text-destructive" : "text-ink-2"}`}>
      {row.over
        ? `${formatRupees(Math.abs(row.remaining!))} over`
        : `${formatRupees(row.remaining!)} left`}{" "}
      · {row.percentUsed}% used
    </span>
  );
}

function Line({ row, editor }: { row: BudgetRow; editor: React.ReactNode }) {
  return (
    <li className="flex flex-col gap-2 px-5 py-3.5">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-ink">{row.label}</p>
          <p className="text-[13px] text-ink-2">
            Spent <strong className="text-ink">{formatRupees(row.spent)}</strong>
          </p>
        </div>
        {editor}
      </div>
      <Bar row={row} />
      <Status row={row} />
    </li>
  );
}

export default async function BudgetPage() {
  const ctx = await requireMember();
  const [events, wedding] = await Promise.all([
    listEvents(ctx.weddingId),
    getWedding(ctx.weddingId),
  ]);
  const overview = await getBudgetOverview(
    ctx.weddingId,
    wedding?.overallBudget ?? null,
    events.map((e) => ({ id: e.id, name: e.name })),
  );
  const noEvent = overview.events.length > 0;

  return (
    <main className="mx-auto w-full max-w-4xl pt-6">
      <MoneyHeader
        active="budget"
        title="Budget"
        blurb="Set a budget for the whole wedding, and if you like, for each category and event."
      />
      <p className="mt-4 text-[13px] text-ink-2">
        Budgets are optional. A line turns red when spending goes over it. Leave a box empty for no
        budget.
      </p>

      <h2 className="mt-6 mb-2 font-serif text-xl text-ink">Whole wedding</h2>
      <ul className={box}>
        <Line
          row={overview.overall}
          editor={
            <BudgetEditor
              label="Whole wedding"
              target={{ kind: "overall" }}
              initial={overview.overall.budget}
            />
          }
        />
      </ul>

      <h2 className="mt-8 mb-2 font-serif text-xl text-ink">By category</h2>
      <ul className={`${box} divide-y divide-line`}>
        {overview.categories.map((row) => (
          <Line
            key={row.key}
            row={row}
            editor={
              <BudgetEditor
                label={row.label}
                target={{ kind: "category", category: row.key as ExpenseCategory }}
                initial={row.budget}
              />
            }
          />
        ))}
      </ul>

      <h2 className="mt-8 mb-2 font-serif text-xl text-ink">By event</h2>
      {noEvent ? (
        <ul className={`${box} divide-y divide-line`}>
          {overview.events.map((row) => (
            <Line
              key={row.key}
              row={row}
              editor={
                <BudgetEditor
                  label={row.label}
                  target={{ kind: "event", eventId: row.key }}
                  initial={row.budget}
                />
              }
            />
          ))}
        </ul>
      ) : (
        <p className={`${box} p-5 text-sm text-ink-2`}>Add events to give each its own budget.</p>
      )}
    </main>
  );
}
