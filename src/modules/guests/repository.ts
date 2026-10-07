import "server-only";
import {
  ObjectId,
  type ClientSession,
  type Collection,
  type Document,
  type Filter,
  type UpdateFilter,
} from "mongodb";
import { getDb } from "@/lib/db";
import { scoped } from "@/lib/scoped";
import type { RsvpStatus } from "./schema";

// All MongoDB access for the guests module. One guest document is one invited party, with its
// per-event invitations embedded (db-design §6): a guest and all their RSVPs are read and
// written together. Member-side calls go through scoped(). The two guest-facing calls that start
// from a link (findGuestByToken, applyRsvpByToken) cannot know the wedding yet, so they use the
// raw collection and are keyed on the unguessable token alone.
export type InvitationDoc = {
  eventId: ObjectId;
  rsvpStatus: RsvpStatus;
  numberAttending?: number;
  respondedAt?: Date;
  entryToken: string;
  tableId?: ObjectId;
};

export type GuestDoc = {
  _id: ObjectId;
  weddingId: ObjectId;
  name: string;
  phone?: string;
  email?: string;
  guestsAllowed: number;
  notes?: string;
  token: string;
  invitations: InvitationDoc[];
  remindersUnsubscribed: boolean;
  inviteEmailedAt?: Date;
  whatsappSharedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
};

export type GuestFields = Pick<GuestDoc, "name" | "guestsAllowed"> &
  Partial<Pick<GuestDoc, "phone" | "email" | "notes">>;
export type OptionalGuestField = "phone" | "email" | "notes";

let ready: Promise<Collection<GuestDoc>> | undefined;

function guests(): Promise<Collection<GuestDoc>> {
  ready ??= (async () => {
    const col = (await getDb()).collection<GuestDoc>("guests");
    await col.createIndex({ token: 1 }, { unique: true });
    await col.createIndex({ weddingId: 1, name: 1 });
    await col.createIndex({ weddingId: 1, "invitations.eventId": 1, "invitations.rsvpStatus": 1 });
    // Partial, so a guest with no invitations (never expected, but possible) does not collide.
    await col.createIndex(
      { "invitations.entryToken": 1 },
      { unique: true, partialFilterExpression: { "invitations.entryToken": { $exists: true } } },
    );
    await col.createIndex({ weddingId: 1, phone: 1 }, { sparse: true });
    return col;
  })();
  ready.catch(() => {
    ready = undefined;
  });
  return ready;
}

const oid = (id: string) => (ObjectId.isValid(id) ? new ObjectId(id) : null);

export async function insertGuest(
  weddingId: string,
  doc: Omit<GuestDoc, "_id" | "weddingId" | "createdAt" | "updatedAt">,
  options?: { session?: ClientSession },
): Promise<GuestDoc> {
  const now = new Date();
  const full = { _id: new ObjectId(), ...doc, createdAt: now, updatedAt: now };
  await scoped(await guests(), { weddingId }).insertOne(full, options);
  return { ...full, weddingId: new ObjectId(weddingId) };
}

export async function insertGuests(
  weddingId: string,
  docs: Array<Omit<GuestDoc, "_id" | "weddingId" | "createdAt" | "updatedAt">>,
): Promise<number> {
  if (docs.length === 0) return 0;
  const col = scoped(await guests(), { weddingId });
  const now = new Date();
  const wid = col.weddingId;
  const result = await (
    await guests()
  ).insertMany(
    docs.map((d) => ({
      _id: new ObjectId(),
      weddingId: wid,
      ...d,
      createdAt: now,
      updatedAt: now,
    })),
    { ordered: true },
  );
  return result.insertedCount;
}

export async function findGuest(weddingId: string, id: string): Promise<GuestDoc | null> {
  const _id = oid(id);
  return _id ? scoped(await guests(), { weddingId }).findOne({ _id }) : null;
}

// The one lookup that starts from a link: the token is the credential, so the wedding is not
// known yet. Returns the whole party, which includes only their own invitations.
export async function findGuestByToken(token: string): Promise<GuestDoc | null> {
  if (typeof token !== "string" || token.length < 10 || token.length > 64) return null;
  return (await guests()).findOne({ token });
}

export type GuestSearch = {
  search?: string;
  eventId?: string;
  status?: RsvpStatus;
  skip: number;
  limit: number;
};

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function listFilter(query: Pick<GuestSearch, "search" | "eventId" | "status">): Filter<GuestDoc> {
  const filter: Filter<GuestDoc> = {};
  const clauses: Filter<GuestDoc>[] = [];
  if (query.search) {
    const digits = query.search.replace(/\D/g, "");
    clauses.push({
      $or: [
        { name: { $regex: escapeRegex(query.search), $options: "i" } },
        ...(digits.length >= 3 ? [{ phone: { $regex: escapeRegex(digits) } }] : []),
      ],
    });
  }
  const eventId = query.eventId ? oid(query.eventId) : null;
  if (query.eventId || query.status) {
    clauses.push({
      invitations: {
        $elemMatch: {
          ...(eventId ? { eventId } : {}),
          ...(query.status ? { rsvpStatus: query.status } : {}),
        },
      },
    });
  }
  if (clauses.length > 0) filter.$and = clauses;
  return filter;
}

export async function searchGuests(
  weddingId: string,
  query: GuestSearch,
): Promise<{ docs: GuestDoc[]; total: number }> {
  const col = scoped(await guests(), { weddingId });
  const filter = listFilter(query);
  const [docs, total] = await Promise.all([
    col
      .find(filter)
      .collation({ locale: "en", strength: 2 })
      .sort({ name: 1, _id: 1 })
      .skip(query.skip)
      .limit(query.limit)
      .toArray(),
    col.countDocuments(filter),
  ]);
  return { docs, total };
}

// Every guest, name order. Used for exports, the RSVP tables and reminders (a wedding has
// hundreds of guests, not millions).
export async function listAllGuests(
  weddingId: string,
  query: Pick<GuestSearch, "eventId" | "status"> = {},
): Promise<GuestDoc[]> {
  return scoped(await guests(), { weddingId })
    .find(listFilter(query))
    .collation({ locale: "en", strength: 2 })
    .sort({ name: 1, _id: 1 })
    .toArray();
}

export async function findGuestsByIds(weddingId: string, ids: string[]): Promise<GuestDoc[]> {
  const valid = ids.filter((id) => ObjectId.isValid(id)).map((id) => new ObjectId(id));
  if (valid.length === 0) return [];
  return scoped(await guests(), { weddingId })
    .find({ _id: { $in: valid } })
    .toArray();
}

export async function markInviteEmailed(weddingId: string, ids: string[]): Promise<void> {
  const valid = ids.filter((id) => ObjectId.isValid(id)).map((id) => new ObjectId(id));
  if (valid.length === 0) return;
  await scoped(await guests(), { weddingId }).updateMany(
    { _id: { $in: valid } },
    { $set: { inviteEmailedAt: new Date() } },
  );
}

// The one-click unsubscribe, which starts from the emailed link and so, like the invitation page,
// is keyed on the guest's unguessable token. Returns false for an unknown link.
export async function setRemindersUnsubscribed(token: string, value: boolean): Promise<boolean> {
  if (typeof token !== "string" || token.length < 10 || token.length > 64) return false;
  const result = await (
    await guests()
  ).updateOne({ token }, { $set: { remindersUnsubscribed: value, updatedAt: new Date() } });
  return result.matchedCount === 1;
}

export async function findGuestByPhone(
  weddingId: string,
  phone: string,
  excludeId?: string,
): Promise<GuestDoc | null> {
  const exclude = excludeId ? oid(excludeId) : null;
  return scoped(await guests(), { weddingId }).findOne({
    phone,
    ...(exclude ? { _id: { $ne: exclude } } : {}),
  });
}

export async function findGuestsByPhones(weddingId: string, phones: string[]): Promise<GuestDoc[]> {
  if (phones.length === 0) return [];
  return scoped(await guests(), { weddingId })
    .find({ phone: { $in: phones } })
    .toArray();
}

// Updates the guest's details and reconciles invitations in one atomic write, so an RSVP that
// arrives while a member is editing is never lost: invitations for events that are no longer
// ticked are dropped (with their RSVP), ones that stay keep their response, and new ones start
// pending with a fresh entry token (PRD 5.5).
export async function updateGuest(
  weddingId: string,
  id: string,
  set: GuestFields,
  unset: OptionalGuestField[],
  eventIds: string[],
  newEntries: Array<{ eventId: string; entryToken: string }>,
): Promise<GuestDoc | null> {
  const _id = oid(id);
  if (!_id) return null;
  const keep = eventIds.map((e) => new ObjectId(e));
  const fresh = newEntries.map((e) => ({
    eventId: new ObjectId(e.eventId),
    rsvpStatus: "pending",
    entryToken: e.entryToken,
  }));
  const pipeline: Document[] = [
    {
      $set: {
        ...Object.fromEntries(Object.entries(set).map(([k, v]) => [k, { $literal: v }])),
        updatedAt: { $literal: new Date() },
        invitations: {
          $concatArrays: [
            {
              $filter: {
                input: "$invitations",
                cond: { $in: ["$$this.eventId", { $literal: keep }] },
              },
            },
            {
              $filter: {
                input: { $literal: fresh },
                cond: {
                  $not: {
                    $in: [
                      "$$this.eventId",
                      { $map: { input: "$invitations", in: "$$this.eventId" } },
                    ],
                  },
                },
              },
            },
          ],
        },
      },
    },
    ...(unset.length > 0 ? [{ $unset: unset }] : []),
  ];
  return scoped(await guests(), { weddingId }).findOneAndUpdate(
    { _id },
    pipeline as unknown as UpdateFilter<GuestDoc>,
    { returnDocument: "after" },
  );
}

export async function deleteGuest(weddingId: string, id: string): Promise<boolean> {
  const _id = oid(id);
  if (!_id) return false;
  return (await scoped(await guests(), { weddingId }).deleteOne({ _id })).deletedCount === 1;
}

type RsvpWrite = { status: RsvpStatus; numberAttending?: number };

function rsvpUpdate(write: RsvpWrite): UpdateFilter<GuestDoc> {
  const now = new Date();
  return {
    $set: {
      "invitations.$[i].rsvpStatus": write.status,
      ...(write.status === "pending" ? {} : { "invitations.$[i].respondedAt": now }),
      ...(write.status === "attending"
        ? { "invitations.$[i].numberAttending": write.numberAttending }
        : {}),
      updatedAt: now,
    },
    ...(write.status === "attending"
      ? {}
      : {
          $unset: {
            "invitations.$[i].numberAttending": "",
            ...(write.status === "pending" ? { "invitations.$[i].respondedAt": "" } : {}),
          },
        }),
  } as UpdateFilter<GuestDoc>;
}

// A response for one event, by the guest's own link. Matches only if the guest is invited to the
// event and (when attending) the headcount fits the allowance, all in one atomic write. Returns
// null when nothing matched; the caller works out which rule was broken.
export async function applyRsvpByToken(
  token: string,
  eventId: string,
  write: RsvpWrite,
): Promise<GuestDoc | null> {
  const event = oid(eventId);
  if (!event) return null;
  return (await guests()).findOneAndUpdate(
    {
      token,
      invitations: { $elemMatch: { eventId: event } },
      ...(write.status === "attending"
        ? { guestsAllowed: { $gte: write.numberAttending ?? 1 } }
        : {}),
    },
    rsvpUpdate(write),
    { arrayFilters: [{ "i.eventId": event }], returnDocument: "after" },
  );
}

// The same write on a member's behalf, scoped to their wedding and not limited by event start.
export async function applyRsvpForGuest(
  weddingId: string,
  guestId: string,
  eventId: string,
  write: RsvpWrite,
): Promise<GuestDoc | null> {
  const [_id, event] = [oid(guestId), oid(eventId)];
  if (!_id || !event) return null;
  return scoped(await guests(), { weddingId }).findOneAndUpdate(
    {
      _id,
      invitations: { $elemMatch: { eventId: event } },
      ...(write.status === "attending"
        ? { guestsAllowed: { $gte: write.numberAttending ?? 1 } }
        : {}),
    },
    rsvpUpdate(write),
    { arrayFilters: [{ "i.eventId": event }], returnDocument: "after" },
  );
}

export async function markWhatsappShared(weddingId: string, guestId: string): Promise<void> {
  const _id = oid(guestId);
  if (!_id) return;
  await scoped(await guests(), { weddingId }).updateOne(
    { _id },
    { $set: { whatsappSharedAt: new Date() } },
  );
}

// Deleting an event removes every guest's invitation (and RSVP) for it (PRD 5.3).
export async function pullEventInvitations(
  weddingId: string,
  eventId: string,
  options?: { session?: ClientSession },
): Promise<number> {
  const id = oid(eventId);
  if (!id) return 0;
  const result = await scoped(await guests(), { weddingId }).updateMany(
    { "invitations.eventId": id },
    { $pull: { invitations: { eventId: id } }, $set: { updatedAt: new Date() } },
    options,
  );
  return result.modifiedCount;
}

export async function countInvitedToEvent(weddingId: string, eventId: string): Promise<number> {
  const id = oid(eventId);
  return id
    ? scoped(await guests(), { weddingId }).countDocuments({ "invitations.eventId": id })
    : 0;
}

type StatsRow = {
  overall: Array<{ parties: number; responded: number; pending: number; headcount: number }>;
  perEvent: Array<{
    _id: ObjectId;
    invited: number;
    attending: number;
    notAttending: number;
    pending: number;
    headcount: number;
  }>;
};

// Parties and headcounts, overall and per event, worked out from the data every time so the
// numbers can never drift (db-design §6).
export async function guestStats(weddingId: string): Promise<StatsRow> {
  const [row] = await scoped(await guests(), { weddingId })
    .aggregate<StatsRow>([
      {
        $facet: {
          overall: [
            {
              $group: {
                _id: null,
                parties: { $sum: 1 },
                responded: {
                  $sum: {
                    $cond: [
                      {
                        $gt: [
                          {
                            $size: {
                              $filter: {
                                input: "$invitations",
                                cond: { $ne: ["$$this.rsvpStatus", "pending"] },
                              },
                            },
                          },
                          0,
                        ],
                      },
                      1,
                      0,
                    ],
                  },
                },
                headcount: { $sum: { $ifNull: [{ $max: "$invitations.numberAttending" }, 0] } },
              },
            },
            {
              $project: {
                _id: 0,
                parties: 1,
                responded: 1,
                headcount: 1,
                pending: { $subtract: ["$parties", "$responded"] },
              },
            },
          ],
          perEvent: [
            { $unwind: "$invitations" },
            {
              $group: {
                _id: "$invitations.eventId",
                invited: { $sum: 1 },
                attending: {
                  $sum: { $cond: [{ $eq: ["$invitations.rsvpStatus", "attending"] }, 1, 0] },
                },
                notAttending: {
                  $sum: { $cond: [{ $eq: ["$invitations.rsvpStatus", "not_attending"] }, 1, 0] },
                },
                pending: {
                  $sum: { $cond: [{ $eq: ["$invitations.rsvpStatus", "pending"] }, 1, 0] },
                },
                headcount: { $sum: { $ifNull: ["$invitations.numberAttending", 0] } },
              },
            },
          ],
        },
      },
    ])
    .toArray();
  return row ?? { overall: [], perEvent: [] };
}

// The party whose invitation carries this entry QR, within one wedding (the member scanning it has
// a wedding, so a code from another wedding finds nothing).
export async function findGuestByEntryToken(
  weddingId: string,
  token: string,
): Promise<GuestDoc | null> {
  if (typeof token !== "string" || token.length < 10 || token.length > 64) return null;
  return scoped(await guests(), { weddingId }).findOne({ "invitations.entryToken": token });
}

export type ReplyOverview = {
  attendingParties: number;
  declinedParties: number;
  recent: {
    guestId: string;
    guestName: string;
    eventId: string;
    status: "attending" | "not_attending";
    numberAttending?: number;
    respondedAt: Date;
  }[];
};

// What the dashboard shows about replies, worked out in the database: how many parties are coming,
// how many have declined everything, and the latest few answers. Nothing else is read.
export async function replyOverview(
  weddingId: string,
  recentLimit: number,
): Promise<ReplyOverview> {
  const col = scoped(await guests(), { weddingId });
  const [attendingParties, declinedParties, recent] = await Promise.all([
    col.countDocuments({ "invitations.rsvpStatus": "attending" }),
    // At least one invitation, and none of them still waiting or attending.
    col.countDocuments({
      "invitations.0": { $exists: true },
      "invitations.rsvpStatus": { $nin: ["pending", "attending"] },
    }),
    col
      .aggregate<{
        _id: ObjectId;
        name: string;
        invitations: {
          eventId: ObjectId;
          rsvpStatus: "attending" | "not_attending";
          numberAttending?: number;
          respondedAt: Date;
        };
      }>([
        { $match: { "invitations.respondedAt": { $exists: true } } },
        { $unwind: "$invitations" },
        {
          $match: {
            "invitations.rsvpStatus": { $ne: "pending" },
            "invitations.respondedAt": { $exists: true },
          },
        },
        { $sort: { "invitations.respondedAt": -1 } },
        { $limit: recentLimit },
        { $project: { name: 1, invitations: 1 } },
      ])
      .toArray(),
  ]);
  return {
    attendingParties,
    declinedParties,
    recent: recent.map((r) => ({
      guestId: r._id.toHexString(),
      guestName: r.name,
      eventId: r.invitations.eventId.toHexString(),
      status: r.invitations.rsvpStatus,
      ...(r.invitations.numberAttending ? { numberAttending: r.invitations.numberAttending } : {}),
      respondedAt: r.invitations.respondedAt,
    })),
  };
}
