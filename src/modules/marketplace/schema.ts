import { z } from "zod";
import { MAX_PAISE, parseRupees } from "@/lib/money";
import { normalizePhone } from "@/modules/guests/schema";
import { PASSWORD_MAX, PASSWORD_MIN } from "@/modules/members/schema";
import { VENDOR_CATEGORIES } from "@/modules/vendors/schema";

// Zod schemas and types for the marketplace module: vendor accounts and their portal, listings,
// booking requests and reviews (PRD 5.8, db-design §7, api-design §8, §13).

const email = z
  .string()
  .trim()
  .toLowerCase()
  .max(254, "That email address is too long")
  .pipe(z.email("Enter a valid email address"));

// ---- vendor accounts (a login space apart from wedding members) ----

export const vendorSignupSchema = z.object({
  businessName: z
    .string()
    .trim()
    .min(1, "Enter your business name")
    .max(150, "That name is too long"),
  email,
  phone: z.string().transform((value, ctx) => {
    const phone = normalizePhone(value);
    if (!phone) {
      ctx.addIssue({ code: "custom", message: "Enter a valid phone number" });
      return z.NEVER;
    }
    return phone;
  }),
  password: z
    .string()
    .min(PASSWORD_MIN, `Use at least ${PASSWORD_MIN} characters`)
    .max(PASSWORD_MAX, `Use at most ${PASSWORD_MAX} characters`),
});
export const vendorLoginSchema = z.object({
  email,
  password: z.string().min(1, "Enter your password").max(PASSWORD_MAX, "That password is too long"),
  remember: z.boolean().default(false),
});
export const vendorResetRequestSchema = z.object({ email });
const token = z
  .string()
  .trim()
  .min(10, "This link is not valid")
  .max(128, "This link is not valid");
export const vendorVerifySchema = z.object({ token });
export const vendorResetSchema = z.object({
  token,
  password: vendorSignupSchema.shape.password,
});

export type VendorSignupInput = z.output<typeof vendorSignupSchema>;
export type VendorSignupFormValues = z.input<typeof vendorSignupSchema>;
export type VendorLoginInput = z.output<typeof vendorLoginSchema>;
export type VendorLoginFormValues = z.input<typeof vendorLoginSchema>;

export type VendorProfile = {
  id: string;
  businessName: string;
  email: string;
  phone: string;
  emailVerified: boolean;
};

// ---- listings ----

export const LISTING_STATUSES = ["pending", "approved", "rejected", "suspended", "paused"] as const;
export type ListingStatus = (typeof LISTING_STATUSES)[number];
export const LISTING_STATUS_LABELS: Record<ListingStatus, string> = {
  pending: "Waiting for approval",
  approved: "Live",
  rejected: "Not approved",
  suspended: "Suspended",
  paused: "Paused",
};

const blank = (value: unknown) =>
  typeof value === "string" && value.trim() === "" ? undefined : value;

// A website or Instagram link. Only http and https are accepted, so a listing can never carry a
// javascript: or data: link into a member's browser. A bare Instagram handle becomes a link.
function webLink(kind: "website" | "instagram") {
  return z.preprocess(
    blank,
    z
      .string()
      .trim()
      .max(300, "That link is too long")
      .transform((value, ctx) => {
        let text = value;
        if (kind === "instagram" && /^@?[A-Za-z0-9._]{1,30}$/.test(text))
          text = `https://instagram.com/${text.replace(/^@/, "")}`;
        else if (!/^[a-z][a-z0-9+.-]*:/i.test(text)) text = `https://${text}`;
        try {
          const url = new URL(text);
          if (
            (url.protocol !== "https:" && url.protocol !== "http:") ||
            !url.hostname.includes(".")
          )
            throw new Error();
          return url.toString();
        } catch {
          ctx.addIssue({ code: "custom", message: "Enter a valid link" });
          return z.NEVER;
        }
      })
      .optional(),
  );
}

export const MAX_CITIES = 10;

export const listingInputSchema = z.object({
  category: z.enum(VENDOR_CATEGORIES),
  // "Jaipur, Udaipur" as typed.
  cities: z.string().transform((value, ctx) => {
    const cities = [
      ...new Set(
        value
          .split(/[,;\n]/)
          .map((c) => c.trim().replace(/\s+/g, " "))
          .filter(Boolean),
      ),
    ];
    if (cities.length === 0) {
      ctx.addIssue({ code: "custom", message: "Enter at least one city you serve" });
      return z.NEVER;
    }
    if (cities.length > MAX_CITIES || cities.some((c) => c.length > 60)) {
      ctx.addIssue({
        code: "custom",
        message: `Enter up to ${MAX_CITIES} cities, each a short name`,
      });
      return z.NEVER;
    }
    return cities;
  }),
  description: z.string().trim().min(1, "Describe your work").max(2000, "That is too long"),
  startingPrice: z.preprocess(
    blank,
    z
      .string()
      .transform((value, ctx) => {
        const paise = parseRupees(value);
        if (paise === null || paise > MAX_PAISE) {
          ctx.addIssue({ code: "custom", message: "Enter a price in rupees, like 50000" });
          return z.NEVER;
        }
        return paise;
      })
      .optional(),
  ),
  website: webLink("website"),
  instagram: webLink("instagram"),
});
export type ListingInput = z.output<typeof listingInputSchema>;
export type ListingFormValues = z.input<typeof listingInputSchema>;

export const pauseSchema = z.object({ paused: z.boolean() });

export const staffDecisionSchema = z.object({
  listingId: z.string().regex(/^[0-9a-fA-F]{24}$/),
  decision: z.enum(["approve", "reject", "suspend"]),
  note: z
    .string()
    .trim()
    .max(500, "That is too long")
    .optional()
    .transform((value) => value || undefined),
});

export type ListingView = {
  id: string;
  businessName: string;
  category: (typeof VENDOR_CATEGORIES)[number];
  cities: string[];
  description: string;
  startingPrice?: number;
  website?: string;
  instagram?: string;
  status: ListingStatus;
  reviewNote?: string;
  ratingAvg?: number;
  ratingCount: number;
  updatedAt: Date;
};

// ---- browsing the marketplace (members) ----

export const SORTS = ["rating", "price_low", "price_high"] as const;
export type Sort = (typeof SORTS)[number];
export const SORT_LABELS: Record<Sort, string> = {
  rating: "Highest rated",
  price_low: "Price: low to high",
  price_high: "Price: high to low",
};
export const LISTING_PAGE_SIZE = 12;

export type ListingQuery = {
  category?: (typeof VENDOR_CATEGORIES)[number];
  city?: string;
  minPrice?: number; // paise
  maxPrice?: number; // paise
  sort: Sort;
  page: number;
};

export function parseListingQuery(
  raw: Record<string, string | string[] | undefined>,
): ListingQuery {
  const one = (key: string) => (typeof raw[key] === "string" ? (raw[key] as string) : undefined);
  const page = Number(one("page"));
  const price = (key: string) => {
    const value = one(key);
    return value ? (parseRupees(value) ?? undefined) : undefined;
  };
  return {
    category: VENDOR_CATEGORIES.find((c) => c === one("category")),
    city: one("city")?.trim().slice(0, 60) || undefined,
    minPrice: price("minPrice"),
    maxPrice: price("maxPrice"),
    sort: SORTS.find((s) => s === one("sort")) ?? "rating",
    page: Number.isInteger(page) && page >= 1 && page <= 10_000 ? page : 1,
  };
}

// ---- booking requests ----

export const BOOKING_STATUSES = ["sent", "quoted", "accepted", "declined", "cancelled"] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];
export const BOOKING_STATUS_LABELS: Record<BookingStatus, string> = {
  sent: "Sent",
  quoted: "Quoted",
  accepted: "Accepted",
  declined: "Declined",
  cancelled: "Cancelled",
};

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, "Not a valid id");

export const bookingRequestSchema = z.object({
  listingId: objectId,
  eventIds: z.preprocess(
    (value) =>
      typeof value === "string" ? [value] : value === false || value == null ? [] : value,
    z.array(objectId).min(1, "Choose at least one event").max(20),
  ),
  city: z.preprocess(blank, z.string().trim().max(60, "That is too long").optional()),
  expectedHeadcount: z.preprocess(
    blank,
    z.coerce
      .number()
      .int("Enter a whole number")
      .min(1, "At least 1")
      .max(100_000, "That is too many")
      .optional(),
  ),
  message: z.preprocess(blank, z.string().trim().max(1000, "That is too long").optional()),
  // Shared with the vendor only if the couple chooses to, so they can be reached.
  contactName: z.preprocess(blank, z.string().trim().max(100, "That is too long").optional()),
  contactPhone: z.preprocess(
    blank,
    z
      .string()
      .transform((value, ctx) => {
        const phone = normalizePhone(value);
        if (!phone) {
          ctx.addIssue({ code: "custom", message: "Enter a valid phone number" });
          return z.NEVER;
        }
        return phone;
      })
      .optional(),
  ),
});
export type BookingRequestInput = z.output<typeof bookingRequestSchema>;
export type BookingRequestFormValues = z.input<typeof bookingRequestSchema>;

export const requestIdSchema = z.object({ requestId: objectId });
export const quoteSchema = z.object({
  requestId: objectId,
  amount: z.string().transform((value, ctx) => {
    const paise = parseRupees(value);
    if (paise === null || paise > MAX_PAISE) {
      ctx.addIssue({ code: "custom", message: "Enter a price in rupees, like 150000" });
      return z.NEVER;
    }
    return paise;
  }),
});
// The amount the couple saw is sent back, so a quote that changed in the meantime is not accepted
// by mistake.
export const acceptQuoteSchema = z.object({
  requestId: objectId,
  amount: z.number().int().positive(),
});

export type EventSnapshot = { name: string; date: Date };

// What a couple sees about one of their requests.
export type BookingView = {
  id: string;
  listingId: string;
  businessName: string;
  events: EventSnapshot[];
  city?: string;
  expectedHeadcount?: number;
  message?: string;
  quotedAmount?: number;
  status: BookingStatus;
  createdAt: Date;
};

// What a vendor sees: only what the couple chose to send. No wedding id, no names, nothing else.
export type VendorBookingView = {
  id: string;
  events: EventSnapshot[];
  city?: string;
  expectedHeadcount?: number;
  message?: string;
  contactName?: string;
  contactPhone?: string;
  quotedAmount?: number;
  status: BookingStatus;
  createdAt: Date;
};
