import "server-only";
import { MongoServerError, ObjectId, type ClientSession, type Collection } from "mongodb";
import { getDb } from "@/lib/db";
import { scoped } from "@/lib/scoped";

// All MongoDB access for the members module. `users` is one of the two collections that are
// not wedding-scoped (db-design §1): the link to a wedding lives in weddingMembers.
export type UserDoc = {
  _id: ObjectId;
  name: string;
  email: string; // lowercased, unique
  passwordHash: string;
  emailVerified: boolean;
  emailVerifiedAt?: Date;
  // One-time tokens are stored only as SHA-256 hashes (see lib/tokens.ts hashToken).
  verifyTokenHash?: string;
  verifyTokenExpiresAt?: Date;
  resetTokenHash?: string;
  resetTokenExpiresAt?: Date;
  // Sessions issued before this moment are no longer valid (set when the password is reset).
  sessionsValidAfter?: Date;
  createdAt: Date;
  updatedAt: Date;
};

let ready: Promise<Collection<UserDoc>> | undefined;

// Creating an index is idempotent, so the first use on each server instance just ensures it.
function users(): Promise<Collection<UserDoc>> {
  ready ??= (async () => {
    const col = (await getDb()).collection<UserDoc>("users");
    await col.createIndex({ email: 1 }, { unique: true });
    await col.createIndex({ verifyTokenHash: 1 }, { sparse: true });
    await col.createIndex({ resetTokenHash: 1 }, { sparse: true });
    return col;
  })();
  ready.catch(() => {
    ready = undefined;
  });
  return ready;
}

export async function findUserByEmail(email: string): Promise<UserDoc | null> {
  return (await users()).findOne({ email });
}

export async function findUserById(id: string): Promise<UserDoc | null> {
  if (!ObjectId.isValid(id)) return null;
  return (await users()).findOne({ _id: new ObjectId(id) });
}

// Returns null when the email is already taken (the unique index decides, so two
// simultaneous sign-ups with the same email cannot both succeed). An account created from an
// invitation link starts verified: receiving the link proved the person owns the mailbox.
export async function insertUser(
  input: { name: string; email: string; passwordHash: string; emailVerified?: boolean },
  options?: { session?: ClientSession },
): Promise<UserDoc | null> {
  const now = new Date();
  const verified = input.emailVerified === true;
  const doc: UserDoc = {
    _id: new ObjectId(),
    name: input.name,
    email: input.email,
    passwordHash: input.passwordHash,
    emailVerified: verified,
    ...(verified ? { emailVerifiedAt: now } : {}),
    createdAt: now,
    updatedAt: now,
  };
  try {
    await (await users()).insertOne(doc, options);
    return doc;
  } catch (err) {
    if (err instanceof MongoServerError && err.code === 11000) return null;
    throw err;
  }
}

export async function findUsersByIds(ids: ObjectId[]): Promise<UserDoc[]> {
  if (ids.length === 0) return [];
  return (await users()).find({ _id: { $in: ids } }).toArray();
}

export async function markEmailVerified(
  userId: string,
  options?: { session?: ClientSession },
): Promise<void> {
  const now = new Date();
  await (
    await users()
  ).updateOne(
    { _id: new ObjectId(userId), emailVerified: false },
    {
      $set: { emailVerified: true, emailVerifiedAt: now, updatedAt: now },
      $unset: { verifyTokenHash: "", verifyTokenExpiresAt: "" },
    },
    options,
  );
}

export async function findAuthState(
  userId: string,
): Promise<{ emailVerified: boolean; sessionsValidAfter?: Date } | null> {
  if (!ObjectId.isValid(userId)) return null;
  const user = await (
    await users()
  ).findOne(
    { _id: new ObjectId(userId) },
    { projection: { emailVerified: 1, sessionsValidAfter: 1 } },
  );
  return user
    ? { emailVerified: user.emailVerified, sessionsValidAfter: user.sessionsValidAfter }
    : null;
}

export async function setVerifyToken(
  userId: string,
  tokenHash: string,
  expiresAt: Date,
): Promise<void> {
  await (
    await users()
  ).updateOne(
    { _id: new ObjectId(userId) },
    {
      $set: { verifyTokenHash: tokenHash, verifyTokenExpiresAt: expiresAt, updatedAt: new Date() },
    },
  );
}

// Atomic and single-use: the token is matched and removed in one step, so two clicks (or a mail
// scanner and a person) cannot both succeed.
export async function consumeVerifyToken(tokenHash: string, now: Date): Promise<UserDoc | null> {
  return (await users()).findOneAndUpdate(
    { verifyTokenHash: tokenHash, verifyTokenExpiresAt: { $gt: now } },
    {
      $set: { emailVerified: true, emailVerifiedAt: now, updatedAt: now },
      $unset: { verifyTokenHash: "", verifyTokenExpiresAt: "" },
    },
    { returnDocument: "after" },
  );
}

export async function setResetToken(
  userId: string,
  tokenHash: string,
  expiresAt: Date,
): Promise<void> {
  await (
    await users()
  ).updateOne(
    { _id: new ObjectId(userId) },
    { $set: { resetTokenHash: tokenHash, resetTokenExpiresAt: expiresAt, updatedAt: new Date() } },
  );
}

// Sets the new password and uses up the token in one atomic step. Following a reset link proves
// control of the mailbox, so the email counts as verified; sessions issued before now stop working.
export async function consumeResetToken(
  tokenHash: string,
  now: Date,
  passwordHash: string,
): Promise<UserDoc | null> {
  return (await users()).findOneAndUpdate(
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

// ---- weddingMembers: the link between a user and their one wedding (db-design §3) ----

export type MemberRole = "admin" | "manager";

export type MembershipDoc = {
  _id: ObjectId;
  weddingId: ObjectId;
  userId: ObjectId; // unique: a user belongs to exactly one wedding
  role: MemberRole;
  mutedNotificationTypes?: string[];
  joinedAt: Date;
  createdAt: Date;
  updatedAt: Date;
};

let membersReady: Promise<Collection<MembershipDoc>> | undefined;

function memberships(): Promise<Collection<MembershipDoc>> {
  membersReady ??= (async () => {
    const col = (await getDb()).collection<MembershipDoc>("weddingMembers");
    await col.createIndex({ userId: 1 }, { unique: true });
    await col.createIndex({ weddingId: 1 });
    return col;
  })();
  membersReady.catch(() => {
    membersReady = undefined;
  });
  return membersReady;
}

// The one deliberately unscoped read in the codebase. Resolving who someone is has to happen
// before any weddingId is known, and userId is unique, so this returns at most one document
// and can never mix weddings. Everything after it is scoped.
export async function findMembershipByUserId(userId: string): Promise<MembershipDoc | null> {
  if (!ObjectId.isValid(userId)) return null;
  return (await memberships()).findOne({ userId: new ObjectId(userId) });
}

// Throws the driver's duplicate-key error (code 11000) if the user already has a wedding.
export async function insertMembership(
  input: { weddingId: string; userId: string; role: MemberRole },
  options?: { session?: ClientSession },
): Promise<void> {
  const now = new Date();
  await scoped(await memberships(), { weddingId: input.weddingId }).insertOne(
    {
      _id: new ObjectId(),
      userId: new ObjectId(input.userId),
      role: input.role,
      joinedAt: now,
      createdAt: now,
      updatedAt: now,
    },
    options,
  );
}

// ---- membership management (all scoped to the wedding) ----

export async function listMemberships(weddingId: string): Promise<MembershipDoc[]> {
  return scoped(await memberships(), { weddingId })
    .find({}, { sort: { joinedAt: 1 } })
    .toArray();
}

export async function setMutedTypes(
  weddingId: string,
  memberId: string,
  types: string[],
): Promise<boolean> {
  if (!ObjectId.isValid(memberId)) return false;
  const result = await scoped(await memberships(), { weddingId }).updateOne(
    { _id: new ObjectId(memberId) },
    { $set: { mutedNotificationTypes: types, updatedAt: new Date() } },
  );
  return result.matchedCount === 1;
}

export async function findMembership(
  weddingId: string,
  memberId: string,
): Promise<MembershipDoc | null> {
  if (!ObjectId.isValid(memberId)) return null;
  return scoped(await memberships(), { weddingId }).findOne({ _id: new ObjectId(memberId) });
}

export async function setMemberRole(
  weddingId: string,
  memberId: string,
  role: MemberRole,
  options?: { session?: ClientSession },
): Promise<void> {
  await scoped(await memberships(), { weddingId }).updateOne(
    { _id: new ObjectId(memberId) },
    { $set: { role, updatedAt: new Date() } },
    options,
  );
}

export async function deleteMembership(
  weddingId: string,
  memberId: string,
  options?: { session?: ClientSession },
): Promise<void> {
  await scoped(await memberships(), { weddingId }).deleteOne(
    { _id: new ObjectId(memberId) },
    options,
  );
}

// Writes to every admin membership of the wedding and returns how many there are. Concurrent
// transactions that change who is an admin both write these same documents, so they conflict
// and one retries against the other's result. That is what stops two admins demoting or
// removing each other at the same moment from leaving a wedding with none.
export async function lockAdmins(
  weddingId: string,
  options: { session: ClientSession },
): Promise<number> {
  const result = await scoped(await memberships(), { weddingId }).updateMany(
    { role: "admin" },
    { $set: { updatedAt: new Date() } },
    options,
  );
  return result.matchedCount;
}

// ---- memberInvites: a pending email invitation to join as a manager (db-design §3) ----

export type InviteDoc = {
  _id: ObjectId;
  weddingId: ObjectId;
  email: string; // lowercased
  tokenHash: string; // SHA-256 of the token in the join link
  status: "pending" | "cancelled";
  invitedByUserId: ObjectId;
  expiresAt: Date; // 7 days from creation or last resend
  createdAt: Date;
  updatedAt: Date;
};

let invitesReady: Promise<Collection<InviteDoc>> | undefined;

function invites(): Promise<Collection<InviteDoc>> {
  invitesReady ??= (async () => {
    const col = (await getDb()).collection<InviteDoc>("memberInvites");
    await col.createIndex({ tokenHash: 1 }, { unique: true });
    await col.createIndex({ weddingId: 1, status: 1 });
    return col;
  })();
  invitesReady.catch(() => {
    invitesReady = undefined;
  });
  return invitesReady;
}

export async function insertInvite(
  weddingId: string,
  input: { email: string; tokenHash: string; invitedByUserId: string; expiresAt: Date },
): Promise<InviteDoc> {
  const now = new Date();
  const doc = {
    _id: new ObjectId(),
    email: input.email,
    tokenHash: input.tokenHash,
    status: "pending" as const,
    invitedByUserId: new ObjectId(input.invitedByUserId),
    expiresAt: input.expiresAt,
    createdAt: now,
    updatedAt: now,
  };
  await scoped(await invites(), { weddingId }).insertOne(doc);
  return { ...doc, weddingId: new ObjectId(weddingId) };
}

export async function listPendingInvites(weddingId: string): Promise<InviteDoc[]> {
  return scoped(await invites(), { weddingId })
    .find({ status: "pending" }, { sort: { createdAt: -1 } })
    .toArray();
}

export async function findPendingInviteByEmail(
  weddingId: string,
  email: string,
): Promise<InviteDoc | null> {
  return scoped(await invites(), { weddingId }).findOne({ email, status: "pending" });
}

// A fresh token and a fresh 7 days; the previous link stops working.
export async function renewInvite(
  weddingId: string,
  inviteId: string,
  tokenHash: string,
  expiresAt: Date,
): Promise<InviteDoc | null> {
  return scoped(await invites(), { weddingId }).findOneAndUpdate(
    { _id: new ObjectId(inviteId), status: "pending" },
    { $set: { tokenHash, expiresAt, updatedAt: new Date() } },
    { returnDocument: "after" },
  );
}

export async function cancelInvite(weddingId: string, inviteId: string): Promise<boolean> {
  if (!ObjectId.isValid(inviteId)) return false;
  const result = await scoped(await invites(), { weddingId }).updateOne(
    { _id: new ObjectId(inviteId), status: "pending" },
    { $set: { status: "cancelled", updatedAt: new Date() } },
  );
  return result.matchedCount === 1;
}

// The two lookups below are unscoped on purpose: the join link carries only a token, and the
// token (unique, unguessable) is what tells us which wedding it belongs to.
export async function findInviteByTokenHash(tokenHash: string): Promise<InviteDoc | null> {
  return (await invites()).findOne({ tokenHash, status: "pending" });
}

// Atomic and single-use: matches a live pending invite and deletes it in one step ("removed
// once accepted"), so two clicks can never both join.
export async function consumeInvite(
  tokenHash: string,
  now: Date,
  options?: { session?: ClientSession },
): Promise<InviteDoc | null> {
  return (await invites()).findOneAndDelete(
    { tokenHash, status: "pending", expiresAt: { $gt: now } },
    { ...options, includeResultMetadata: false },
  );
}
