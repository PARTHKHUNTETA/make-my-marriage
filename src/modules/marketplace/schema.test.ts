import { describe, expect, it } from "vitest";
import {
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
