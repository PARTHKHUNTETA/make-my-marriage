"use server";

import { revalidatePath } from "next/cache";
import { safeAction } from "@/lib/action";
import { requirePermission } from "@/lib/authz";
import { AppError } from "@/lib/errors";
import { consumeRateLimit, subjectKey } from "@/lib/ratelimit";
import { eventExists } from "@/modules/events/service";
import { vendorExists } from "@/modules/vendors/service";
import { setOverallBudget, setSplitDefault } from "@/modules/wedding/service";
import { checkBudgetAlerts } from "./alerts";
import {
  categoryBudgetSchema,
  eventBudgetSchema,
  expenseIdSchema,
  expenseInputSchema,
  overallBudgetSchema,
  receiptConfirmSchema,
  receiptRequestSchema,
  splitDefaultSchema,
  type ExpenseInput,
} from "./schema";
import {
  confirmReceipt,
  createExpense,
  deleteExpense,
  removeReceipt,
  requestReceiptUpload,
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

async function checkVendor(weddingId: string, vendorId: string | undefined) {
  if (vendorId && !(await vendorExists(weddingId, vendorId)))
    throw new AppError("VALIDATION_FAILED", "That vendor no longer exists.", {
      vendorId: ["Choose a vendor from the list"],
    });
}

const refresh = () => revalidatePath("/", "layout");

export async function createExpenseAction(input: unknown) {
  return safeAction(async () => {
    const ctx = await requirePermission("expense.edit");
    const parsed: ExpenseInput = expenseInputSchema.parse(input);
    await checkEvent(ctx.weddingId, parsed.eventId);
    await checkVendor(ctx.weddingId, parsed.vendorId);
    const expense = await createExpense(ctx.weddingId, parsed);
    await checkBudgetAlerts(ctx.weddingId);
    refresh();
    return { id: expense.id };
  });
}

export async function updateExpenseAction(input: unknown) {
  return safeAction(async () => {
    const ctx = await requirePermission("expense.edit");
    const { expenseId, ...fields } = (input ?? {}) as { expenseId?: unknown };
    const id = expenseIdSchema.parse({ expenseId }).expenseId;
    const parsed = expenseInputSchema.parse(fields);
    await checkEvent(ctx.weddingId, parsed.eventId);
    await checkVendor(ctx.weddingId, parsed.vendorId);
    await updateExpense(ctx.weddingId, id, parsed);
    await checkBudgetAlerts(ctx.weddingId);
    refresh();
    return {};
  });
}

export async function deleteExpenseAction(input: unknown) {
  return safeAction(async () => {
    const ctx = await requirePermission("expense.edit");
    await deleteExpense(ctx.weddingId, expenseIdSchema.parse(input).expenseId);
    refresh();
    return {};
  });
}

// A blank amount removes that budget.
export async function setOverallBudgetAction(input: unknown) {
  return safeAction(async () => {
    const ctx = await requirePermission("budget.edit");
    const { amount } = overallBudgetSchema.parse(input);
    await setOverallBudget(ctx.weddingId, amount ?? null);
    refresh();
    return {};
  });
}

export async function setCategoryBudgetAction(input: unknown) {
  return safeAction(async () => {
    const ctx = await requirePermission("budget.edit");
    const { category, amount } = categoryBudgetSchema.parse(input);
    await setCategoryBudget(ctx.weddingId, category, amount ?? null);
    refresh();
    return {};
  });
}

export async function setEventBudgetAction(input: unknown) {
  return safeAction(async () => {
    const ctx = await requirePermission("budget.edit");
    const { eventId, amount } = eventBudgetSchema.parse(input);
    await checkEvent(ctx.weddingId, eventId);
    await setEventBudget(ctx.weddingId, eventId, amount ?? null);
    refresh();
    return {};
  });
}

export async function saveSplitDefaultAction(input: unknown) {
  return safeAction(async () => {
    const ctx = await requirePermission("budget.edit");
    const { category, shares } = splitDefaultSchema.parse(input);
    await setSplitDefault(ctx.weddingId, category, shares);
    refresh();
    return {};
  });
}

// ---- the photo of a bill ----

export async function requestReceiptUploadAction(input: unknown) {
  return safeAction(async () => {
    const ctx = await requirePermission("expense.edit");
    await consumeRateLimit("receipt-slots", subjectKey("member", ctx.memberId), {
      limit: 60,
      windowSeconds: 15 * 60,
    });
    const { expenseId, size } = receiptRequestSchema.parse(input);
    return requestReceiptUpload(ctx.weddingId, expenseId, size);
  });
}

export async function confirmReceiptAction(input: unknown) {
  return safeAction(async () => {
    const ctx = await requirePermission("expense.edit");
    const { expenseId, receiptId } = receiptConfirmSchema.parse(input);
    await confirmReceipt(ctx.weddingId, expenseId, receiptId);
    refresh();
    return {};
  });
}

export async function removeReceiptAction(input: unknown) {
  return safeAction(async () => {
    const ctx = await requirePermission("expense.edit");
    await removeReceipt(ctx.weddingId, expenseIdSchema.parse(input).expenseId);
    refresh();
    return {};
  });
}
