import { NextResponse } from "next/server";
import { jsonError } from "@/lib/http";
import { requireMember } from "@/lib/authz";
import { toCsv } from "@/lib/csv";
import { listEvents } from "@/modules/events/service";
import { RSVP_LABELS } from "@/modules/guests/schema";
import { listEveryGuest } from "@/modules/guests/service";

export const dynamic = "force-dynamic";

// GET /api/guests/export?eventId=: headcounts as CSV for the caterer (PRD 5.6). Members only.
// With an event, one row per invited guest; without, one row per guest and event.
export async function GET(request: Request) {
  try {
    const ctx = await requireMember();
    const eventId = new URL(request.url).searchParams.get("eventId") ?? undefined;
    const events = await listEvents(ctx.weddingId);
    const names = new Map(events.map((e) => [e.id, e.name]));
    if (eventId && !names.has(eventId))
      return NextResponse.json(
        { ok: false, error: { code: "NOT_FOUND", message: "That event no longer exists." } },
        { status: 404 },
      );
    const guests = await listEveryGuest(ctx.weddingId, { eventId });

    const rows: Array<Array<string | number | undefined>> = [
      ["Event", "Guest", "Phone", "Email", "Reply", "People attending", "Guests allowed"],
    ];
    for (const event of events) {
      if (eventId && event.id !== eventId) continue;
      for (const guest of guests) {
        const reply = guest.invitations.find((i) => i.eventId === event.id);
        if (!reply) continue;
        rows.push([
          event.name,
          guest.name,
          guest.phone,
          guest.email,
          RSVP_LABELS[reply.rsvpStatus],
          reply.rsvpStatus === "attending" ? reply.numberAttending : undefined,
          guest.guestsAllowed,
        ]);
      }
    }

    const label = eventId ? (names.get(eventId) ?? "event") : "all-events";
    const file = `guests-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.csv`;
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
