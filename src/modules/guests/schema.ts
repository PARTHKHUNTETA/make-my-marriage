import { z } from "zod";

// Zod schemas and types for the guests module (PRD 5.5, 5.6), shared by forms and Server Actions.
// One guest is one invited party ("Rajesh Sharma, up to 4 guests"), not one person.

export const MAX_PARTY = 100;

export const RSVP_STATUSES = ["pending", "attending", "not_attending"] as const;
export type RsvpStatus = (typeof RSVP_STATUSES)[number];
export const RSVP_LABELS: Record<RsvpStatus, string> = {
  pending: "No reply yet",
  attending: "Attending",
  not_attending: "Not attending",
};

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, "Not a valid id");
const blankToUndefined = (value: unknown) =>
  typeof value === "string" && value.trim() === "" ? undefined : value;

// "98765 43210", "+91 98765-43210", "09876543210" -> "+919876543210". Ten digits default to +91
// (PRD 5.5); anything starting with + is kept as typed, digits only. Null when it is not a
// plausible number (E.164 allows 8 to 15 digits).
export function normalizePhone(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const international = trimmed.startsWith("+") || trimmed.startsWith("00");
  let digits = trimmed.replace(/\D/g, "");
  if (trimmed.startsWith("00")) digits = digits.slice(2);
  if (!international) {
    if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1);
    if (digits.length === 12 && digits.startsWith("91")) return `+${digits}`;
    if (digits.length !== 10) return null;
    return `+91${digits}`;
  }
  return digits.length >= 8 && digits.length <= 15 ? `+${digits}` : null;
}

const phone = z.preprocess(
  blankToUndefined,
  z
    .string()
    .transform((value, ctx) => {
      const normalized = normalizePhone(value);
      if (!normalized) {
        ctx.addIssue({ code: "custom", message: "Enter a valid phone number" });
        return z.NEVER;
      }
      return normalized;
    })
    .optional(),
);

const guestsAllowed = z.preprocess(
  (value) => (typeof value === "string" && value.trim() !== "" ? Number(value) : value),
  z
    .number({ error: "Enter how many people" })
    .int("Enter a whole number")
    .min(1, "At least 1")
    .max(MAX_PARTY, `At most ${MAX_PARTY}`),
);

export const guestInputSchema = z.object({
  name: z.string().trim().min(1, "Enter the guest's name").max(150, "That name is too long"),
  phone,
  email: z.preprocess(
    blankToUndefined,
    z
      .string()
      .trim()
      .toLowerCase()
      .max(254, "That email address is too long")
      .pipe(z.email("Enter a valid email address"))
      .optional(),
  ),
  guestsAllowed,
  // A form with a single event checkbox hands back one string, or false, instead of an array.
  invitedEventIds: z.preprocess(
    (value) => (typeof value === "string" ? [value] : value === false ? [] : value),
    z.array(objectId).min(1, "Choose at least one event").max(50, "That is too many events"),
  ),
  notes: z
    .string()
    .trim()
    .max(1000, "That is too long")
    .optional()
    .transform((value) => value || undefined),
});

export type GuestInput = z.output<typeof guestInputSchema>;
export type GuestFormValues = z.input<typeof guestInputSchema>;

export const guestIdSchema = z.object({ guestId: objectId });
export const phoneCheckSchema = z.object({
  phone: z.string().max(40),
  excludeGuestId: objectId.optional(),
});

// A response for one event. "attending" needs a headcount; the other two carry none.
export const rsvpSchema = z
  .object({
    eventId: objectId,
    status: z.enum(RSVP_STATUSES),
    numberAttending: z.preprocess(
      (value) => (value === "" || value === null ? undefined : value),
      z.coerce.number().int("Enter a whole number").optional(),
    ),
  })
  .superRefine((value, ctx) => {
    if (value.status === "attending" && (value.numberAttending ?? 0) < 1)
      ctx.addIssue({
        code: "custom",
        path: ["numberAttending"],
        message: "Tell us how many will come",
      });
  });
export type RsvpInput = z.output<typeof rsvpSchema>;
export const memberRsvpSchema = z.object({ guestId: objectId }).and(rsvpSchema);

// ---- listing ----

export const GUEST_PAGE_SIZE = 50;

export type GuestQuery = {
  search?: string;
  eventId?: string;
  status?: RsvpStatus;
  page: number;
};

export function parseGuestQuery(raw: Record<string, string | string[] | undefined>): GuestQuery {
  const one = (key: string) => (typeof raw[key] === "string" ? (raw[key] as string) : undefined);
  const page = Number(one("page"));
  return {
    search: one("search")?.trim().slice(0, 100) || undefined,
    eventId: objectId.safeParse(one("eventId")).success ? one("eventId") : undefined,
    status: RSVP_STATUSES.find((s) => s === one("status")),
    page: Number.isInteger(page) && page >= 1 && page <= 10_000 ? page : 1,
  };
}

// ---- views ----

export type InvitationItem = {
  eventId: string;
  rsvpStatus: RsvpStatus;
  numberAttending?: number;
  respondedAt?: Date;
};

export type GuestItem = {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  guestsAllowed: number;
  notes?: string;
  token: string;
  invitations: InvitationItem[];
  remindersUnsubscribed: boolean;
  inviteEmailedAt?: Date;
  whatsappSharedAt?: Date;
};

export type EventStats = {
  eventId: string;
  invited: number; // parties invited
  attending: number;
  notAttending: number;
  pending: number;
  headcount: number; // people expected
};

export type GuestStats = {
  parties: number;
  responded: number; // parties that answered for at least one event
  pending: number; // parties that have answered for none
  headcount: number; // people expected at one event or more
  perEvent: EventStats[];
};
