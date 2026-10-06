import "server-only";
import {
  MongoServerError,
  ObjectId,
  type ClientSession,
  type Collection,
  type Filter,
} from "mongodb";
import { getDb } from "@/lib/db";
import { scoped } from "@/lib/scoped";
import type { ExpenseCategory, PaidBy, Split } from "./schema";

// All MongoDB access for the money module, always through scoped(). Amounts are whole paise.
export type ExpenseDoc = {
  _id: ObjectId;
  weddingId: ObjectId;
  title: string;
  amount: number;
  date: Date;
  category: ExpenseCategory;
  paidBy: PaidBy;
  eventId?: ObjectId;
  vendorId?: ObjectId; // set from the vendors module (a later release)
  installmentId?: ObjectId;
  notes?: string;
  splits?: Split[];
  createdAt: Date;
  updatedAt: Date;
};

export type ExpenseFields = Pick<ExpenseDoc, "title" | "amount" | "date" | "category" | "paidBy"> &
  Partial<Pick<ExpenseDoc, "eventId" | "notes" | "splits">>;
export type OptionalExpenseField = "eventId" | "notes" | "splits";

export type BudgetDoc = {
  _id: ObjectId;
  weddingId: ObjectId;
  scope: "category" | "event";
  category?: ExpenseCategory;
  eventId?: ObjectId;
  amount: number;
  createdAt: Date;
  updatedAt: Date;
};

let expensesReady: Promise<Collection<ExpenseDoc>> | undefined;
let budgetsReady: Promise<Collection<BudgetDoc>> | undefined;

function expenses(): Promise<Collection<ExpenseDoc>> {
  expensesReady ??= (async () => {
    const col = (await getDb()).collection<ExpenseDoc>("expenses");
    await col.createIndex({ weddingId: 1, date: -1 });
    await col.createIndex({ weddingId: 1, category: 1 });
    await col.createIndex({ weddingId: 1, eventId: 1 });
    return col;
  })();
  expensesReady.catch(() => {
    expensesReady = undefined;
  });
  return expensesReady;
}

function budgets(): Promise<Collection<BudgetDoc>> {
  budgetsReady ??= (async () => {
    const col = (await getDb()).collection<BudgetDoc>("budgets");
    // One line per category and one per event, so two people saving at once cannot make two.
    await col.createIndex({ weddingId: 1, scope: 1, category: 1, eventId: 1 }, { unique: true });
    return col;
  })();
  budgetsReady.catch(() => {
    budgetsReady = undefined;
  });
  return budgetsReady;
}

const oid = (id: string) => (ObjectId.isValid(id) ? new ObjectId(id) : null);

export async function insertExpense(weddingId: string, fields: ExpenseFields): Promise<ExpenseDoc> {
  const now = new Date();
  const doc = { _id: new ObjectId(), ...fields, createdAt: now, updatedAt: now };
  await scoped(await expenses(), { weddingId }).insertOne(doc);
  return { ...doc, weddingId: new ObjectId(weddingId) };
}

export async function findExpense(weddingId: string, id: string): Promise<ExpenseDoc | null> {
  const _id = oid(id);
  return _id ? scoped(await expenses(), { weddingId }).findOne({ _id }) : null;
}

export async function replaceExpenseFields(
  weddingId: string,
  id: string,
  set: Partial<ExpenseFields>,
  unset: OptionalExpenseField[],
): Promise<ExpenseDoc | null> {
  const _id = oid(id);
  if (!_id) return null;
  return scoped(await expenses(), { weddingId }).findOneAndUpdate(
    { _id },
    {
      $set: { ...set, updatedAt: new Date() },
      ...(unset.length > 0 ? { $unset: Object.fromEntries(unset.map((f) => [f, ""])) } : {}),
    },
    { returnDocument: "after" },
  );
}

export async function deleteExpense(weddingId: string, id: string): Promise<boolean> {
  const _id = oid(id);
  if (!_id) return false;
  return (await scoped(await expenses(), { weddingId }).deleteOne({ _id })).deletedCount === 1;
}

export type ExpenseFilter = {
  category?: ExpenseCategory;
  eventId?: string | null; // null: no event
  paidBy?: PaidBy;
};

function filterOf(filter: ExpenseFilter): Filter<ExpenseDoc> | null {
  const query: Filter<ExpenseDoc> = {};
  if (filter.category) query.category = filter.category;
  if (filter.paidBy) query.paidBy = filter.paidBy;
  if (filter.eventId === null) query.eventId = { $exists: false };
  else if (filter.eventId) {
    const id = oid(filter.eventId);
    if (!id) return null;
    query.eventId = id;
  }
  return query;
}

export async function searchExpenses(
  weddingId: string,
  filter: ExpenseFilter,
  skip: number,
  limit: number,
): Promise<{ docs: ExpenseDoc[]; total: number }> {
  const query = filterOf(filter);
  if (!query) return { docs: [], total: 0 };
  const col = scoped(await expenses(), { weddingId });
  const [docs, total] = await Promise.all([
    col.find(query).sort({ date: -1, _id: -1 }).skip(skip).limit(limit).toArray(),
    col.countDocuments(query),
  ]);
  return { docs, total };
}

// Every expense, for totals and summaries (a wedding has hundreds, not millions).
export async function listAllExpenses(weddingId: string): Promise<ExpenseDoc[]> {
  return scoped(await expenses(), { weddingId })
    .find({})
    .toArray();
}

export async function countForEvent(weddingId: string, eventId: string): Promise<number> {
  const id = oid(eventId);
  return id ? scoped(await expenses(), { weddingId }).countDocuments({ eventId: id }) : 0;
}

// Deleting an event keeps its expenses and their amounts, and removes only the link; its budget
// line goes with it (PRD 5.7).
export async function unlinkEvent(
  weddingId: string,
  eventId: string,
  options?: { session?: ClientSession },
): Promise<void> {
  const id = oid(eventId);
  if (!id) return;
  await scoped(await expenses(), { weddingId }).updateMany(
    { eventId: id },
    { $unset: { eventId: "" }, $set: { updatedAt: new Date() } },
    options,
  );
  await scoped(await budgets(), { weddingId }).deleteMany({ scope: "event", eventId: id }, options);
}

export async function listBudgets(weddingId: string): Promise<BudgetDoc[]> {
  return scoped(await budgets(), { weddingId })
    .find({})
    .toArray();
}

// Sets one budget line, or removes it when the amount is null.
export async function saveBudget(
  weddingId: string,
  key: { scope: "category"; category: ExpenseCategory } | { scope: "event"; eventId: string },
  amount: number | null,
): Promise<void> {
  const col = scoped(await budgets(), { weddingId });
  const filter: Filter<BudgetDoc> =
    key.scope === "category"
      ? { scope: "category", category: key.category }
      : { scope: "event", eventId: new ObjectId(key.eventId) };
  if (amount === null) {
    await col.deleteOne(filter);
    return;
  }
  const now = new Date();
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      await col.updateOne(
        filter,
        { $set: { amount, updatedAt: now }, $setOnInsert: { createdAt: now } },
        { upsert: true },
      );
      return;
    } catch (err) {
      // Two saves raced to create the same line; the second simply updates it.
      if (!(err instanceof MongoServerError && err.code === 11000) || attempt === 1) throw err;
    }
  }
}
