import { NextResponse } from "next/server";
import { requireMember } from "@/lib/authz";
import { toCsv } from "@/lib/csv";
import { toIstYmd } from "@/lib/dates";
import { jsonError } from "@/lib/http";
import { listEvents } from "@/modules/events/service";
import { VENDOR_CATEGORY_LABELS } from "@/modules/vendors/schema";
import { listVendors } from "@/modules/vendors/service";

export const dynamic = "force-dynamic";

const rupees = (paise: number) => (paise / 100).toFixed(2);

// GET /api/vendors/export: the family's vendors as a spreadsheet, with what is paid and what is
// still owed. Members only; amounts are in rupees.
export async function GET() {
  try {
    const ctx = await requireMember();
    const [vendors, events] = await Promise.all([
      listVendors(ctx.weddingId),
      listEvents(ctx.weddingId),
    ]);
    const eventName = new Map(events.map((e) => [e.id, e.name]));
    const rows: Array<Array<string | number | undefined>> = [
      [
        "Vendor",
        "Category",
        "Phone",
        "Email",
        "Address",
        "Total cost (₹)",
        "Paid so far (₹)",
        "Still to pay (₹)",
        "Next payment due",
        "Events",
        "Notes",
      ],
      ...vendors.map(({ vendor: v }) => {
        const paid = v.installments
          .filter((i) => i.status === "paid")
          .reduce((n, i) => n + i.amount, 0);
        const next = v.installments
          .filter((i) => i.status !== "paid")
          .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime())[0];
        return [
          v.name,
          VENDOR_CATEGORY_LABELS[v.category],
          v.phone,
          v.email,
          v.address,
          v.totalCost === undefined ? "" : rupees(v.totalCost),
          rupees(paid),
          v.totalCost === undefined ? "" : rupees(Math.max(0, v.totalCost - paid)),
          next ? toIstYmd(next.dueDate) : "",
          v.eventIds
            .map((id) => eventName.get(id))
            .filter(Boolean)
            .join("; "),
          v.notes,
        ];
      }),
    ];
    return new NextResponse(toCsv(rows), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="vendors.csv"',
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    return jsonError(err);
  }
}
