import { z } from "zod";
import { istDate } from "@/lib/dates";
import { MAX_PAISE, parseRupees } from "@/lib/money";

// Zod schemas and types for the money module (PRD 5.7, api-design §7). Amounts are whole paise.

export const EXPENSE_CATEGORIES = [
  "venue",
  "catering",
  "decoration",
  "photography",
  "clothing",
  "jewellery",
  "entertainment",
  "travel",
  "gifts",
  "invitations",
  "miscellaneous",
] as const;
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];
export const CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  venue: "Venue",
  catering: "Catering",
  decoration: "Decoration",
  photography: "Photography",
  clothing: "Clothing",
  jewellery: "Jewellery",
  entertainment: "Entertainment",
  travel: "Travel",
  gifts: "Gifts",
  invitations: "Invitations",
  miscellaneous: "Miscellaneous",
};

export const PAYERS = ["bride_family", "groom_family", "couple"] as const;
export type Payer = (typeof PAYERS)[number];
export const PAID_BY = [...PAYERS, "shared"] as const;
export type PaidBy = (typeof PAID_BY)[number];
export const PAYER_LABELS: Record<PaidBy, string> = {
  bride_family: "Bride's family",
  groom_family: "Groom's family",
  couple: "Couple",
  shared: "Shared",
};

// One payer's share of a shared expense: a percentage or a fixed amount, never both.
export type Split = { payer: Payer; percentage?: number; amount?: number };
export type SplitMode = "percentage" | "amount";

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, "Not a valid id");
const blank = (value: unknown) =>
  typeof value === "string" && value.trim() === "" ? undefined : value;

// Hundredths of a percent, so 33.33 + 33.33 + 33.34 is checked exactly, not as floats.
const hundredths = (value: number) => Math.round(value * 100);

// What a person types for one payer's share: "50" (percent) or "25,000" (rupees); blank is zero.
const share = z.string().max(20).optional().default("");

export const expenseInputSchema = z
  .object({
    title: z.string().trim().min(1, "Enter a title").max(200, "That is too long"),
    // Rupees as typed, e.g. "1,50,000" or "499.50".
    amount: z.string().transform((value, ctx) => {
      const paise = parseRupees(value);
      if (paise === null) {
        ctx.addIssue({
          code: "custom",
          message: "Enter an amount in rupees, like 50000 or 499.50",
        });
        return z.NEVER;
      }
      return paise;
    }),
    date: z.string().refine((value) => istDate(value) !== null, "Enter a valid date"),
    category: z.enum(EXPENSE_CATEGORIES),
    paidBy: z.enum(PAID_BY),
    eventId: z.preprocess(blank, objectId.optional()),
    notes: z
      .string()
      .trim()
      .max(1000, "That is too long")
      .optional()
      .transform((value) => value || undefined),
    // Only used when paidBy is "shared".
    splitMode: z.enum(["percentage", "amount"]).default("percentage"),
    shareBride: share,
    shareGroom: share,
    shareCouple: share,
  })
  .transform((input, ctx) => {
    const { shareBride, shareGroom, shareCouple, splitMode, ...rest } = input;
    if (input.paidBy !== "shared") return { ...rest, splits: undefined };

    const raw: Record<Payer, string> = {
      bride_family: shareBride,
      groom_family: shareGroom,
      couple: shareCouple,
    };
    const splits: Split[] = [];
    for (const payer of PAYERS) {
      const text = raw[payer].trim();
      if (!text) continue;
      const field =
        payer === "bride_family"
          ? "shareBride"
          : payer === "groom_family"
            ? "shareGroom"
            : "shareCouple";
      if (splitMode === "percentage") {
        const value = Number(text.replace(/%/g, ""));
        if (
          !Number.isFinite(value) ||
          value < 0 ||
          value > 100 ||
          hundredths(value) / 100 !== value
        ) {
          ctx.addIssue({
            code: "custom",
            path: [field],
            message: "Enter a percentage from 0 to 100",
          });
          return z.NEVER;
        }
        if (value > 0) splits.push({ payer, percentage: value });
      } else {
        const paise = text === "0" ? 0 : parseRupees(text);
        if (paise === null) {
          ctx.addIssue({ code: "custom", path: [field], message: "Enter an amount in rupees" });
          return z.NEVER;
        }
        if (paise > 0) splits.push({ payer, amount: paise });
      }
    }
    if (splits.length === 0) {
      ctx.addIssue({
        code: "custom",
        path: ["shareBride"],
        message: "Share the cost between at least one payer",
      });
      return z.NEVER;
    }
    if (splitMode === "percentage") {
      const total = splits.reduce((sum, s) => sum + hundredths(s.percentage ?? 0), 0);
      if (total !== 10_000) {
        ctx.addIssue({
          code: "custom",
          path: ["shareBride"],
          message: `The shares add up to ${total / 100}%. They must add up to 100%.`,
        });
        return z.NEVER;
      }
    } else {
      const total = splits.reduce((sum, s) => sum + (s.amount ?? 0), 0);
      if (total !== input.amount) {
        ctx.addIssue({
          code: "custom",
          path: ["shareBride"],
          message: "The shares must add up to the full amount of the expense.",
        });
        return z.NEVER;
      }
    }
    return { ...rest, splits };
  });

export type ExpenseInput = z.output<typeof expenseInputSchema>;
export type ExpenseFormValues = z.input<typeof expenseInputSchema>;

export const expenseIdSchema = z.object({ expenseId: objectId });

// ---- budgets ----

// An amount in rupees for a budget line; blank means "no budget" for that line.
export const budgetAmountSchema = z.preprocess(
  blank,
  z
    .string()
    .transform((value, ctx) => {
      const paise = parseRupees(value);
      if (paise === null || paise > MAX_PAISE) {
        ctx.addIssue({ code: "custom", message: "Enter an amount in rupees, like 500000" });
        return z.NEVER;
      }
      return paise;
    })
    .optional(),
);

export const overallBudgetSchema = z.object({ amount: budgetAmountSchema });
export const categoryBudgetSchema = z.object({
  category: z.enum(EXPENSE_CATEGORIES),
  amount: budgetAmountSchema,
});
export const eventBudgetSchema = z.object({ eventId: objectId, amount: budgetAmountSchema });

// ---- default splits (per category) ----

// A default for new shared expenses in a category, as percentages that add up to 100.
export type SplitDefault = Record<Payer, number>;

export const splitDefaultSchema = z
  .object({
    category: z.enum(EXPENSE_CATEGORIES),
    shareBride: share,
    shareGroom: share,
    shareCouple: share,
    // Blank everywhere clears the default.
  })
  .transform((input, ctx) => {
    const shares: SplitDefault = { bride_family: 0, groom_family: 0, couple: 0 };
    const fields = {
      bride_family: "shareBride",
      groom_family: "shareGroom",
      couple: "shareCouple",
    } as const;
    for (const payer of PAYERS) {
      const text = input[fields[payer]].trim().replace(/%/g, "");
      if (!text) continue;
      const value = Number(text);
      if (
        !Number.isFinite(value) ||
        value < 0 ||
        value > 100 ||
        hundredths(value) / 100 !== value
      ) {
        ctx.addIssue({
          code: "custom",
          path: [fields[payer]],
          message: "Enter a percentage from 0 to 100",
        });
        return z.NEVER;
      }
      shares[payer] = value;
    }
    const total = PAYERS.reduce((sum, p) => sum + hundredths(shares[p]), 0);
    if (total === 0) return { category: input.category, shares: null };
    if (total !== 10_000) {
      ctx.addIssue({
        code: "custom",
        path: [fields.bride_family],
        message: `The shares add up to ${total / 100}%. They must add up to 100%.`,
      });
      return z.NEVER;
    }
    return { category: input.category, shares };
  });
export type SplitDefaultInput = z.output<typeof splitDefaultSchema>;

// ---- listing ----

export const EXPENSE_PAGE_SIZE = 50;

export type ExpenseQuery = {
  category?: ExpenseCategory;
  eventId?: string; // an event id, or "none"
  paidBy?: PaidBy;
  page: number;
};

export function parseExpenseQuery(
  raw: Record<string, string | string[] | undefined>,
): ExpenseQuery {
  const one = (key: string) => (typeof raw[key] === "string" ? (raw[key] as string) : undefined);
  const page = Number(one("page"));
  const eventId = one("eventId");
  return {
    category: EXPENSE_CATEGORIES.find((c) => c === one("category")),
    eventId: eventId === "none" || objectId.safeParse(eventId).success ? eventId : undefined,
    paidBy: PAID_BY.find((p) => p === one("paidBy")),
    page: Number.isInteger(page) && page >= 1 && page <= 10_000 ? page : 1,
  };
}

export type ExpenseItem = {
  id: string;
  title: string;
  amount: number; // paise
  date: Date;
  category: ExpenseCategory;
  paidBy: PaidBy;
  eventId?: string;
  notes?: string;
  splits?: Split[];
};
