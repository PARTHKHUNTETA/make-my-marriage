import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const listGuests = vi.hoisted(() => vi.fn());
const listEvents = vi.hoisted(() => vi.fn());
const listTasks = vi.hoisted(() => vi.fn());
const listVendors = vi.hoisted(() => vi.fn());
const listEveryExpense = vi.hoisted(() => vi.fn());
vi.mock("@/modules/guests/service", () => ({ listGuests }));
vi.mock("@/modules/events/service", () => ({ listEvents }));
vi.mock("@/modules/tasks/service", () => ({ listTasks }));
vi.mock("@/modules/vendors/service", () => ({ listVendors }));
vi.mock("@/modules/money/service", () => ({ listEveryExpense }));

import { searchWedding } from "./service";

const day = new Date("2027-02-12T00:00:00+05:30");
const guest = (id: string, name: string, over = {}) => ({
  id,
  name,
  phone: "+919876543210",
  email: `${id}@example.com`,
  ...over,
});
const event = (id: string, name: string, over = {}) => ({
  id,
  name,
  date: day,
  venueName: "The Leela",
  address: "Udaipur",
  ...over,
});
const task = (id: string, title: string) => ({ id, title, status: "todo", priority: "high" });
const vendor = (id: string, name: string, category = "photographer") => ({
  vendor: { id, name, category, phone: "98", email: "v@example.com" },
  spent: 0,
});
const expense = (id: string, title: string, over = {}) => ({
  id,
  title,
  amount: 5_000_000,
  category: "venue",
  ...over,
});

beforeEach(() => {
  listGuests
    .mockReset()
    .mockResolvedValue({ items: [guest("g1", "Meera Shah"), guest("g2", "Meera Iyer")] });
  listEvents
    .mockReset()
    .mockResolvedValue([
      event("e1", "Sangeet"),
      event("e2", "Wedding", { venueName: "Meera Palace" }),
    ]);
  listTasks
    .mockReset()
    .mockResolvedValue([task("t1", "Book the band"), task("t2", "Meera's outfit fitting")]);
  listVendors
    .mockReset()
    .mockResolvedValue([vendor("v1", "Royal Photography"), vendor("v2", "Band Baaja", "dj")]);
  listEveryExpense
    .mockReset()
    .mockResolvedValue([
      expense("x1", "Venue deposit"),
      expense("x2", "Band advance", { notes: "for Meera" }),
    ]);
});

describe("searchWedding", () => {
  it("asks each module for this wedding only", async () => {
    await searchWedding("w1", "m1", "meera");
    expect(listGuests).toHaveBeenCalledWith("w1", { search: "meera", page: 1 });
    expect(listEvents).toHaveBeenCalledWith("w1");
    expect(listTasks).toHaveBeenCalledWith("w1", { view: "all" }, "m1");
    expect(listVendors).toHaveBeenCalledWith("w1");
    expect(listEveryExpense).toHaveBeenCalledWith("w1");
  });

  it("finds a word in names, venues, titles and notes, whatever the capital letters", async () => {
    const hits = await searchWedding("w1", "m1", "MEERA");
    expect(hits.map((h) => `${h.kind}:${h.title}`)).toEqual([
      "guest:Meera Shah",
      "guest:Meera Iyer",
      "event:Wedding", // matched on its venue
      "task:Meera's outfit fitting",
      "expense:Band advance", // matched on its note
    ]);
  });

  it("leaves out what does not match, and returns nothing when nothing does", async () => {
    listGuests.mockResolvedValue({ items: [] });
    expect(await searchWedding("w1", "m1", "zzzz")).toEqual([]);
    const band = await searchWedding("w1", "m1", "band");
    expect(band.map((h) => h.title)).toEqual(["Book the band", "Band Baaja", "Band advance"]);
  });

  it("matches a vendor by its category as well as its name", async () => {
    listGuests.mockResolvedValue({ items: [] }); // the real guest search filters in the database
    const hits = await searchWedding("w1", "m1", "photographer");
    expect(hits).toEqual([
      expect.objectContaining({
        kind: "vendor",
        title: "Royal Photography",
        subtitle: "Photographer",
      }),
    ]);
  });

  it("keeps each kind to five, so one busy kind cannot crowd out the rest", async () => {
    listGuests.mockResolvedValue({
      items: Array.from({ length: 9 }, (_, i) => guest(`g${i}`, `Meera ${i}`)),
    });
    listEveryExpense.mockResolvedValue(
      Array.from({ length: 12 }, (_, i) => expense(`x${i}`, `Meera gift ${i}`)),
    );
    const hits = await searchWedding("w1", "m1", "meera");
    expect(hits.filter((h) => h.kind === "guest")).toHaveLength(5);
    expect(hits.filter((h) => h.kind === "expense")).toHaveLength(5);
    expect(hits.some((h) => h.kind === "event")).toBe(true);
  });

  it("gives each hit the address of its own page and a line to tell similar ones apart", async () => {
    const hits = await searchWedding("w1", "m1", "meera");
    expect(hits[0]).toMatchObject({
      href: "/guests/g1",
      subtitle: "+919876543210 · g1@example.com",
    });
    expect(hits.find((h) => h.kind === "event")).toMatchObject({
      href: "/events/e2",
      subtitle: "2027-02-12 · Meera Palace",
    });
    expect(hits.find((h) => h.kind === "task")).toMatchObject({
      href: "/tasks/t2",
      subtitle: "To do · High priority",
    });
    expect(hits.find((h) => h.kind === "expense")).toMatchObject({
      href: "/money/x2",
      subtitle: "₹50,000 · Venue",
    });
  });
});
