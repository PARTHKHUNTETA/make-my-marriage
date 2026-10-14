import "server-only";
import { ObjectId, type Collection } from "mongodb";
import { getDb } from "@/lib/db";
import { scoped } from "@/lib/scoped";

// The audit log (RBAC design, section 6): who changed access, or did something that cannot be
// undone, and what it was before and after. Wedding entries carry the wedding's id and are read only
// through scoped(); platform entries (staff actions) have none. Kept for two years.

export type AuditAction =
  | "role.create"
  | "role.update"
  | "role.delete"
  | "member.roles"
  | "member.invite"
  | "member.invite_cancel"
  | "member.remove"
  | "wedding.delete"
  | "gallery.reset_link"
  | "staff.roles"
  | "listing.decide"
  | "review.remove";

type AuditDoc = {
  _id: ObjectId;
  weddingId?: ObjectId;
  actorUserId: ObjectId;
  action: AuditAction;
  // What was acted on, in words a reader understands ("Rahul Verma", "role Groom's family").
  target: string;
  before?: unknown;
  after?: unknown;
  at: Date;
};

export type AuditEntry = {
  id: string;
  weddingId?: string;
  actorUserId: string;
  action: AuditAction;
  target: string;
  before?: unknown;
  after?: unknown;
  at: Date;
};

const TWO_YEARS = 2 * 365 * 24 * 60 * 60;
let ready: Promise<Collection<AuditDoc>> | undefined;

function logs(): Promise<Collection<AuditDoc>> {
  ready ??= (async () => {
    const col = (await getDb()).collection<AuditDoc>("auditLogs");
    await col.createIndex({ at: 1 }, { expireAfterSeconds: TWO_YEARS });
    await col.createIndex({ weddingId: 1, at: -1 });
    return col;
  })();
  ready.catch(() => {
    ready = undefined;
  });
  return ready;
}

// The same collection, typed for the wedding entries that scoped() works with.
type WeddingAuditDoc = AuditDoc & { weddingId: ObjectId };
const weddingLogs = async () => (await logs()) as unknown as Collection<WeddingAuditDoc>;

// Records one entry. Never throws: the action it describes has already happened, so a failure to
// write the log is reported to the server log rather than turned into a failed action.
export async function recordAudit(entry: {
  weddingId?: string;
  actorUserId: string;
  action: AuditAction;
  target: string;
  before?: unknown;
  after?: unknown;
}): Promise<void> {
  try {
    const doc = {
      _id: new ObjectId(),
      actorUserId: new ObjectId(entry.actorUserId),
      action: entry.action,
      target: entry.target.slice(0, 200),
      ...(entry.before !== undefined ? { before: entry.before } : {}),
      ...(entry.after !== undefined ? { after: entry.after } : {}),
      at: new Date(),
    };
    if (entry.weddingId) {
      await scoped(await weddingLogs(), { weddingId: entry.weddingId }).insertOne(doc);
    } else {
      await (await logs()).insertOne(doc);
    }
  } catch (err) {
    console.error(
      "audit log write failed",
      entry.action,
      err instanceof Error ? err.name : "unknown",
    );
  }
}

const toEntry = (d: AuditDoc): AuditEntry => ({
  id: d._id.toHexString(),
  weddingId: d.weddingId?.toHexString(),
  actorUserId: d.actorUserId.toHexString(),
  action: d.action,
  target: d.target,
  before: d.before,
  after: d.after,
  at: d.at,
});

// One wedding's log, newest first.
export async function listWeddingAudit(weddingId: string, limit = 200): Promise<AuditEntry[]> {
  const docs = await scoped(await weddingLogs(), { weddingId })
    .find({}, { sort: { at: -1 }, limit })
    .toArray();
  return docs.map(toEntry);
}

// Everything, newest first: for staff with audit.view.
export async function listAllAudit(limit = 300): Promise<AuditEntry[]> {
  return (await (await logs()).find({}, { sort: { at: -1 }, limit }).toArray()).map(toEntry);
}
