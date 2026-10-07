import { NextResponse } from "next/server";
import { requireMember } from "@/lib/authz";
import { toCsv } from "@/lib/csv";
import { toIstYmd } from "@/lib/dates";
import { jsonError } from "@/lib/http";
import { listEvents } from "@/modules/events/service";
import { CATEGORY_LABELS, PAYER_LABELS } from "@/modules/money/schema";
import { listEveryExpense } from "@/modules/money/service";
import { listVendors } from "@/modules/vendors/service";

export const dynamic = "force-dynamic";

// GET /api/money/export: every expense as a spreadsheet, newest first, for the family's own records
// (and the right to take your information with you). Members only; amounts are in rupees.
export async function GET() {
  try {
    const ctx = await requireMember();
    const [expenses, events, vendors] = await Promise.all([
      listEveryExpense(ctx.weddingId),
      listEvents(ctx.weddingId),
      listVendors(ctx.weddingId),
    ]);
    const eventName = new Map(events.map((e) => [e.id, e.name]));
    const vendorName = new Map(vendors.map(({ vendor }) => [vendor.id, vendor.name]));
    const rows: Array<Array<string | number | undefined>> = [
      ["Date", "Title", "Category", "Amount (₹)", "Paid by", "Event", "Vendor", "Notes"],
      ...[...expenses]
        .sort((a, b) => b.date.getTime() - a.date.getTime())
        .map((e) => [
          toIstYmd(e.date),
          e.title,
          CATEGORY_LABELS[e.category],
          (e.amount / 100).toFixed(2),
          PAYER_LABELS[e.paidBy],
          e.eventId ? (eventName.get(e.eventId) ?? "") : "",
          e.vendorId ? (vendorName.get(e.vendorId) ?? "") : "",
          e.notes,
        ]),
    ];
    return new NextResponse(toCsv(rows), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="expenses.csv"',
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    return jsonError(err);
  }
}
