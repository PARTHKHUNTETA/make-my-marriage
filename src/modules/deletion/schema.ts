import { z } from "zod";

// What someone types to confirm: the wedding's title, so a stray click never deletes anything.
export const deleteWeddingSchema = z.object({
  confirmTitle: z.string().trim().min(1, "Type the wedding's title to confirm"),
});

// Days between "deleted" and "erased for good". Inside the 30 days promised on the Privacy page.
export const PURGE_AFTER_DAYS = 7;

export const sameTitle = (typed: string, title: string) =>
  typed.trim().replace(/\s+/g, " ").toLowerCase() ===
  title.trim().replace(/\s+/g, " ").toLowerCase();
