import { z } from "zod";

// Zod schemas and types for the search box in the top bar.

export const MIN_QUERY = 2;
export const PER_KIND = 5;

export const searchSchema = z.object({
  q: z
    .string()
    .transform((v) => v.replace(/\s+/g, " ").trim())
    .pipe(z.string().min(MIN_QUERY, "Type at least 2 letters").max(80, "That is too long")),
});

export type SearchKind = "guest" | "event" | "task" | "vendor" | "expense";

export const KIND_LABELS: Record<SearchKind, string> = {
  guest: "Guests",
  event: "Events",
  task: "Tasks",
  vendor: "Vendors",
  expense: "Expenses",
};

// One thing found: what it is called, a line to tell it apart from similar ones, and where it opens.
export type SearchHit = {
  kind: SearchKind;
  id: string;
  title: string;
  subtitle?: string;
  href: string;
};
