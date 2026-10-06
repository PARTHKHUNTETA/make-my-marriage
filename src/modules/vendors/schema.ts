import { z } from "zod";
import { daysUntil, istDate } from "@/lib/dates";
import { MAX_PAISE, parseRupees } from "@/lib/money";
import { normalizePhone } from "@/modules/guests/schema";
import type { ExpenseCategory } from "@/modules/money/schema";

// Zod schemas and types for the vendors module (PRD 5.8 My Vendors, 5.7 payment schedules).

export const VENDOR_CATEGORIES = [
  "photographer",
  "videographer",
  "venue",
  "caterer",
  "decorator",
  "dj",
  "makeup_artist",
  "mehndi_artist",
  "pandit",
  "choreographer",
  "wedding_planner",
  "florist",
  "transport",
  "other",
] as const;
export type VendorCategory = (typeof VENDOR_CATEGORIES)[number];
export const VENDOR_CATEGORY_LABELS: Record<VendorCategory, string> = {
  photographer: "Photographer",
  videographer: "Videographer",
  venue: "Venue",
  caterer: "Caterer",
  decorator: "Decorator",
  dj: "DJ",
  makeup_artist: "Makeup Artist",
  mehndi_artist: "Mehndi Artist",
  pandit: "Pandit / Priest / Officiant",
  choreographer: "Choreographer",
  wedding_planner: "Wedding Planner",
  florist: "Florist",
  transport: "Transport",
  other: "Other",
};

// The expense category a vendor's payments are filed under, so a paid installment lands in the
// right place in the totals. The couple can change it on the expense afterwards.
export const EXPENSE_CATEGORY_FOR: Record<VendorCategory, ExpenseCategory> = {
  photographer: "photography",
  videographer: "photography",
  venue: "venue",
  caterer: "catering",
  decorator: "decoration",
  dj: "entertainment",
  makeup_artist: "miscellaneous",
  mehndi_artist: "miscellaneous",
  pandit: "miscellaneous",
  choreographer: "entertainment",
  wedding_planner: "miscellaneous",
  florist: "decoration",
  transport: "travel",
  other: "miscellaneous",
};

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, "Not a valid id");
const blank = (value: unknown) =>
  typeof value === "string" && value.trim() === "" ? undefined : value;
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, "That is too long")
    .optional()
    .transform((value) => value || undefined);

export const vendorInputSchema = z.object({
  name: z.string().trim().min(1, "Enter the vendor's name").max(150, "That name is too long"),
  category: z.enum(VENDOR_CATEGORIES),
  phone: z.preprocess(
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
  email: z.preprocess(
    blank,
    z
      .string()
      .trim()
      .toLowerCase()
      .max(254, "That email address is too long")
      .pipe(z.email("Enter a valid email address"))
      .optional(),
  ),
  address: optionalText(500),
  // Rupees as typed; blank means no total cost yet.
  totalCost: z.preprocess(
    blank,
    z
      .string()
      .transform((value, ctx) => {
        const paise = parseRupees(value);
        if (paise === null) {
          ctx.addIssue({ code: "custom", message: "Enter an amount in rupees, like 150000" });
          return z.NEVER;
        }
        return paise;
      })
      .optional(),
  ),
  // A form with one event checkbox hands back one string, or false, instead of an array.
  eventIds: z.preprocess(
    (value) =>
      typeof value === "string" ? [value] : value === false || value == null ? [] : value,
    z.array(objectId).max(50),
  ),
  notes: optionalText(1000),
});
export type VendorInput = z.output<typeof vendorInputSchema>;
export type VendorFormValues = z.input<typeof vendorInputSchema>;

export const vendorIdSchema = z.object({ vendorId: objectId });

// ---- payment schedule ----

export const installmentInputSchema = z.object({
  label: z
    .string()
    .trim()
    .min(1, "Enter a label, like Advance or Final")
    .max(100, "That is too long"),
  amount: z.string().transform((value, ctx) => {
    const paise = parseRupees(value);
    if (paise === null || paise > MAX_PAISE) {
      ctx.addIssue({ code: "custom", message: "Enter an amount in rupees, like 50000" });
      return z.NEVER;
    }
    return paise;
  }),
  dueDate: z.string().refine((value) => istDate(value) !== null, "Enter a valid date"),
});
export type InstallmentInput = z.output<typeof installmentInputSchema>;
export type InstallmentFormValues = z.input<typeof installmentInputSchema>;

export const installmentRefSchema = z.object({ vendorId: objectId, installmentId: objectId });
export const updateInstallmentSchema = installmentRefSchema.and(installmentInputSchema);
export const markPaidSchema = installmentRefSchema.and(
  z.object({
    // Who paid it, and when. Defaults to today.
    paidBy: z.enum(["bride_family", "groom_family", "couple"]),
    paidOn: z
      .string()
      .refine((value) => istDate(value) !== null, "Enter a valid date")
      .optional(),
  }),
);

export type InstallmentStatus = "upcoming" | "due" | "overdue" | "paid";
export const INSTALLMENT_LABELS: Record<InstallmentStatus, string> = {
  upcoming: "Upcoming",
  due: "Due soon",
  overdue: "Overdue",
  paid: "Paid",
};
// "Due" starts this many days before the date, the same lead time as the reminder (PRD 5.7).
export const DUE_SOON_DAYS = 3;

// Upcoming, due soon, overdue or paid. Worked out from the date every time, never stored, so it
// is always right on the day.
export function installmentStatus(
  installment: { paidOn?: Date; dueDate: Date },
  now: Date = new Date(),
): InstallmentStatus {
  if (installment.paidOn) return "paid";
  const days = daysUntil(installment.dueDate, now);
  if (days < 0) return "overdue";
  return days <= DUE_SOON_DAYS ? "due" : "upcoming";
}

// ---- listing ----

export type VendorQuery = { category?: VendorCategory; eventId?: string };

export function parseVendorQuery(raw: Record<string, string | string[] | undefined>): VendorQuery {
  const one = (key: string) => (typeof raw[key] === "string" ? (raw[key] as string) : undefined);
  const eventId = one("eventId");
  return {
    category: VENDOR_CATEGORIES.find((c) => c === one("category")),
    eventId: objectId.safeParse(eventId).success ? eventId : undefined,
  };
}

export type InstallmentItem = {
  id: string;
  label: string;
  amount: number;
  dueDate: Date;
  paidOn?: Date;
  status: InstallmentStatus;
};

export type VendorItem = {
  id: string;
  name: string;
  category: VendorCategory;
  phone?: string;
  email?: string;
  address?: string;
  totalCost?: number;
  eventIds: string[];
  notes?: string;
  installments: InstallmentItem[];
};
