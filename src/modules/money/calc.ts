import { PAYERS, type ExpenseCategory, type ExpenseItem, type Payer, type Split } from "./schema";

// The arithmetic of splitting and summing, kept pure so it is easy to test. All amounts are whole
// paise, and every split adds back up to the expense exactly.

export type Shares = Record<Payer, number>;
const none = (): Shares => ({ bride_family: 0, groom_family: 0, couple: 0 });

// Who pays how much of one expense. A shared expense with percentages is divided so the parts add
// up to the total to the paisa: each share is rounded down, then the leftover paise go to the
// payers with the biggest remainders (ties in the order bride, groom, couple).
export function allocate(total: number, splits: Split[]): Shares {
  const result = none();
  if (splits.length === 0) return result;
  if (splits.every((s) => s.amount !== undefined)) {
    for (const s of splits) result[s.payer] += s.amount ?? 0;
    return result;
  }
  const exact = splits.map((s) => ({
    payer: s.payer,
    raw: (total * Math.round((s.percentage ?? 0) * 100)) / 10_000,
  }));
  let left = total;
  for (const e of exact) {
    result[e.payer] += Math.floor(e.raw);
    left -= Math.floor(e.raw);
  }
  const byRemainder = [...exact].sort(
    (a, b) =>
      b.raw - Math.floor(b.raw) - (a.raw - Math.floor(a.raw)) ||
      PAYERS.indexOf(a.payer) - PAYERS.indexOf(b.payer),
  );
  for (let i = 0; left > 0 && i < byRemainder.length; i = (i + 1) % byRemainder.length, left--)
    result[byRemainder[i]!.payer] += 1;
  return result;
}

// What each payer contributed to one expense.
export function contributions(expense: Pick<ExpenseItem, "amount" | "paidBy" | "splits">): Shares {
  if (expense.paidBy === "shared") return allocate(expense.amount, expense.splits ?? []);
  const result = none();
  result[expense.paidBy] = expense.amount;
  return result;
}

export type Summary = {
  total: number;
  byCategory: Partial<Record<ExpenseCategory, number>>;
  // Spending per event id; expenses with no event are under "none".
  byEvent: Record<string, number>;
  byPayer: Shares;
  byPayerByCategory: Partial<Record<ExpenseCategory, Shares>>;
};

export function summarize(expenses: ExpenseItem[]): Summary {
  const summary: Summary = {
    total: 0,
    byCategory: {},
    byEvent: {},
    byPayer: none(),
    byPayerByCategory: {},
  };
  for (const e of expenses) {
    summary.total += e.amount;
    summary.byCategory[e.category] = (summary.byCategory[e.category] ?? 0) + e.amount;
    const eventKey = e.eventId ?? "none";
    summary.byEvent[eventKey] = (summary.byEvent[eventKey] ?? 0) + e.amount;
    const parts = contributions(e);
    const perCategory = (summary.byPayerByCategory[e.category] ??= none());
    for (const payer of PAYERS) {
      summary.byPayer[payer] += parts[payer];
      perCategory[payer] += parts[payer];
    }
  }
  return summary;
}

export type BudgetRow = {
  key: string; // a category or an event id
  label: string;
  budget: number | null; // paise, null when no budget is set
  spent: number;
  remaining: number | null; // negative when over budget
  percentUsed: number | null; // whole percent, can exceed 100
  over: boolean;
};

export function budgetRow(
  key: string,
  label: string,
  budget: number | null,
  spent: number,
): BudgetRow {
  return {
    key,
    label,
    budget,
    spent,
    remaining: budget === null ? null : budget - spent,
    percentUsed: budget === null ? null : Math.round((spent / budget) * 100),
    over: budget !== null && spent > budget,
  };
}
