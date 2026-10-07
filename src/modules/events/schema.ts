import { z } from "zod";
import { istDate } from "@/lib/dates";

// Zod schemas and types for the events module (PRD 5.3), shared by the forms and the actions.

export const EVENT_TYPES = [
  "engagement",
  "roka",
  "mehndi",
  "haldi",
  "sangeet",
  "cocktail",
  "wedding",
  "reception",
  "custom",
] as const;
export type EventType = (typeof EVENT_TYPES)[number];

export const EVENT_TYPE_LABELS: Record<EventType, string> = {
  engagement: "Engagement",
  roka: "Roka",
  mehndi: "Mehndi",
  haldi: "Haldi",
  sangeet: "Sangeet",
  cocktail: "Cocktail",
  wedding: "Wedding",
  reception: "Reception",
  custom: "Custom",
};

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, "That is too long")
    .optional()
    .transform((value) => value || undefined);

// 24-hour "HH:MM", as a time field gives it.
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Enter a time");

export const eventInputSchema = z.object({
  type: z.enum(EVENT_TYPES),
  name: z.string().trim().min(1, "Enter a name for the event").max(150, "That is too long"),
  date: z.string().refine((value) => istDate(value) !== null, "Enter a valid date"),
  startTime: time,
  // May fall after midnight, so it is not compared with the start time.
  endTime: z.preprocess((v) => (v === "" ? undefined : v), time.optional()),
  venueName: optionalText(200),
  address: optionalText(500),
  description: optionalText(2000),
  dressCode: optionalText(200),
  showOnWebsite: z.boolean().default(true),
});

export type EventInput = z.output<typeof eventInputSchema>;
export type EventFormValues = z.input<typeof eventInputSchema>;

export const eventIdSchema = z.object({ eventId: z.string().regex(/^[0-9a-fA-F]{24}$/) });

export type EventItem = {
  id: string;
  type: EventType;
  name: string;
  date: Date;
  startTime: string;
  endTime?: string;
  venueName?: string;
  address?: string;
  description?: string;
  dressCode?: string;
  coverImageKey?: string;
  showOnWebsite: boolean;
  showTable: boolean;
};

// What deleting an event would remove or unlink, shown before the person confirms (PRD 5.3).
export type EventDeletePreview = {
  taskCount: number;
  guestCount: number;
  expenseCount: number;
  vendorCount: number;
  tableCount: number;
  arrivalCount: number;
};

// "16:00" -> "4:00 PM" (kept here too, for the code that already imports it from this file)
export { formatTime } from "@/lib/time";

// The moment the event starts: its date (midnight in India) plus the start time. Guests can
// change their reply until then (PRD 5.6).
export function eventStartsAt(event: Pick<EventItem, "date" | "startTime">): Date {
  const [h = "0", m = "0"] = event.startTime.split(":");
  return new Date(event.date.getTime() + (Number(h) * 60 + Number(m)) * 60_000);
}
