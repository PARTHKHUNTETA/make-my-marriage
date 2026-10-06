import { describe, expect, it } from "vitest";
import { buildPlan, describeTables, seatNeed } from "./calc";
import type { SeatingParty, TableItem } from "./schema";

const party = (id: string, over: Partial<SeatingParty> = {}): SeatingParty => ({
  id,
  name: `Party ${id}`,
  status: "attending",
  guestsAllowed: 4,
  numberAttending: 3,
  ...over,
});
const table = (
  id: string,
  capacity: number,
  assignments: Array<[string, number]> = [],
): TableItem => ({
  id,
  eventId: "e1",
  name: `Table ${id}`,
  capacity,
  assignments: assignments.map(([guestId, seats]) => ({ guestId, seats })),
});

describe("seatNeed", () => {
  it("is the number attending once replied, the number allowed until then, and zero if not coming", () => {
    expect(seatNeed({ status: "attending", guestsAllowed: 4, numberAttending: 3 })).toBe(3);
    expect(seatNeed({ status: "pending", guestsAllowed: 4 })).toBe(4);
    expect(seatNeed({ status: "not_attending", guestsAllowed: 4 })).toBe(0);
  });
  it("falls back to the number allowed if an attending party has no headcount", () => {
    expect(seatNeed({ status: "attending", guestsAllowed: 4 })).toBe(4);
  });
});

describe("buildPlan", () => {
  it("counts seats used and free per table", () => {
    const plan = buildPlan(
      [
        table("1", 10, [
          ["a", 3],
          ["b", 4],
        ]),
      ],
      [party("a"), party("b", { numberAttending: 4 })],
    );
    expect(plan.tables[0]).toMatchObject({ used: 7, free: 3, over: false });
    expect(plan.seatedPeople).toBe(7);
    expect(plan.totalSeats).toBe(10);
  });

  it("flags a table that holds more than its capacity", () => {
    const plan = buildPlan(
      [
        table("1", 5, [
          ["a", 3],
          ["b", 4],
        ]),
      ],
      [party("a"), party("b", { numberAttending: 4 })],
    );
    expect(plan.tables[0]).toMatchObject({ used: 7, free: -2, over: true });
  });

  it("lists attending parties with no table, sorted by name, in the unseated list", () => {
    const plan = buildPlan(
      [table("1", 10, [["a", 3]])],
      [party("a"), party("c", { name: "Zed" }), party("b", { name: "Amy" })],
    );
    expect(plan.unseated.map((u) => [u.party.name, u.remaining])).toEqual([
      ["Amy", 3],
      ["Zed", 3],
    ]);
  });

  it("a party split across two tables is seated once both parts are placed, and part-seated until then", () => {
    const tables = [table("1", 10, [["a", 2]]), table("2", 10, [["a", 1]])];
    expect(buildPlan(tables, [party("a")]).unseated).toEqual([]);
    const partly = buildPlan([table("1", 10, [["a", 2]])], [party("a")]);
    expect(partly.unseated[0]).toMatchObject({ need: 3, seated: 2, remaining: 1 });
  });

  it("parties who have not replied can be seated by the number allowed, listed apart", () => {
    const plan = buildPlan([], [party("p", { status: "pending", numberAttending: undefined })]);
    expect(plan.unseated).toEqual([]);
    expect(plan.awaitingReply[0]).toMatchObject({ need: 4, remaining: 4 });
  });

  it("parties who are not coming never need seats, and are flagged if still seated", () => {
    const gone = party("n", { status: "not_attending" });
    const plan = buildPlan([table("1", 10, [["n", 2]])], [gone]);
    expect(plan.unseated).toEqual([]);
    expect(plan.awaitingReply).toEqual([]);
    expect(plan.tables[0]!.seated[0]).toMatchObject({ notAttending: true });
  });

  it("flags a party with more seats than it needs, after its headcount went down", () => {
    const plan = buildPlan([table("1", 10, [["a", 4]])], [party("a", { numberAttending: 2 })]);
    expect(plan.tables[0]!.seated[0]).toMatchObject({ tooMany: true });
    expect(plan.unseated).toEqual([]);
  });

  it("ignores assignments for a party that no longer exists on this event", () => {
    const plan = buildPlan([table("1", 10, [["ghost", 5]])], []);
    expect(plan.tables[0]).toMatchObject({ used: 0, seated: [] });
  });

  it("counts the people who still need seats", () => {
    const plan = buildPlan(
      [],
      [party("a"), party("b", { numberAttending: 2 }), party("p", { status: "pending" })],
    );
    expect(plan.needingSeats).toBe(5);
  });
});

describe("describeTables", () => {
  it("says which table, or tables", () => {
    expect(describeTables([])).toBe("");
    expect(describeTables(["7"])).toBe("Your table: 7");
    expect(describeTables(["7", "9"])).toBe("Your tables: 7 and 9");
    expect(describeTables(["1", "2", "3"])).toBe("Your tables: 1, 2 and 3");
  });
});
