import { NextResponse } from "next/server";
import { requireMember } from "@/lib/authz";
import { toCsv } from "@/lib/csv";
import { jsonError } from "@/lib/http";
import { getEvent } from "@/modules/events/service";
import { getSeatingPlan } from "@/modules/seating/plan";

export const dynamic = "force-dynamic";

// GET /api/seating/export?eventId=: the seating chart as CSV, one row per party per table, then the
// parties still to seat. Members only.
export async function GET(request: Request) {
  try {
    const ctx = await requireMember();
    const eventId = new URL(request.url).searchParams.get("eventId") ?? "";
    const event = await getEvent(ctx.weddingId, eventId);
    if (!event)
      return NextResponse.json(
        { ok: false, error: { code: "NOT_FOUND", message: "That event no longer exists." } },
        { status: 404 },
      );
    const plan = await getSeatingPlan(ctx.weddingId, event.id);
    const rows: Array<Array<string | number>> = [
      ["Table", "Seats at table", "Party", "Seats taken"],
    ];
    for (const t of plan.tables) {
      if (t.seated.length === 0) rows.push([t.table.name, t.table.capacity, "", ""]);
      for (const s of t.seated) rows.push([t.table.name, t.table.capacity, s.party.name, s.seats]);
    }
    for (const u of plan.unseated) rows.push(["Not seated yet", "", u.party.name, u.remaining]);
    const file = `seating-${event.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.csv`;
    return new NextResponse(toCsv(rows), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${file}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    return jsonError(err);
  }
}
