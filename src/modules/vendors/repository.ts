import "server-only";
import { ObjectId, type ClientSession, type Collection, type Filter } from "mongodb";
import { getDb } from "@/lib/db";
import { scoped } from "@/lib/scoped";
import type { VendorCategory } from "./schema";

// All MongoDB access for the vendors module, always through scoped(). A vendor holds its own
// payment schedule as embedded installments: few, bounded, and always read with the vendor.
export type InstallmentDoc = {
  _id: ObjectId;
  label: string;
  amount: number; // paise
  dueDate: Date;
  status: "upcoming" | "paid";
  paidOn?: Date;
};

export type VendorDoc = {
  _id: ObjectId;
  weddingId: ObjectId;
  name: string;
  category: VendorCategory;
  phone?: string;
  email?: string;
  address?: string;
  totalCost?: number;
  eventIds?: ObjectId[];
  notes?: string;
  installments: InstallmentDoc[];
  listingId?: ObjectId; // set when added from the marketplace (a later release)
  createdAt: Date;
  updatedAt: Date;
};

export type VendorFields = Pick<VendorDoc, "name" | "category"> &
  Partial<
    Pick<
      VendorDoc,
      "phone" | "email" | "address" | "totalCost" | "eventIds" | "notes" | "listingId"
    >
  >;
export type OptionalVendorField =
  "phone" | "email" | "address" | "totalCost" | "eventIds" | "notes";

let ready: Promise<Collection<VendorDoc>> | undefined;

function vendors(): Promise<Collection<VendorDoc>> {
  ready ??= (async () => {
    const col = (await getDb()).collection<VendorDoc>("vendors");
    await col.createIndex({ weddingId: 1, category: 1 });
    await col.createIndex({ weddingId: 1, eventIds: 1 });
    // A marketplace vendor is added to My Vendors once: accepting two quotes cannot make two.
    await col.createIndex(
      { weddingId: 1, listingId: 1 },
      { unique: true, partialFilterExpression: { listingId: { $exists: true } } },
    );
    return col;
  })();
  ready.catch(() => {
    ready = undefined;
  });
  return ready;
}

const oid = (id: string) => (ObjectId.isValid(id) ? new ObjectId(id) : null);

export async function insertVendor(
  weddingId: string,
  fields: VendorFields,
  options?: { session?: ClientSession },
): Promise<VendorDoc> {
  const now = new Date();
  const doc = { _id: new ObjectId(), ...fields, installments: [], createdAt: now, updatedAt: now };
  await scoped(await vendors(), { weddingId }).insertOne(doc, options);
  return { ...doc, weddingId: new ObjectId(weddingId) };
}

export async function findVendor(weddingId: string, id: string): Promise<VendorDoc | null> {
  const _id = oid(id);
  return _id ? scoped(await vendors(), { weddingId }).findOne({ _id }) : null;
}

export async function listVendorDocs(
  weddingId: string,
  filter: { category?: VendorCategory; eventId?: string } = {},
): Promise<VendorDoc[]> {
  const query: Filter<VendorDoc> = {};
  if (filter.category) query.category = filter.category;
  if (filter.eventId) {
    const id = oid(filter.eventId);
    if (!id) return [];
    query.eventIds = id;
  }
  return scoped(await vendors(), { weddingId })
    .find(query)
    .collation({ locale: "en", strength: 2 })
    .sort({ name: 1, _id: 1 })
    .toArray();
}

export async function replaceVendorFields(
  weddingId: string,
  id: string,
  set: Partial<VendorFields>,
  unset: OptionalVendorField[],
): Promise<VendorDoc | null> {
  const _id = oid(id);
  if (!_id) return null;
  return scoped(await vendors(), { weddingId }).findOneAndUpdate(
    { _id },
    {
      $set: { ...set, updatedAt: new Date() },
      ...(unset.length > 0 ? { $unset: Object.fromEntries(unset.map((f) => [f, ""])) } : {}),
    },
    { returnDocument: "after" },
  );
}

export async function deleteVendor(
  weddingId: string,
  id: string,
  options?: { session?: ClientSession },
): Promise<boolean> {
  const _id = oid(id);
  if (!_id) return false;
  return (
    (await scoped(await vendors(), { weddingId }).deleteOne({ _id }, options)).deletedCount === 1
  );
}

export async function pushInstallment(
  weddingId: string,
  vendorId: string,
  installment: Omit<InstallmentDoc, "_id" | "status">,
): Promise<InstallmentDoc | null> {
  const _id = oid(vendorId);
  if (!_id) return null;
  const doc: InstallmentDoc = { _id: new ObjectId(), status: "upcoming", ...installment };
  const result = await scoped(await vendors(), { weddingId }).updateOne(
    { _id },
    { $push: { installments: doc }, $set: { updatedAt: new Date() } },
  );
  return result.matchedCount === 1 ? doc : null;
}

// Editing and deleting only touch installments that are not paid yet: a paid one has an expense
// attached, and is reversed with "mark unpaid".
export async function changeInstallment(
  weddingId: string,
  vendorId: string,
  installmentId: string,
  set: { label: string; amount: number; dueDate: Date },
): Promise<boolean> {
  const [v, i] = [oid(vendorId), oid(installmentId)];
  if (!v || !i) return false;
  const result = await scoped(await vendors(), { weddingId }).updateOne(
    { _id: v, installments: { $elemMatch: { _id: i, status: "upcoming" } } },
    {
      $set: {
        "installments.$[i].label": set.label,
        "installments.$[i].amount": set.amount,
        "installments.$[i].dueDate": set.dueDate,
        updatedAt: new Date(),
      },
    },
    { arrayFilters: [{ "i._id": i, "i.status": "upcoming" }] },
  );
  return result.modifiedCount === 1;
}

export async function pullInstallment(
  weddingId: string,
  vendorId: string,
  installmentId: string,
): Promise<boolean> {
  const [v, i] = [oid(vendorId), oid(installmentId)];
  if (!v || !i) return false;
  // The filter itself requires an unpaid installment, so a paid one matches nothing (the
  // updatedAt change would otherwise make any write look like a success).
  const result = await scoped(await vendors(), { weddingId }).updateOne(
    { _id: v, installments: { $elemMatch: { _id: i, status: "upcoming" } } },
    { $pull: { installments: { _id: i, status: "upcoming" } }, $set: { updatedAt: new Date() } },
  );
  return result.modifiedCount === 1;
}

// Flips one installment to paid, only if it is not paid already. Returns false when nothing
// changed, so two people pressing "Paid" at once cannot both create an expense.
export async function setInstallmentPaid(
  weddingId: string,
  vendorId: string,
  installmentId: string,
  paidOn: Date,
  options: { session: ClientSession },
): Promise<boolean> {
  const [v, i] = [oid(vendorId), oid(installmentId)];
  if (!v || !i) return false;
  const result = await scoped(await vendors(), { weddingId }).updateOne(
    { _id: v, installments: { $elemMatch: { _id: i, status: "upcoming" } } },
    {
      $set: {
        "installments.$[i].status": "paid",
        "installments.$[i].paidOn": paidOn,
        updatedAt: new Date(),
      },
    },
    { arrayFilters: [{ "i._id": i, "i.status": "upcoming" }], session: options.session },
  );
  return result.modifiedCount === 1;
}

export async function setInstallmentUnpaid(
  weddingId: string,
  vendorId: string,
  installmentId: string,
  options: { session: ClientSession },
): Promise<boolean> {
  const [v, i] = [oid(vendorId), oid(installmentId)];
  if (!v || !i) return false;
  const result = await scoped(await vendors(), { weddingId }).updateOne(
    { _id: v, installments: { $elemMatch: { _id: i, status: "paid" } } },
    {
      $set: { "installments.$[i].status": "upcoming", updatedAt: new Date() },
      $unset: { "installments.$[i].paidOn": "" },
    },
    { arrayFilters: [{ "i._id": i, "i.status": "paid" }], session: options.session },
  );
  return result.modifiedCount === 1;
}

// Deleting an event removes it from every vendor's list of events (PRD 5.3).
export async function pullEvent(
  weddingId: string,
  eventId: string,
  options?: { session?: ClientSession },
): Promise<void> {
  const id = oid(eventId);
  if (!id) return;
  await scoped(await vendors(), { weddingId }).updateMany(
    { eventIds: id },
    { $pull: { eventIds: id }, $set: { updatedAt: new Date() } },
    options,
  );
}

export async function countForEvent(weddingId: string, eventId: string): Promise<number> {
  const id = oid(eventId);
  return id ? scoped(await vendors(), { weddingId }).countDocuments({ eventIds: id }) : 0;
}

export async function findVendorByListing(
  weddingId: string,
  listingId: string,
): Promise<VendorDoc | null> {
  const id = oid(listingId);
  return id ? scoped(await vendors(), { weddingId }).findOne({ listingId: id }) : null;
}

export type InstallmentAlertRow = {
  weddingId: ObjectId;
  vendorName: string;
  installmentId: ObjectId;
  label: string;
  amount: number;
  dueDate: Date;
};

// A system job, not a request: unpaid installments falling due before `cutoff`, across every
// wedding. The caller works out who to tell, per wedding.
export async function findInstallmentsDueBefore(
  cutoff: Date,
  limit: number,
): Promise<InstallmentAlertRow[]> {
  const rows = await (
    await vendors()
  )
    .aggregate<{
      weddingId: ObjectId;
      name: string;
      installments: InstallmentDoc;
    }>([
      {
        $match: { installments: { $elemMatch: { status: "upcoming", dueDate: { $lt: cutoff } } } },
      },
      { $unwind: "$installments" },
      { $match: { "installments.status": "upcoming", "installments.dueDate": { $lt: cutoff } } },
      { $limit: limit },
      { $project: { weddingId: 1, name: 1, installments: 1 } },
    ])
    .toArray();
  return rows.map((r) => ({
    weddingId: r.weddingId,
    vendorName: r.name,
    installmentId: r.installments._id,
    label: r.installments.label,
    amount: r.installments.amount,
    dueDate: r.installments.dueDate,
  }));
}
