"use server";

import { revalidatePath } from "next/cache";
import { safeAction } from "@/lib/action";
import { requireMember } from "@/lib/authz";
import { AppError } from "@/lib/errors";
import { getEventsByIds } from "@/modules/events/service";
import {
  installmentInputSchema,
  installmentRefSchema,
  markPaidSchema,
  updateInstallmentSchema,
  vendorIdSchema,
  vendorInputSchema,
  type VendorInput,
} from "./schema";
import {
  addInstallment,
  createVendor,
  deleteInstallment,
  deleteVendor,
  markInstallmentPaid,
  markInstallmentUnpaid,
  updateInstallment,
  updateVendor,
} from "./service";

// Server Actions for My Vendors and payment schedules. Open to Admins and Managers. The wedding
// always comes from the signed-in member. A vendor may only be linked to events of the same
// wedding, checked here because this module does not reach into the events module's data.

async function checkEvents(weddingId: string, input: VendorInput) {
  const wanted = new Set(input.eventIds);
  if (wanted.size === 0) return;
  if ((await getEventsByIds(weddingId, [...wanted])).length !== wanted.size)
    throw new AppError("VALIDATION_FAILED", "One of those events no longer exists.", {
      eventIds: ["Choose from the events in the list"],
    });
}

const refresh = () => revalidatePath("/", "layout");

export async function createVendorAction(input: unknown) {
  return safeAction(async () => {
    const ctx = await requireMember();
    const parsed = vendorInputSchema.parse(input);
    await checkEvents(ctx.weddingId, parsed);
    const vendor = await createVendor(ctx.weddingId, parsed);
    refresh();
    return { id: vendor.id };
  });
}

export async function updateVendorAction(input: unknown) {
  return safeAction(async () => {
    const ctx = await requireMember();
    const { vendorId, ...fields } = (input ?? {}) as { vendorId?: unknown };
    const id = vendorIdSchema.parse({ vendorId }).vendorId;
    const parsed = vendorInputSchema.parse(fields);
    await checkEvents(ctx.weddingId, parsed);
    await updateVendor(ctx.weddingId, id, parsed);
    refresh();
    return {};
  });
}

export async function deleteVendorAction(input: unknown) {
  return safeAction(async () => {
    const ctx = await requireMember();
    await deleteVendor(ctx.weddingId, vendorIdSchema.parse(input).vendorId);
    refresh();
    return {};
  });
}

export async function addInstallmentAction(input: unknown) {
  return safeAction(async () => {
    const ctx = await requireMember();
    const { vendorId, ...fields } = (input ?? {}) as { vendorId?: unknown };
    const id = vendorIdSchema.parse({ vendorId }).vendorId;
    await addInstallment(ctx.weddingId, id, installmentInputSchema.parse(fields));
    refresh();
    return {};
  });
}

export async function updateInstallmentAction(input: unknown) {
  return safeAction(async () => {
    const ctx = await requireMember();
    const { vendorId, installmentId, label, amount, dueDate } =
      updateInstallmentSchema.parse(input);
    await updateInstallment(ctx.weddingId, vendorId, installmentId, { label, amount, dueDate });
    refresh();
    return {};
  });
}

export async function deleteInstallmentAction(input: unknown) {
  return safeAction(async () => {
    const ctx = await requireMember();
    const { vendorId, installmentId } = installmentRefSchema.parse(input);
    await deleteInstallment(ctx.weddingId, vendorId, installmentId);
    refresh();
    return {};
  });
}

export async function markInstallmentPaidAction(input: unknown) {
  return safeAction(async () => {
    const ctx = await requireMember();
    const { vendorId, installmentId, paidBy, paidOn } = markPaidSchema.parse(input);
    await markInstallmentPaid(ctx.weddingId, vendorId, installmentId, { paidBy, paidOn });
    refresh();
    return {};
  });
}

export async function markInstallmentUnpaidAction(input: unknown) {
  return safeAction(async () => {
    const ctx = await requireMember();
    const { vendorId, installmentId } = installmentRefSchema.parse(input);
    await markInstallmentUnpaid(ctx.weddingId, vendorId, installmentId);
    refresh();
    return {};
  });
}
