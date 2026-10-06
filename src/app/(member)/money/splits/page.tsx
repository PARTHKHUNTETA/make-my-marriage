import type { Metadata } from "next";
import { MoneyHeader } from "@/components/money/money-header";
import { SplitDefaultRow } from "@/components/money/split-default-row";
import { requireMember } from "@/lib/authz";
import { formatRupees } from "@/lib/money";
import {
  CATEGORY_LABELS,
  EXPENSE_CATEGORIES,
  PAYERS,
  PAYER_LABELS,
  type ExpenseCategory,
  type SplitDefault,
} from "@/modules/money/schema";
import { getSummary } from "@/modules/money/service";
import { getWedding } from "@/modules/wedding/service";

export const metadata: Metadata = { title: "Who paid — Make My Marriage" };

const box = "rounded-xl bg-white p-5 shadow-[0_1px_3px_rgba(35,31,32,0.04)]";

export default async function SplitsPage() {
  const ctx = await requireMember();
  const [summary, wedding] = await Promise.all([
    getSummary(ctx.weddingId),
    getWedding(ctx.weddingId),
  ]);
  const defaults = (wedding?.splitDefaults ?? {}) as Partial<Record<ExpenseCategory, SplitDefault>>;
  const used = EXPENSE_CATEGORIES.filter((c) => summary.byCategory[c]);

  return (
    <main className="mx-auto w-full max-w-4xl pt-6">
      <MoneyHeader
        active="splits"
        title="Who paid"
        blurb="How much each side has contributed, overall and by category."
      />

      <section aria-label="Contribution by payer" className="mt-6 grid gap-3 sm:grid-cols-3">
        {PAYERS.map((payer) => {
          const amount = summary.byPayer[payer];
          const percent = summary.total > 0 ? Math.round((amount / summary.total) * 100) : 0;
          return (
            <div key={payer} className={box}>
              <p className="font-serif text-3xl text-plum">{formatRupees(amount)}</p>
              <p className="text-[13px] text-ink-2">
                {PAYER_LABELS[payer]}
                {summary.total > 0 ? ` · ${percent}%` : ""}
              </p>
            </div>
          );
        })}
      </section>

      <h2 className="mt-8 mb-2 font-serif text-xl text-ink">By category</h2>
      {used.length === 0 ? (
        <p className={`${box} text-sm text-ink-2`}>
          Nothing spent yet. Shared expenses are divided between the payers by their split.
        </p>
      ) : (
        <div className={`${box} overflow-x-auto p-0`}>
          <table className="w-full min-w-[34rem] text-left text-[13px]">
            <thead className="border-b border-line text-xs text-ink-2">
              <tr>
                <th className="px-5 py-2.5 font-semibold">Category</th>
                {PAYERS.map((p) => (
                  <th key={p} className="px-3 py-2.5 text-right font-semibold">
                    {PAYER_LABELS[p]}
                  </th>
                ))}
                <th className="px-5 py-2.5 text-right font-semibold">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {used.map((c) => (
                <tr key={c}>
                  <td className="px-5 py-2.5 font-semibold text-ink">{CATEGORY_LABELS[c]}</td>
                  {PAYERS.map((p) => (
                    <td key={p} className="px-3 py-2.5 text-right text-ink-2">
                      {formatRupees(summary.byPayerByCategory[c]?.[p] ?? 0)}
                    </td>
                  ))}
                  <td className="px-5 py-2.5 text-right font-semibold text-ink">
                    {formatRupees(summary.byCategory[c]!)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h2 className="mt-8 mb-1 font-serif text-xl text-ink">Usual split for shared expenses</h2>
      <p className="mb-2 text-[13px] text-ink-2">
        Set the percentages a category usually splits into, for example Catering 50 / 50. New shared
        expenses in that category start from it, and you can still change any one of them. Clear all
        three boxes to remove a default.
      </p>
      <div className={box}>
        <div className="mb-1 hidden gap-3 text-xs font-semibold text-ink-2 sm:flex">
          <span className="w-32" />
          <span className="w-20 text-right">Bride&rsquo;s</span>
          <span className="w-20 text-right">Groom&rsquo;s</span>
          <span className="w-20 text-right">Couple</span>
        </div>
        <div className="divide-y divide-line">
          {EXPENSE_CATEGORIES.map((c) => (
            <SplitDefaultRow
              key={c}
              category={c}
              label={CATEGORY_LABELS[c]}
              initial={defaults[c]}
            />
          ))}
        </div>
      </div>
    </main>
  );
}
