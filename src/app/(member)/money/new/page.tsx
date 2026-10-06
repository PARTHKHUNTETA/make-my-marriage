import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ExpenseForm } from "@/components/money/expense-form";
import { requireMember } from "@/lib/authz";
import { toIstYmd } from "@/lib/dates";
import { listEvents } from "@/modules/events/service";
import { listVendors } from "@/modules/vendors/service";
import { getWedding } from "@/modules/wedding/service";
import type { ExpenseCategory, SplitDefault } from "@/modules/money/schema";

export const metadata: Metadata = { title: "Add expense — Make My Marriage" };

export default async function NewExpensePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const ctx = await requireMember();
  const { eventId } = await searchParams;
  const [events, wedding, vendors] = await Promise.all([
    listEvents(ctx.weddingId),
    getWedding(ctx.weddingId),
    listVendors(ctx.weddingId),
  ]);
  const preset = typeof eventId === "string" && events.some((e) => e.id === eventId) ? eventId : "";
  return (
    <main className="mx-auto w-full max-w-3xl pt-6">
      <Link
        href="/money"
        className="mb-4 inline-flex items-center gap-2 text-[13px] font-semibold text-ink-2 hover:text-ink"
      >
        <ArrowLeft className="size-4" aria-hidden /> Expenses
      </Link>
      <h1 className="mb-6 font-serif text-4xl leading-11 tracking-tight text-plum">Add expense</h1>
      <ExpenseForm
        initial={{
          title: "",
          amount: "",
          date: toIstYmd(new Date()),
          category: "venue",
          paidBy: "couple",
          eventId: preset,
          vendorId: "",
          notes: "",
          splitMode: "percentage",
          shareBride: "",
          shareGroom: "",
          shareCouple: "",
        }}
        events={events.map((e) => ({ id: e.id, name: e.name }))}
        vendors={vendors.map((v) => ({ id: v.vendor.id, name: v.vendor.name }))}
        splitDefaults={
          (wedding?.splitDefaults ?? {}) as Partial<Record<ExpenseCategory, SplitDefault>>
        }
      />
    </main>
  );
}
