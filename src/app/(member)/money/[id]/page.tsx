import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { DeleteExpenseButton } from "@/components/money/delete-expense-button";
import { ExpenseForm } from "@/components/money/expense-form";
import { hasPermission } from "@/lib/authz";
import { requirePagePermission } from "@/lib/page-guard";
import { ViewOnly } from "@/components/permissions/view-only";
import { toIstYmd } from "@/lib/dates";
import { toRupeeInput } from "@/lib/money";
import { listEvents } from "@/modules/events/service";
import { listVendors } from "@/modules/vendors/service";
import { getExpense, getReceiptUrl } from "@/modules/money/service";
import type { ExpenseCategory, SplitDefault } from "@/modules/money/schema";
import { getWedding } from "@/modules/wedding/service";

export const metadata: Metadata = { title: "Expense — Make My Marriage" };

export default async function ExpensePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ receipt?: string }>;
}) {
  const ctx = await requirePagePermission("expense.view");
  const canEdit = hasPermission(ctx, "expense.edit");
  const { id } = await params;
  const { receipt } = await searchParams;
  const [expense, events, wedding, vendors] = await Promise.all([
    getExpense(ctx.weddingId, id),
    listEvents(ctx.weddingId),
    getWedding(ctx.weddingId),
    listVendors(ctx.weddingId),
  ]);
  if (!expense) notFound();
  const receiptUrl = expense.hasReceipt ? await getReceiptUrl(ctx.weddingId, id) : undefined;

  // Saved splits come back into the form in the same mode they were saved in.
  const byAmount = expense.splits?.some((s) => s.amount !== undefined) ?? false;
  const share = (payer: "bride_family" | "groom_family" | "couple") => {
    const s = expense.splits?.find((x) => x.payer === payer);
    if (!s) return "";
    return byAmount ? toRupeeInput(s.amount ?? 0) : String(s.percentage ?? "");
  };

  return (
    <main className="mx-auto w-full max-w-3xl pt-6">
      <Link
        href="/money"
        className="mb-4 inline-flex items-center gap-2 text-[13px] font-semibold text-ink-2 hover:text-ink"
      >
        <ArrowLeft className="size-4" aria-hidden /> Expenses
      </Link>
      <h1 className="mb-6 font-serif text-4xl leading-11 tracking-tight text-plum">Edit expense</h1>
      {expense.installmentId ? (
        <section className="rounded-xl bg-white p-5 text-sm text-ink-2 shadow-[0_1px_3px_rgba(35,31,32,0.04)]">
          <p className="font-semibold text-ink">{expense.title}</p>
          <p className="mt-1">
            This expense was created when a vendor payment was marked paid, so it is changed there.
            To edit or remove it, mark the payment unpaid first.
          </p>
          <Link
            href={expense.vendorId ? `/vendors/${expense.vendorId}` : "/money/payments"}
            className="mt-3 inline-block font-semibold text-bronze hover:underline"
          >
            Go to the payment
          </Link>
        </section>
      ) : (
        <div className="flex flex-col gap-6">
          {receipt === "failed" ? (
            <p
              role="alert"
              className="rounded-lg border border-destructive/30 bg-destructive/10 px-3.5 py-3 text-[13px] font-medium text-ink"
            >
              The expense is saved, but its photo could not be added. You can add it again below.
            </p>
          ) : null}
          <ViewOnly when={!canEdit}>
            <ExpenseForm
              expenseId={expense.id}
              initial={{
                title: expense.title,
                amount: toRupeeInput(expense.amount),
                date: toIstYmd(expense.date),
                category: expense.category,
                paidBy: expense.paidBy,
                eventId: events.some((e) => e.id === expense.eventId)
                  ? (expense.eventId ?? "")
                  : "",
                vendorId: vendors.some((v) => v.vendor.id === expense.vendorId)
                  ? (expense.vendorId ?? "")
                  : "",
                notes: expense.notes ?? "",
                splitMode: byAmount ? "amount" : "percentage",
                shareBride: share("bride_family"),
                shareGroom: share("groom_family"),
                shareCouple: share("couple"),
              }}
              events={events.map((e) => ({ id: e.id, name: e.name }))}
              vendors={vendors.map((v) => ({ id: v.vendor.id, name: v.vendor.name }))}
              receiptUrl={receiptUrl}
              splitDefaults={
                (wedding?.splitDefaults ?? {}) as Partial<Record<ExpenseCategory, SplitDefault>>
              }
            />
          </ViewOnly>
          {canEdit ? <DeleteExpenseButton expenseId={expense.id} /> : null}
        </div>
      )}
    </main>
  );
}
