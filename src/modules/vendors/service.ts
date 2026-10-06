import { ObjectId, type ClientSession } from "mongodb";
import { inTransaction } from "@/lib/db";
import { daysUntil, istDate } from "@/lib/dates";
import { AppError } from "@/lib/errors";
import {
  createInstallmentExpense,
  removeInstallmentExpense,
  spentByVendor,
  unlinkVendorFromMoney,
} from "@/modules/money/service";
import {
  findInstallmentsDueBefore,
  changeInstallment,
  countForEvent,
  deleteVendor as removeVendor,
  findVendor,
  findVendorByListing,
  insertVendor,
  listVendorDocs,
  pullEvent,
  pullInstallment,
  pushInstallment,
  replaceVendorFields,
  setInstallmentPaid,
  setInstallmentUnpaid,
  type InstallmentDoc,
  type OptionalVendorField,
  type VendorDoc,
  type VendorFields,
} from "./repository";
import {
  EXPENSE_CATEGORY_FOR,
  installmentStatus,
  type InstallmentInput,
  type InstallmentItem,
  type VendorInput,
  type VendorItem,
  type VendorQuery,
} from "./schema";

// Business rules for the vendors module (PRD 5.8, 5.7, api-design §8). The caller (a Server
// Action) has already checked that the events named on a vendor belong to this wedding.

const NOT_FOUND = new AppError("NOT_FOUND", "That vendor no longer exists.");

function toInstallment(doc: InstallmentDoc, now: Date): InstallmentItem {
  return {
    id: doc._id.toHexString(),
    label: doc.label,
    amount: doc.amount,
    dueDate: doc.dueDate,
    paidOn: doc.paidOn,
    status: installmentStatus(doc, now),
  };
}

function toItem(doc: VendorDoc, now: Date = new Date()): VendorItem {
  return {
    id: doc._id.toHexString(),
    name: doc.name,
    category: doc.category,
    phone: doc.phone,
    email: doc.email,
    address: doc.address,
    totalCost: doc.totalCost,
    eventIds: (doc.eventIds ?? []).map((e) => e.toHexString()),
    notes: doc.notes,
    installments: [...doc.installments]
      .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime())
      .map((i) => toInstallment(i, now)),
  };
}

function toFields(input: VendorInput): { set: VendorFields; unset: OptionalVendorField[] } {
  const set: VendorFields = { name: input.name, category: input.category };
  const unset: OptionalVendorField[] = [];
  for (const key of ["phone", "email", "address", "notes"] as const) {
    if (input[key]) set[key] = input[key];
    else unset.push(key);
  }
  if (input.totalCost !== undefined) set.totalCost = input.totalCost;
  else unset.push("totalCost");
  const events = [...new Set(input.eventIds)];
  if (events.length > 0) set.eventIds = events.map((e) => new ObjectId(e));
  else unset.push("eventIds");
  return { set, unset };
}

export async function createVendor(weddingId: string, input: VendorInput): Promise<VendorItem> {
  return toItem(await insertVendor(weddingId, toFields(input).set));
}

export async function updateVendor(
  weddingId: string,
  vendorId: string,
  input: VendorInput,
): Promise<VendorItem> {
  const { set, unset } = toFields(input);
  const doc = await replaceVendorFields(weddingId, vendorId, set, unset);
  if (!doc) throw NOT_FOUND;
  return toItem(doc);
}

export async function getVendor(weddingId: string, vendorId: string): Promise<VendorItem | null> {
  const doc = await findVendor(weddingId, vendorId);
  return doc ? toItem(doc) : null;
}

export async function vendorExists(weddingId: string, vendorId: string): Promise<boolean> {
  return (await findVendor(weddingId, vendorId)) !== null;
}

export type VendorWithSpend = { vendor: VendorItem; spent: number };

// The vendor list with "spent so far" for each: the sum of expenses linked to it.
export async function listVendors(
  weddingId: string,
  query: VendorQuery = {},
): Promise<VendorWithSpend[]> {
  const [docs, spent] = await Promise.all([
    listVendorDocs(weddingId, query),
    spentByVendor(weddingId),
  ]);
  const now = new Date();
  return docs.map((d) => ({ vendor: toItem(d, now), spent: spent.get(d._id.toHexString()) ?? 0 }));
}

export async function getVendorSpend(weddingId: string, vendorId: string): Promise<number> {
  return (await spentByVendor(weddingId)).get(vendorId) ?? 0;
}

// Deleting a vendor keeps its expenses and amounts, removes only the link (PRD 5.8).
export async function deleteVendor(weddingId: string, vendorId: string): Promise<void> {
  await inTransaction(async (session) => {
    if (!(await removeVendor(weddingId, vendorId, { session }))) throw NOT_FOUND;
    await unlinkVendorFromMoney(weddingId, vendorId, { session });
  });
}

// ---- payment schedule ----

function parseDue(input: InstallmentInput): Date {
  const due = istDate(input.dueDate);
  if (!due) throw new AppError("VALIDATION_FAILED", "Enter a valid date");
  return due;
}

export async function addInstallment(
  weddingId: string,
  vendorId: string,
  input: InstallmentInput,
): Promise<InstallmentItem> {
  const doc = await pushInstallment(weddingId, vendorId, {
    label: input.label,
    amount: input.amount,
    dueDate: parseDue(input),
  });
  if (!doc) throw NOT_FOUND;
  return toInstallment(doc, new Date());
}

export async function updateInstallment(
  weddingId: string,
  vendorId: string,
  installmentId: string,
  input: InstallmentInput,
): Promise<void> {
  const ok = await changeInstallment(weddingId, vendorId, installmentId, {
    label: input.label,
    amount: input.amount,
    dueDate: parseDue(input),
  });
  if (!ok)
    throw new AppError(
      "NOT_FOUND",
      "That payment can't be changed. It may be paid already (mark it unpaid first) or was removed.",
    );
}

export async function deleteInstallment(
  weddingId: string,
  vendorId: string,
  installmentId: string,
): Promise<void> {
  if (!(await pullInstallment(weddingId, vendorId, installmentId)))
    throw new AppError(
      "NOT_FOUND",
      "That payment can't be deleted. It may be paid already (mark it unpaid first) or was removed.",
    );
}

// Marks an installment paid and creates the linked expense, together or not at all. Pressing it
// twice (or two people at once) can never create two expenses: only the first flips the status.
export async function markInstallmentPaid(
  weddingId: string,
  vendorId: string,
  installmentId: string,
  options: { paidBy: "bride_family" | "groom_family" | "couple"; paidOn?: string },
  now: Date = new Date(),
): Promise<void> {
  const doc = await findVendor(weddingId, vendorId);
  const installment = doc?.installments.find((i) => i._id.toHexString() === installmentId);
  if (!doc || !installment) throw NOT_FOUND;
  const paidOn = options.paidOn ? istDate(options.paidOn) : istDate(toYmd(now));
  if (!paidOn) throw new AppError("VALIDATION_FAILED", "Enter a valid date");

  await inTransaction(async (session: ClientSession) => {
    if (!(await setInstallmentPaid(weddingId, vendorId, installmentId, paidOn, { session })))
      throw new AppError("VALIDATION_FAILED", "That payment is already marked as paid.");
    await createInstallmentExpense(
      weddingId,
      {
        title: `${doc.name} — ${installment.label}`,
        amount: installment.amount,
        date: paidOn,
        category: EXPENSE_CATEGORY_FOR[doc.category],
        paidBy: options.paidBy,
        vendorId,
        installmentId,
      },
      { session },
    );
  });
}

// Reverses "paid": the installment is upcoming again and its expense is removed.
export async function markInstallmentUnpaid(
  weddingId: string,
  vendorId: string,
  installmentId: string,
): Promise<void> {
  await inTransaction(async (session) => {
    if (!(await setInstallmentUnpaid(weddingId, vendorId, installmentId, { session })))
      throw new AppError("NOT_FOUND", "That payment is not marked as paid.");
    await removeInstallmentExpense(weddingId, installmentId, { session });
  });
}

function toYmd(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(date);
}

export type ScheduleRow = {
  vendorId: string;
  vendorName: string;
  installment: InstallmentItem;
};
export type VendorBalance = {
  vendorId: string;
  name: string;
  totalCost?: number;
  spent: number;
  balance?: number; // total cost less spent, when a total cost is set
};

// Every installment across all vendors by due date, and each vendor's cost, spend and balance
// (PRD 5.7 Payments page).
export async function getPaymentSchedule(
  weddingId: string,
): Promise<{ rows: ScheduleRow[]; balances: VendorBalance[] }> {
  const list = await listVendors(weddingId);
  const rows = list
    .flatMap(({ vendor }) =>
      vendor.installments.map((installment) => ({
        vendorId: vendor.id,
        vendorName: vendor.name,
        installment,
      })),
    )
    .sort((a, b) => a.installment.dueDate.getTime() - b.installment.dueDate.getTime());
  const balances = list
    .filter(
      ({ vendor, spent }) =>
        vendor.totalCost !== undefined || vendor.installments.length > 0 || spent > 0,
    )
    .map(({ vendor, spent }) => ({
      vendorId: vendor.id,
      name: vendor.name,
      totalCost: vendor.totalCost,
      spent,
      balance: vendor.totalCost === undefined ? undefined : vendor.totalCost - spent,
    }));
  return { rows, balances };
}

// ---- events ----

export function countVendorsForEvent(weddingId: string, eventId: string): Promise<number> {
  return countForEvent(weddingId, eventId);
}

// Called by the events module inside its delete transaction.
export function removeEventFromVendors(
  weddingId: string,
  eventId: string,
  options?: { session?: ClientSession },
): Promise<void> {
  return pullEvent(weddingId, eventId, options);
}

// ---- marketplace ----

// Adds a marketplace vendor to My Vendors when a couple accepts a quote: the agreed amount is the
// total cost and the events are the ones the request was for. Runs inside the marketplace
// module's transaction. A listing can be added only once per wedding.
export async function createVendorFromBooking(
  weddingId: string,
  input: {
    listingId: string;
    name: string;
    category: VendorDoc["category"];
    phone?: string;
    email?: string;
    totalCost: number;
    eventIds: string[];
  },
  options: { session: ClientSession },
): Promise<void> {
  try {
    await insertVendor(
      weddingId,
      {
        name: input.name,
        category: input.category,
        ...(input.phone ? { phone: input.phone } : {}),
        ...(input.email ? { email: input.email } : {}),
        totalCost: input.totalCost,
        eventIds: input.eventIds.map((e) => new ObjectId(e)),
        listingId: new ObjectId(input.listingId),
      },
      options,
    );
  } catch (err) {
    if (err instanceof Error && "code" in err && (err as { code?: number }).code === 11000)
      throw new AppError("VALIDATION_FAILED", "This vendor is already in your My Vendors.");
    throw err;
  }
}

export async function isListingInMyVendors(weddingId: string, listingId: string): Promise<boolean> {
  return (await findVendorByListing(weddingId, listingId)) !== null;
}

// The vendor a listing became, with its linked events, for the review rule (PRD 5.8: a review is
// allowed only after the vendor's last linked event).
export async function getVendorByListing(
  weddingId: string,
  listingId: string,
): Promise<VendorItem | null> {
  const doc = await findVendorByListing(weddingId, listingId);
  return doc ? toItem(doc) : null;
}

export type PaymentAlert = {
  weddingId: string;
  installmentId: string;
  vendorName: string;
  label: string;
  amount: number;
  daysLeft: number; // 0 today, up to 3, negative once overdue
};

// Unpaid installments due within 3 days, or already overdue, for the daily alerts.
export async function listPaymentsForAlerts(now: Date = new Date()): Promise<PaymentAlert[]> {
  const rows = await findInstallmentsDueBefore(new Date(now.getTime() + 5 * 86_400_000), 5000);
  return rows
    .map((r) => ({
      weddingId: r.weddingId.toHexString(),
      installmentId: r.installmentId.toHexString(),
      vendorName: r.vendorName,
      label: r.label,
      amount: r.amount,
      daysLeft: daysUntil(r.dueDate, now),
    }))
    .filter((a) => a.daysLeft <= 3);
}
