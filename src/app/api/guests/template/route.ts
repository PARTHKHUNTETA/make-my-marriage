import { NextResponse } from "next/server";
import { requireMember } from "@/lib/authz";
import { toCsv } from "@/lib/csv";
import { jsonError } from "@/lib/http";
import { listEvents } from "@/modules/events/service";
import { templateRows } from "@/modules/guests/import";

export const dynamic = "force-dynamic";

// GET /api/guests/template: the import template, with this wedding's own event names in the
// examples. Members only.
export async function GET() {
  try {
    const ctx = await requireMember();
    const events = await listEvents(ctx.weddingId);
    return new NextResponse(toCsv(templateRows(events.map((e) => e.name))), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="guest-import-template.csv"',
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    return jsonError(err);
  }
}
