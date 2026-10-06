import { describe, expect, it } from "vitest";
import {
  acceptQuoteSchema,
  bookingRequestSchema,
  parseListingQuery,
  quoteSchema,
  listingInputSchema,
  staffDecisionSchema,
  vendorLoginSchema,
  vendorSignupSchema,
} from "./schema";

const listing = {
  category: "photographer",
  cities: "Jaipur",
  description: "Candid wedding photography.",
};
const parse = (over = {}) => listingInputSchema.safeParse({ ...listing, ...over });

describe("vendorSignupSchema", () => {
  const valid = {
    businessName: "Pixel Photography",
    email: " Hello@Pixel.in ",
    phone: "98765 43210",
    password: "a-long-enough-pass",
  };
  it("normalises the email and phone", () => {
    const r = vendorSignupSchema.safeParse(valid);
    expect(r.success && r.data).toMatchObject({ email: "hello@pixel.in", phone: "+919876543210" });
  });
  it("needs a business name, a phone, a good email and a 10+ character password", () => {
    for (const bad of [
      { businessName: " " },
      { phone: "" },
      { phone: "123" },
      { email: "nope" },
      { password: "short" },
    ])
      expect(vendorSignupSchema.safeParse({ ...valid, ...bad }).success).toBe(false);
  });
});

describe("vendorLoginSchema", () => {
  it("needs an email and a password, and remembers nothing by default", () => {
    const r = vendorLoginSchema.safeParse({ email: "A@B.co", password: "x" });
    expect(r.success && r.data).toMatchObject({ email: "a@b.co", remember: false });
    expect(vendorLoginSchema.safeParse({ email: "a@b.co", password: "" }).success).toBe(false);
  });
});

describe("listingInputSchema", () => {
  it("accepts the required fields", () => {
    const r = parse();
    expect(r.success && r.data).toMatchObject({ category: "photographer", cities: ["Jaipur"] });
  });
  it("splits cities, trims and removes repeats, up to ten", () => {
    const r = parse({ cities: " Jaipur ,Udaipur;  jaipur , Jaipur " });
    expect(r.success && r.data.cities).toEqual(["Jaipur", "Udaipur", "jaipur"]);
    expect(parse({ cities: "" }).success).toBe(false);
    expect(
      parse({ cities: Array.from({ length: 11 }, (_, i) => `City${i}`).join(",") }).success,
    ).toBe(false);
    expect(parse({ cities: "x".repeat(61) }).success).toBe(false);
  });
  it("turns the starting price into paise and treats blank as none", () => {
    const r = parse({ startingPrice: "50,000" });
    expect(r.success && r.data.startingPrice).toBe(5_000_000);
    const blank = parse({ startingPrice: "" });
    expect(blank.success && blank.data.startingPrice).toBeUndefined();
    expect(parse({ startingPrice: "0" }).success).toBe(false);
    expect(parse({ startingPrice: "lots" }).success).toBe(false);
  });
  it("makes website and Instagram into safe https links", () => {
    const r = parse({ website: "pixelphoto.in", instagram: "@pixel.photo" });
    expect(r.success && r.data).toMatchObject({
      website: "https://pixelphoto.in/",
      instagram: "https://instagram.com/pixel.photo",
    });
    const url = parse({ instagram: "https://www.instagram.com/pixel/" });
    expect(url.success && url.data.instagram).toBe("https://www.instagram.com/pixel/");
  });
  it("refuses links that are not http(s), so a listing cannot carry a script into a browser", () => {
    for (const bad of [
      "javascript:alert(1)",
      "data:text/html,hi",
      "ftp://x.com",
      "not a link",
      "http://localhost",
    ])
      expect(parse({ website: bad }).success).toBe(false);
  });
  it("needs a description and a known category", () => {
    expect(parse({ description: " " }).success).toBe(false);
    expect(parse({ description: "x".repeat(2001) }).success).toBe(false);
    expect(parse({ category: "magician" }).success).toBe(false);
  });
});

describe("staffDecisionSchema", () => {
  const id = "507f1f77bcf86cd799439011";
  it("takes approve, reject or suspend with an optional note", () => {
    expect(staffDecisionSchema.safeParse({ listingId: id, decision: "approve" }).success).toBe(
      true,
    );
    const r = staffDecisionSchema.safeParse({
      listingId: id,
      decision: "reject",
      note: " Photos missing ",
    });
    expect(r.success && r.data.note).toBe("Photos missing");
    expect(staffDecisionSchema.safeParse({ listingId: id, decision: "delete" }).success).toBe(
      false,
    );
    expect(staffDecisionSchema.safeParse({ listingId: "x", decision: "approve" }).success).toBe(
      false,
    );
  });
});

describe("parseListingQuery", () => {
  it("reads filters, prices in rupees, sort and page", () => {
    expect(
      parseListingQuery({
        category: "florist",
        city: " Pune ",
        minPrice: "10,000",
        maxPrice: "50000",
        sort: "price_low",
        page: "2",
      }),
    ).toEqual({
      category: "florist",
      city: "Pune",
      minPrice: 1_000_000,
      maxPrice: 5_000_000,
      sort: "price_low",
      page: 2,
    });
  });
  it("ignores junk and defaults to highest rated, page 1", () => {
    expect(
      parseListingQuery({ category: "x", minPrice: "abc", sort: "random", page: "-3" }),
    ).toEqual({
      category: undefined,
      city: undefined,
      minPrice: undefined,
      maxPrice: undefined,
      sort: "rating",
      page: 1,
    });
  });
});

describe("bookingRequestSchema", () => {
  const L = "507f1f77bcf86cd799439011";
  const E = "507f1f77bcf86cd799439012";
  it("needs a listing and at least one event, and takes one event as a string", () => {
    expect(bookingRequestSchema.safeParse({ listingId: L, eventIds: [E] }).success).toBe(true);
    const one = bookingRequestSchema.safeParse({ listingId: L, eventIds: E });
    expect(one.success && one.data.eventIds).toEqual([E]);
    expect(bookingRequestSchema.safeParse({ listingId: L, eventIds: [] }).success).toBe(false);
    expect(bookingRequestSchema.safeParse({ listingId: L, eventIds: false }).success).toBe(false);
    expect(bookingRequestSchema.safeParse({ listingId: "nope", eventIds: [E] }).success).toBe(
      false,
    );
  });
  it("treats blank optional fields as not set and normalises the phone", () => {
    const r = bookingRequestSchema.safeParse({
      listingId: L,
      eventIds: [E],
      city: "",
      message: " ",
      contactPhone: "98765 43210",
      expectedHeadcount: "",
    });
    expect(r.success && r.data).toMatchObject({
      city: undefined,
      message: undefined,
      contactPhone: "+919876543210",
      expectedHeadcount: undefined,
    });
  });
});

describe("quote schemas", () => {
  it("a quote is a positive amount in rupees, turned into paise", () => {
    const L = "507f1f77bcf86cd799439011";
    const r = quoteSchema.safeParse({ requestId: L, amount: "1,50,000" });
    expect(r.success && r.data.amount).toBe(15_000_000);
    for (const amount of ["0", "-5", "abc", ""])
      expect(quoteSchema.safeParse({ requestId: L, amount }).success).toBe(false);
  });
  it("accepting names the exact amount that was shown", () => {
    const L = "507f1f77bcf86cd799439011";
    expect(acceptQuoteSchema.safeParse({ requestId: L, amount: 100 }).success).toBe(true);
    expect(acceptQuoteSchema.safeParse({ requestId: L, amount: 1.5 }).success).toBe(false);
    expect(acceptQuoteSchema.safeParse({ requestId: L }).success).toBe(false);
  });
});
