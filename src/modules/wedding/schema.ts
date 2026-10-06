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
};
