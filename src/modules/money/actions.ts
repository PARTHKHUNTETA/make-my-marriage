"use server";

import { revalidatePath } from "next/cache";
import { safeAction } from "@/lib/action";
import { requireMember } from "@/lib/authz";
import { AppError } from "@/lib/errors";
import { eventExists } from "@/modules/events/service";
import { setOverallBudget, setSplitDefault } from "@/modules/wedding/service";
import {
  categoryBudgetSchema,
  eventBudgetSchema,
  expenseIdSchema,
  expenseInputSchema,
  overallBudgetSchema,
  splitDefaultSchema,
  type ExpenseInput,
} from "./schema";
import {
  createExpense,
  deleteExpense,
  setCategoryBudget,
  setEventBudget,
  updateExpense,
} from "./service";

// Server Actions for money. Open to Admins and Managers. The wedding always comes from the
// signed-in member. An expense may only point at an event of the same wedding, checked here
// because this module does not reach into the events module's data.

async function checkEvent(weddingId: string, eventId: string | undefined) {
  if (eventId && !(await eventExists(weddingId, eventId)))
    throw new AppError("VALIDATION_FAILED", "That event no longer exists.", {
      eventId: ["Choose an event from the list"],
    });
}

const refresh = () => revalidatePath("/", "layout");

export async function createExpenseAction(input: unknown) {
  return safeAction(async () => {
    const ctx = await requireMember();
    const parsed: ExpenseInput = expenseInputSchema.parse(input);
    await checkEvent(ctx.weddingId, parsed.eventId);
    const expense = await createExpense(ctx.weddingId, parsed);
    refresh();
    return { id: expense.id };
  });
}

export async function updateExpenseAction(input: unknown) {
  return safeAction(async () => {
    const ctx = await requireMember();
    const { expenseId, ...fields } = (input ?? {}) as { expenseId?: unknown };
    const id = expenseIdSchema.parse({ expenseId }).expenseId;
    const parsed = expenseInputSchema.parse(fields);
    await checkEvent(ctx.weddingId, parsed.eventId);
    await updateExpense(ctx.weddingId, id, parsed);
    refresh();
    return {};
  });
}

export async function deleteExpenseAction(input: unknown) {
  return safeAction(async () => {
    const ctx = await requireMember();
    await deleteExpense(ctx.weddingId, expenseIdSchema.parse(input).expenseId);
    refresh();
    return {};
  });
}

// A blank amount removes that budget.
export async function setOverallBudgetAction(input: unknown) {
  return safeAction(async () => {
    const ctx = await requireMember();
    const { amount } = overallBudgetSchema.parse(input);
    await setOverallBudget(ctx.weddingId, amount ?? null);
    refresh();
    return {};
  });
}

export async function setCategoryBudgetAction(input: unknown) {
  return safeAction(async () => {
    const ctx = await requireMember();
    const { category, amount } = categoryBudgetSchema.parse(input);
    await setCategoryBudget(ctx.weddingId, category, amount ?? null);
    refresh();
    return {};
  });
}

export async function setEventBudgetAction(input: unknown) {
  return safeAction(async () => {
    const ctx = await requireMember();
    const { eventId, amount } = eventBudgetSchema.parse(input);
    await checkEvent(ctx.weddingId, eventId);
    await setEventBudget(ctx.weddingId, eventId, amount ?? null);
    refresh();
    return {};
  });
}

export async function saveSplitDefaultAction(input: unknown) {
  return safeAction(async () => {
    const ctx = await requireMember();
    const { category, shares } = splitDefaultSchema.parse(input);
    await setSplitDefault(ctx.weddingId, category, shares);
    refresh();
    return {};
  });
}
