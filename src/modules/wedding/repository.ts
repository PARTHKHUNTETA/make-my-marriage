import "server-only";
import { ObjectId, type ClientSession, type Collection } from "mongodb";
import { getDb } from "@/lib/db";

// All MongoDB access for the wedding module. `weddings` is the root collection: every other
// wedding-owned collection points at its _id, so it is looked up by _id (taken from the
// trusted request context) rather than through scoped().
export type WeddingDoc = {
  _id: ObjectId;
  brideName: string;
  groomName: string;
  title: string;
  date: Date;
  city: string;
  venue?: string;
  coverImageKey?: string;
  description?: string;
  website: {
    slug: string; // unique; serves <slug>.<root domain>
    theme: "classical" | "minimal" | "modern";
    isOn: boolean;
    showGallery: boolean;
    showLive: boolean;
  };
  galleryToken: string; // unguessable and unique
  uploadsOn: boolean;
  liveStream?: { youtubeUrl: string; isOn: boolean };
  whatsappMessage?: string;
  overallBudget?: number; // paise
  deletedAt?: Date; // soft delete, hard-deleted within 30 days (db-design §14)
  createdAt: Date;
  updatedAt: Date;
};

export type NewWedding = Omit<WeddingDoc, "_id" | "createdAt" | "updatedAt">;

let ready: Promise<Collection<WeddingDoc>> | undefined;

function weddings(): Promise<Collection<WeddingDoc>> {
  ready ??= (async () => {
    const col = (await getDb()).collection<WeddingDoc>("weddings");
    await col.createIndex({ "website.slug": 1 }, { unique: true });
    await col.createIndex({ galleryToken: 1 }, { unique: true });
    return col;
  })();
  ready.catch(() => {
    ready = undefined;
  });
  return ready;
}

// Throws the driver's duplicate-key error (code 11000) when the slug is already taken.
export async function insertWedding(
  wedding: NewWedding,
  options?: { session?: ClientSession },
): Promise<WeddingDoc> {
  const now = new Date();
  const doc: WeddingDoc = { _id: new ObjectId(), ...wedding, createdAt: now, updatedAt: now };
  await (await weddings()).insertOne(doc, options);
  return doc;
}

export async function findWeddingById(id: string): Promise<WeddingDoc | null> {
  if (!ObjectId.isValid(id)) return null;
  return (await weddings()).findOne({ _id: new ObjectId(id) });
}

export type WeddingDetails = Pick<
  WeddingDoc,
  "brideName" | "groomName" | "title" | "date" | "city" | "venue" | "description"
>;

// Updates the couple's details. Optional fields that are blank are removed rather than stored
// empty. The web address, gallery token and settings are deliberately not touched here. Returns
// false when no live wedding has this id (a soft-deleted one counts as gone).
export async function updateWeddingDetails(
  id: string,
  set: Partial<WeddingDetails>,
  unset: Array<"venue" | "description">,
): Promise<boolean> {
  if (!ObjectId.isValid(id)) return false;
  const result = await (
    await weddings()
  ).updateOne(
    { _id: new ObjectId(id), deletedAt: { $exists: false } },
    {
      $set: { ...set, updatedAt: new Date() },
      ...(unset.length > 0
        ? { $unset: Object.fromEntries(unset.map((field) => [field, ""])) }
        : {}),
    },
  );
  return result.matchedCount === 1;
}
