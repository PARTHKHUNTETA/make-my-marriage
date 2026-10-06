import { z } from "zod";

// Types and filter rules for the Analytics page (PRD 5.16).

export type ChartKind = "groupedBar" | "stackedBar" | "bar" | "line";

// Everything a chart needs, as plain data, so the same numbers draw it, label it and export it.
// Money is in paise; counts are whole numbers.
export type ChartData = {
  id: string;
  title: string;
  description: string;
  kind: ChartKind;
  unit: "rupees" | "count";
  labels: string[];
  series: { name: string; values: number[] }[];
};

const ymd = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use a date like 2027-02-14")
  .refine((v) => !Number.isNaN(new Date(`${v}T00:00:00Z`).getTime()), "Not a real date");

export const analyticsFilterSchema = z
  .object({
    eventId: z
      .string()
      .regex(/^[0-9a-fA-F]{24}$/, "Choose an event from the list")
      .optional(),
    from: ymd.optional(),
    to: ymd.optional(),
  })
  .refine((f) => !f.from || !f.to || f.from <= f.to, {
    message: "The start date must be before the end date",
    path: ["to"],
  });
export type AnalyticsFilter = z.infer<typeof analyticsFilterSchema>;
