import "server-only";
import {
  MongoServerError,
  ObjectId,
  type ClientSession,
  type Collection,
  type Document,
  type Filter,
  type UpdateFilter,
} from "mongodb";
import { getDb } from "@/lib/db";
import type { ListingStatus } from "./schema";
import type { VendorCategory } from "@/modules/vendors/schema";

// All MongoDB access for the marketplace module. Unlike the wedding modules, these collections
// belong to no wedding (db-design §7): vendor accounts and listings are shared by everyone, and a
// vendor must never be able to reach a wedding's data, so nothing here reads a wedding-scoped
// collection. Each query is keyed on the vendor's own id or on the listing id.

export type VendorAccountDoc = {
  _id: ObjectId;
  businessName: string;
  email: string; // lowercased, unique
  passwordHash: string;
  phone: string;
  emailVerified: boolean;
  emailVerifiedAt?: Date;
  verifyTokenHash?: string;
  verifyTokenExpiresAt?: Date;
  resetTokenHash?: string;
  resetTokenExpiresAt?: Date;
  sessionsValidAfter?: Date;
  createdAt: Date;
  updatedAt: Date;
};

export type ListingDoc = {
  _id: ObjectId;
  vendorAccountId: ObjectId; // unique: one listing per vendor
  businessName: string;
  category: VendorCategory;
  cities: string[];
  description: string;
  startingPrice?: number;
  photoKeys?: string[]; // arrives with file storage (a later release)
  links?: { website?: string; instagram?: string };
  status: ListingStatus;
  reviewNote?: string;
  ratingAvg?: number;
  ratingCount: number;
  createdAt: Date;
  updatedAt: Date;
};

let accountsReady: Promise<Collection<VendorAccountDoc>> | undefined;
let listingsReady: Promise<Collection<ListingDoc>> | undefined;

function accounts(): Promise<Collection<VendorAccountDoc>> {
  accountsReady ??= (async () => {
    const col = (await getDb()).collection<VendorAccountDoc>("vendorAccounts");
    await col.createIndex({ email: 1 }, { unique: true });
    await col.createIndex({ verifyTokenHash: 1 }, { sparse: true });
    await col.createIndex({ resetTokenHash: 1 }, { sparse: true });
    return col;
  })();
  accountsReady.catch(() => {
    accountsReady = undefined;
  });
  return accountsReady;
}

function listings(): Promise<Collection<ListingDoc>> {
  listingsReady ??= (async () => {
    const col = (await getDb()).collection<ListingDoc>("listings");
    await col.createIndex({ vendorAccountId: 1 }, { unique: true });
    await col.createIndex({ status: 1, category: 1, cities: 1 });
    return col;
  })();
  listingsReady.catch(() => {
    listingsReady = undefined;
  });
  return listingsReady;
}

const oid = (id: string) => (ObjectId.isValid(id) ? new ObjectId(id) : null);

// ---- accounts ----

export async function findAccountByEmail(email: string): Promise<VendorAccountDoc | null> {
  return (await accounts()).findOne({ email });
}

export async function findAccountById(id: string): Promise<VendorAccountDoc | null> {
  const _id = oid(id);
  return _id ? (await accounts()).findOne({ _id }) : null;
}

export async function findAccountsByIds(ids: ObjectId[]): Promise<VendorAccountDoc[]> {
  return ids.length === 0 ? [] : (await accounts()).find({ _id: { $in: ids } }).toArray();
}

// Null when the email is taken (the unique index decides, so two simultaneous sign-ups cannot
// both succeed).
export async function insertAccount(input: {
  businessName: string;
  email: string;
  phone: string;
  passwordHash: string;
}): Promise<VendorAccountDoc | null> {
  const now = new Date();
  const doc: VendorAccountDoc = {
    _id: new ObjectId(),
    ...input,
    emailVerified: false,
    createdAt: now,
    updatedAt: now,
  };
  try {
    await (await accounts()).insertOne(doc);
    return doc;
  } catch (err) {
    if (err instanceof MongoServerError && err.code === 11000) return null;
    throw err;
  }
}

export async function setVerifyToken(
  id: string,
  tokenHash: string,
  expiresAt: Date,
): Promise<void> {
  const _id = oid(id);
  if (!_id) return;
  await (
    await accounts()
  ).updateOne(
    { _id },
    {
      $set: { verifyTokenHash: tokenHash, verifyTokenExpiresAt: expiresAt, updatedAt: new Date() },
    },
  );
}

// Matched and removed in one step, so two clicks (or a mail scanner and a person) cannot both win.
export async function consumeVerifyToken(
  tokenHash: string,
  now: Date,
): Promise<VendorAccountDoc | null> {
  return (await accounts()).findOneAndUpdate(
    { verifyTokenHash: tokenHash, verifyTokenExpiresAt: { $gt: now } },
    {
      $set: { emailVerified: true, emailVerifiedAt: now, updatedAt: now },
      $unset: { verifyTokenHash: "", verifyTokenExpiresAt: "" },
    },
    { returnDocument: "after" },
  );
}

export async function setResetToken(id: string, tokenHash: string, expiresAt: Date): Promise<void> {
  const _id = oid(id);
  if (!_id) return;
  await (
    await accounts()
  ).updateOne(
    { _id },
    { $set: { resetTokenHash: tokenHash, resetTokenExpiresAt: expiresAt, updatedAt: new Date() } },
  );
}

export async function consumeResetToken(
  tokenHash: string,
  now: Date,
  passwordHash: string,
): Promise<VendorAccountDoc | null> {
  return (await accounts()).findOneAndUpdate(
    { resetTokenHash: tokenHash, resetTokenExpiresAt: { $gt: now } },
    {
      $set: { passwordHash, emailVerified: true, sessionsValidAfter: now, updatedAt: now },
      $unset: {
        resetTokenHash: "",
        resetTokenExpiresAt: "",
        verifyTokenHash: "",
        verifyTokenExpiresAt: "",
      },
    },
    { returnDocument: "after" },
  );
}

// ---- listings ----

export async function findListingByAccount(accountId: string): Promise<ListingDoc | null> {
  const id = oid(accountId);
  return id ? (await listings()).findOne({ vendorAccountId: id }) : null;
}

export async function findListingById(id: string): Promise<ListingDoc | null> {
  const _id = oid(id);
  return _id ? (await listings()).findOne({ _id }) : null;
}

export type ListingFields = {
  businessName: string;
  category: VendorCategory;
  cities: string[];
  description: string;
  startingPrice?: number;
  links?: { website?: string; instagram?: string };
};

// Creates or updates the vendor's one listing, in one atomic write. Any edit sends it back to
// "pending" so the team sees the change before it is live (api-design §13), except that a
// suspended listing stays suspended: editing is no way around a suspension.
export async function upsertListing(
  accountId: string,
  fields: ListingFields,
): Promise<ListingDoc | null> {
  const id = oid(accountId);
  if (!id) return null;
  const now = new Date();
  const pipeline: Document[] = [
    {
      $set: {
        vendorAccountId: { $literal: id },
        businessName: { $literal: fields.businessName },
        category: { $literal: fields.category },
        cities: { $literal: fields.cities },
        description: { $literal: fields.description },
        startingPrice:
          fields.startingPrice === undefined ? "$$REMOVE" : { $literal: fields.startingPrice },
        links: fields.links ? { $literal: fields.links } : "$$REMOVE",
        status: { $cond: [{ $eq: ["$status", "suspended"] }, "suspended", "pending"] },
        reviewNote: { $cond: [{ $eq: ["$status", "suspended"] }, "$reviewNote", "$$REMOVE"] },
        ratingCount: { $ifNull: ["$ratingCount", 0] },
        createdAt: { $ifNull: ["$createdAt", { $literal: now }] },
        updatedAt: { $literal: now },
      },
    },
  ];
  try {
    return await (
      await listings()
    ).findOneAndUpdate({ vendorAccountId: id }, pipeline as unknown as UpdateFilter<ListingDoc>, {
      upsert: true,
      returnDocument: "after",
    });
  } catch (err) {
    // Two saves raced to create the first listing; the second just updates it.
    if (err instanceof MongoServerError && err.code === 11000)
      return upsertListing(accountId, fields);
    throw err;
  }
}

// Moves a listing between statuses, only from the statuses given, so a stale click cannot
// overwrite a newer decision. Returns the updated listing, or null if it was not in one of them.
export async function transitionListing(
  filter: { id: string } | { accountId: string },
  from: ListingStatus[],
  to: ListingStatus,
  note?: string | null,
  options?: { session?: ClientSession },
): Promise<ListingDoc | null> {
  const query: Filter<ListingDoc> = { status: { $in: from } };
  if ("id" in filter) {
    const _id = oid(filter.id);
    if (!_id) return null;
    query._id = _id;
  } else {
    const id = oid(filter.accountId);
    if (!id) return null;
    query.vendorAccountId = id;
  }
  return (await listings()).findOneAndUpdate(
    query,
    {
      $set: { status: to, updatedAt: new Date(), ...(note ? { reviewNote: note } : {}) },
      ...(note === null || note === undefined ? { $unset: { reviewNote: "" } } : {}),
    },
    { returnDocument: "after", ...options },
  );
}

export async function listListingsForStaff(): Promise<ListingDoc[]> {
  const order: Record<ListingStatus, number> = {
    pending: 0,
    approved: 1,
    paused: 2,
    suspended: 3,
    rejected: 4,
  };
  const all = await (await listings()).find({}).sort({ updatedAt: -1 }).limit(500).toArray();
  return all.sort((a, b) => order[a.status] - order[b.status]);
}
