import { z } from "zod";
import { istDate } from "@/lib/dates";

// Zod schemas and types for the wedding module, shared by the setup form and the server action.

const required = (what: string, max: number) =>
  z.string().trim().min(1, `Enter ${what}`).max(max, "That is too long");

// Optional free text: blank becomes "not set" instead of an empty string in the database.
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, "That is too long")
    .optional()
    .transform((value) => value || undefined);

export const createWeddingSchema = z.object({
  brideName: required("the bride's name", 100),
  groomName: required("the groom's name", 100),
  title: required("a wedding title", 150),
  // A calendar date as typed in a date field ("2026-02-14"). Any real date is accepted.
  date: z.string().refine((value) => istDate(value) !== null, "Enter a valid date"),
  city: required("the city", 100),
  venue: optionalText(200),
  description: optionalText(1000),
});

// Editing later asks for the same details as setup.
export const updateWeddingSchema = createWeddingSchema;

export type CreateWeddingInput = z.output<typeof createWeddingSchema>;
export type UpdateWeddingInput = CreateWeddingInput;
export type CreateWeddingFormValues = z.input<typeof createWeddingSchema>;

export const suggestTitle = (brideName: string, groomName: string): string => {
  const [bride, groom] = [brideName.trim(), groomName.trim()];
  return bride && groom ? `${bride} weds ${groom}` : "";
};

// Automatic reminders (PRD 5.6): off by default. "rsvpDays" are how many days before an event a
// guest who has not replied is emailed; the day-before event reminder goes to attending guests.
export const DEFAULT_RSVP_REMINDER_DAYS = [14, 3];
export const MAX_REMINDER_DAYS = 5;

export type ReminderSettings = { enabled: boolean; rsvpDays: number[] };

export const reminderSettingsSchema = z.object({
  enabled: z.boolean(),
  rsvpDays: z
    .array(
      z
        .number({ error: "Enter days as whole numbers" })
        .int("Enter days as whole numbers")
        .min(1, "Use 1 day or more")
        .max(60, "Use 60 days or fewer"),
    )
    .min(1, "Enter at least one day")
    .max(MAX_REMINDER_DAYS, `Use at most ${MAX_REMINDER_DAYS} reminder days`)
    // Largest first, no repeats: "14, 3, 14" is the same as "14, 3".
    .transform((days) => [...new Set(days)].sort((a, b) => b - a)),
});

// "14, 3" or "14 3" -> [14, 3]. Anything that is not a number is kept as NaN so validation says so.
export function parseDays(text: string): number[] {
  return text
    .split(/[\s,;]+/)
    .filter(Boolean)
    .map((part) => (/^\d+$/.test(part) ? Number(part) : NaN));
}

// What the app shows about the current wedding. Deliberately omits tokens and settings.
export type WeddingSummary = {
  id: string;
  brideName: string;
  groomName: string;
  title: string;
  date: Date;
  city: string;
  venue?: string;
  description?: string;
  slug: string;
  // The couple's own WhatsApp share text, if they wrote one.
  whatsappMessage?: string;
  reminders: ReminderSettings;
  overallBudget?: number; // paise
  splitDefaults: Record<string, { bride_family: number; groom_family: number; couple: number }>;
};
