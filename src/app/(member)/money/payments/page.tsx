import type { Metadata } from "next";
import Link from "next/link";
import { MoneyHeader } from "@/components/money/money-header";
import { requireMember } from "@/lib/authz";
import { formatRupees } from "@/lib/money";
import { INSTALLMENT_LABELS, type InstallmentStatus } from "@/modules/vendors/schema";
import { getPaymentSchedule } from "@/modules/vendors/service";

export const metadata: Metadata = { title: "Payments — Make My Marriage" };

const badge: Record<InstallmentStatus, string> = {
  upcoming: "bg-rose-200 text-ink-2",
  due: "bg-honey/25 text-bronze",
  overdue: "bg-destructive/10 text-destructive",
  paid: "bg-forest/15 text-forest",
};
const date = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "Asia/Kolkata",
});
const box = "rounded-xl bg-white shadow-[0_1px_3px_rgba(35,31,32,0.04)]";

export default async function PaymentsPage() {
  const ctx = await requireMember();
  const { rows, balances } = await getPaymentSchedule(ctx.weddingId);
  const toPay = rows.filter((r) => r.installment.status !== "paid");
  const overdue = toPay.filter((r) => r.installment.status === "overdue");

  return (
    <main className="mx-auto w-full max-w-4xl pt-6">
      <MoneyHeader
        active="payments"
        title="Payments"
        blurb="Every vendor payment by due date. Plan them on each vendor's page."
      />

      {overdue.length > 0 ? (
        <p
          role="status"
          className="mt-5 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm font-medium text-destructive"
        >
          {overdue.length} {overdue.length === 1 ? "payment is" : "payments are"} overdue.
        </p>
      ) : null}

      <h2 className="mt-6 mb-2 font-serif text-xl text-ink">Schedule</h2>
      {rows.length === 0 ? (
        <p className={`${box} p-5 text-sm text-ink-2`}>
          No payments planned yet.{" "}
          <Link href="/vendors" className="font-semibold text-bronze hover:underline">
            Open a vendor
          </Link>{" "}
          to add its advance and final payment.
        </p>
      ) : (
        <ul className={`${box} divide-y divide-line`}>
          {rows.map(({ vendorId, vendorName, installment }) => (
            <li
              key={installment.id}
              className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3.5"
            >
              <div className="min-w-0 flex-1 basis-48">
                <Link
                  href={`/vendors/${vendorId}`}
                  className="text-sm font-semibold text-ink hover:underline"
                >
                  {vendorName}
                </Link>
                <p className="text-[13px] text-ink-2">
                  {installment.label} ·{" "}
                  {installment.paidOn
                    ? `paid ${date.format(installment.paidOn)}`
                    : `due ${date.format(installment.dueDate)}`}
                </p>
              </div>
              <span className="text-sm font-semibold text-ink">
                {formatRupees(installment.amount)}
              </span>
              <span
                className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${badge[installment.status]}`}
              >
                {INSTALLMENT_LABELS[installment.status]}
              </span>
            </li>
          ))}
        </ul>
      )}

      <h2 className="mt-8 mb-2 font-serif text-xl text-ink">By vendor</h2>
      {balances.length === 0 ? (
        <p className={`${box} p-5 text-sm text-ink-2`}>
          Vendors with a cost or payments appear here.
        </p>
      ) : (
        <div className={`${box} overflow-x-auto`}>
          <table className="w-full min-w-[32rem] text-left text-[13px]">
            <thead className="border-b border-line text-xs text-ink-2">
              <tr>
                <th className="px-5 py-2.5 font-semibold">Vendor</th>
                <th className="px-3 py-2.5 text-right font-semibold">Total cost</th>
                <th className="px-3 py-2.5 text-right font-semibold">Paid so far</th>
                <th className="px-5 py-2.5 text-right font-semibold">Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {balances.map((b) => (
                <tr key={b.vendorId}>
                  <td className="px-5 py-2.5 font-semibold text-ink">
                    <Link href={`/vendors/${b.vendorId}`} className="hover:underline">
                      {b.name}
                    </Link>
                  </td>
                  <td className="px-3 py-2.5 text-right text-ink-2">
                    {b.totalCost === undefined ? "Not set" : formatRupees(b.totalCost)}
                  </td>
                  <td className="px-3 py-2.5 text-right text-ink-2">{formatRupees(b.spent)}</td>
                  <td
                    className={`px-5 py-2.5 text-right font-semibold ${b.balance !== undefined && b.balance < 0 ? "text-destructive" : "text-ink"}`}
                  >
                    {b.balance === undefined
                      ? "—"
                      : b.balance < 0
                        ? `${formatRupees(-b.balance)} over`
                        : formatRupees(b.balance)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
