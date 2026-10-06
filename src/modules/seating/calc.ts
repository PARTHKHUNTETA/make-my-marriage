import type { PlannedTable, SeatingParty, SeatingPlan, TableItem, Unseated } from "./schema";

// The seating arithmetic, kept pure so every rule is easy to test (PRD 5.13).

// How many seats a party takes at an event: the number attending once it has replied, the number
// allowed until then, and none if it is not coming.
export function seatNeed(
  party: Pick<SeatingParty, "status" | "guestsAllowed" | "numberAttending">,
): number {
  if (party.status === "not_attending") return 0;
  if (party.status === "attending") return party.numberAttending ?? party.guestsAllowed;
  return party.guestsAllowed;
}

export function buildPlan(tables: TableItem[], parties: SeatingParty[]): SeatingPlan {
  const byId = new Map(parties.map((p) => [p.id, p]));
  const seatedByParty = new Map<string, number>();
  for (const table of tables)
    for (const a of table.assignments)
      seatedByParty.set(a.guestId, (seatedByParty.get(a.guestId) ?? 0) + a.seats);

  const planned: PlannedTable[] = tables.map((table) => {
    const seated = table.assignments.flatMap((a) => {
      const party = byId.get(a.guestId);
      // A party that was deleted or taken off this event has nothing left to seat.
      if (!party) return [];
      const need = seatNeed(party);
      return [
        {
          party,
          seats: a.seats,
          notAttending: party.status === "not_attending",
          tooMany: party.status !== "not_attending" && (seatedByParty.get(a.guestId) ?? 0) > need,
        },
      ];
    });
    const used = seated.reduce((sum, s) => sum + s.seats, 0);
    return { table, seated, used, free: table.capacity - used, over: used > table.capacity };
  });

  const unseated: Unseated[] = [];
  const awaitingReply: Unseated[] = [];
  for (const party of parties) {
    const need = seatNeed(party);
    if (need === 0) continue;
    const seated = seatedByParty.get(party.id) ?? 0;
    const row = { party, need, seated, remaining: Math.max(0, need - seated) };
    if (row.remaining === 0) continue;
    (party.status === "attending" ? unseated : awaitingReply).push(row);
  }
  const byName = (a: Unseated, b: Unseated) => a.party.name.localeCompare(b.party.name);

  return {
    tables: planned,
    unseated: unseated.sort(byName),
    awaitingReply: awaitingReply.sort(byName),
    totalSeats: tables.reduce((sum, t) => sum + t.capacity, 0),
    seatedPeople: planned.reduce((sum, t) => sum + t.seated.reduce((s, x) => s + x.seats, 0), 0),
    needingSeats: parties.reduce((sum, p) => sum + (p.status === "attending" ? seatNeed(p) : 0), 0),
  };
}

// The table or tables a party sits at, for "Your table: 7" ("Tables 7 and 9" when split).
export function describeTables(names: string[]): string {
  if (names.length === 0) return "";
  if (names.length === 1) return `Your table: ${names[0]}`;
  return `Your tables: ${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}
