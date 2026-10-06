import type { ClientSession } from "mongodb";
import { ObjectId } from "mongodb";
import { istDate } from "@/lib/dates";
import { AppError } from "@/lib/errors";
import { budgetRow, summarize, type BudgetRow, type Summary } from "./calc";
import {
  countForEvent,
  deleteExpense as removeExpense,
  findExpense,
  insertExpense,
  listAllExpenses,
  listBudgets,
  replaceExpenseFields,
  saveBudget,
  searchExpenses,
  unlinkEvent,
  type ExpenseDoc,
  type ExpenseFields,
  type OptionalExpenseField,
} from "./repository";
import {
  CATEGORY_LABELS,
  EXPENSE_CATEGORIES,
  EXPENSE_PAGE_SIZE,
  type ExpenseCategory,
  type ExpenseInput,
  type ExpenseItem,
  type ExpenseQuery,
} from "./schema";

// Business rules for the money module (PRD 5.7, api-design §7). The caller (a Server Action) has
// already checked that the event named on an expense belongs to this wedding.

const NOT_FOUND = new AppError("NOT_FOUND", "That expense no longer exists.");

function toItem(doc: ExpenseDoc): ExpenseItem {
  return {
    id: doc._id.toHexString(),
    title: doc.title,
    amount: doc.amount,
    date: doc.date,
    category: doc.category,
    paidBy: doc.paidBy,
    eventId: doc.eventId?.toHexString(),
    notes: doc.notes,
    splits: doc.splits,
  };
}

function toFields(input: ExpenseInput): { set: ExpenseFields; unset: OptionalExpenseField[] } {
  const date = istDate(input.date);
  if (!date) throw new AppError("VALIDATION_FAILED", "Enter a valid date");
  const set: ExpenseFields = {
    title: input.title,
    amount: input.amount,
    date,
    category: input.category,
    paidBy: input.paidBy,
  };
  const unset: OptionalExpenseField[] = [];
  if (input.eventId) set.eventId = new ObjectId(input.eventId);
  else unset.push("eventId");
  if (input.notes) set.notes = input.notes;
  else unset.push("notes");
  // Splits belong to shared expenses only; switching to one payer drops them.
  if (input.splits) set.splits = input.splits;
  else unset.push("splits");
  return { set, unset };
}

export async function createExpense(weddingId: string, input: ExpenseInput): Promise<ExpenseItem> {
  return toItem(await insertExpense(weddingId, toFields(input).set));
}

export async function updateExpense(
  weddingId: string,
  expenseId: string,
  input: ExpenseInput,
): Promise<ExpenseItem> {
  const { set, unset } = toFields(input);
  const doc = await replaceExpenseFields(weddingId, expenseId, set, unset);
  if (!doc) throw NOT_FOUND;
  return toItem(doc);
}

export async function deleteExpense(weddingId: string, expenseId: string): Promise<void> {
  if (!(await removeExpense(weddingId, expenseId))) throw NOT_FOUND;
}

export async function getExpense(
  weddingId: string,
  expenseId: string,
): Promise<ExpenseItem | null> {
  const doc = await findExpense(weddingId, expenseId);
  return doc ? toItem(doc) : null;
}

export async function listExpenses(
  weddingId: string,
  query: ExpenseQuery,
): Promise<{ items: ExpenseItem[]; total: number; page: number; pageSize: number }> {
  const { docs, total } = await searchExpenses(
    weddingId,
    {
      category: query.category,
      paidBy: query.paidBy,
      eventId: query.eventId === "none" ? null : query.eventId,
    },
    (query.page - 1) * EXPENSE_PAGE_SIZE,
    EXPENSE_PAGE_SIZE,
  );
  return { items: docs.map(toItem), total, page: query.page, pageSize: EXPENSE_PAGE_SIZE };
}

// Totals by category, event and payer, worked out from the expenses every time so they can
// never drift (db-design §6).
export async function getSummary(weddingId: string): Promise<Summary> {
  return summarize((await listAllExpenses(weddingId)).map(toItem));
}

export async function listEveryExpense(weddingId: string): Promise<ExpenseItem[]> {
  return (await listAllExpenses(weddingId)).map(toItem);
}

// ---- budgets ----

export type BudgetOverview = {
  overall: BudgetRow;
  categories: BudgetRow[];
  events: BudgetRow[];
};

// Budget against spending for the whole wedding, each category and each event. Lines with no
// budget still show what was spent. Expenses with no event appear under "No event".
export async function getBudgetOverview(
  weddingId: string,
  overallBudget: number | null,
  events: { id: string; name: string }[],
): Promise<BudgetOverview> {
  const [docs, expenses] = await Promise.all([listBudgets(weddingId), listEveryExpense(weddingId)]);
  const summary = summarize(expenses);
  const byCategory = new Map(
    docs.flatMap((b) =>
      b.scope === "category" && b.category ? [[b.category, b.amount] as const] : [],
    ),
  );
  const byEvent = new Map(
    docs.flatMap((b) =>
      b.scope === "event" && b.eventId ? [[b.eventId.toHexString(), b.amount] as const] : [],
    ),
  );
  return {
    overall: budgetRow("overall", "Whole wedding", overallBudget, summary.total),
    categories: EXPENSE_CATEGORIES.map((c) =>
      budgetRow(c, CATEGORY_LABELS[c], byCategory.get(c) ?? null, summary.byCategory[c] ?? 0),
    ),
    events: events.map((e) =>
      budgetRow(e.id, e.name, byEvent.get(e.id) ?? null, summary.byEvent[e.id] ?? 0),
    ),
  };
}

export function setCategoryBudget(
  weddingId: string,
  category: ExpenseCategory,
  amount: number | null,
): Promise<void> {
  return saveBudget(weddingId, { scope: "category", category }, amount);
}

export function setEventBudget(
  weddingId: string,
  eventId: string,
  amount: number | null,
): Promise<void> {
  return saveBudget(weddingId, { scope: "event", eventId }, amount);
}

// ---- events ----

export function countExpensesForEvent(weddingId: string, eventId: string): Promise<number> {
  return countForEvent(weddingId, eventId);
}

// Called by the events module inside its delete transaction.
export function unlinkEventFromMoney(
  weddingId: string,
  eventId: string,
  options?: { session?: ClientSession },
): Promise<void> {
  return unlinkEvent(weddingId, eventId, options);
}
