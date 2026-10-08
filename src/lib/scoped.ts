import "server-only";
import {
  ObjectId,
  type AggregateOptions,
  type Collection,
  type CountDocumentsOptions,
  type DeleteOptions,
  type Document,
  type Filter,
  type FindOneAndDeleteOptions,
  type FindOneAndUpdateOptions,
  type FindOptions,
  type InsertOneOptions,
  type OptionalUnlessRequiredId,
  type UpdateFilter,
  type UpdateOptions,
} from "mongodb";

// The shared data-access layer behind "every query is scoped" (system-design §1, §6). A
// repository wraps its collection handle with scoped() and uses only the wrapper, so
// `weddingId` is added by this file and not by each caller:
//
//   - reads and deletes AND the caller's filter with { weddingId }, so a filter that names a
//     different wedding simply matches nothing;
//   - inserts stamp the weddingId themselves and cannot be given another one;
//   - updates cannot rewrite weddingId, and upserts create documents in this wedding only;
//   - aggregations start with a $match on the wedding and cannot reach other collections.
//
// There is deliberately no unscoped `find`. (weddingMembers is looked up by userId before a
// weddingId is known; that one read lives in its repository, with its reason spelled out.)
export type Scope = { weddingId: string };
type WeddingOwned = { weddingId: ObjectId };

// Stages that read or write documents outside the scoped collection. Allow one explicitly,
// with its own scoping, when a feature genuinely needs it.
const CROSS_COLLECTION_STAGES = ["$lookup", "$graphLookup", "$unionWith", "$merge", "$out"];

// Looks at the update's field NAMES, however deeply nested, never its values: a note or a guest's
// text that happens to contain the word "weddingId" is just text.
function mentionsWeddingId(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(mentionsWeddingId);
  if (
    value &&
    typeof value === "object" &&
    !(value instanceof Date) &&
    !(value instanceof ObjectId)
  ) {
    return Object.entries(value).some(
      ([key, inner]) =>
        key.split(".").includes("weddingId") ||
        // $rename names a field in its VALUE: { oldName: "weddingId" }
        (key === "$rename" && JSON.stringify(inner).includes("weddingId")) ||
        mentionsWeddingId(inner),
    );
  }
  return false;
}

function assertNoScopeWrite(update: unknown) {
  if (mentionsWeddingId(update)) throw new Error("scoped(): an update may not touch weddingId");
}

function assertSafePipeline(pipeline: Document[]) {
  for (const stage of pipeline) {
    const bad = Object.keys(stage).find((key) => CROSS_COLLECTION_STAGES.includes(key));
    if (bad) throw new Error(`scoped(): ${bad} is not allowed in a scoped aggregation`);
  }
}

export function scoped<T extends WeddingOwned>(collection: Collection<T>, scope: Scope) {
  if (!ObjectId.isValid(scope.weddingId)) throw new Error("scoped(): invalid weddingId");
  const weddingId = new ObjectId(scope.weddingId);
  const only = (filter: Filter<T> = {}): Filter<T> =>
    ({ $and: [filter, { weddingId }] }) as unknown as Filter<T>;

  // An upsert that inserts must create the document in this wedding.
  const withUpsertScope = (
    update: UpdateFilter<T>,
    options?: Pick<UpdateOptions, "upsert">,
  ): UpdateFilter<T> => {
    if (!options?.upsert) return update;
    if (Array.isArray(update)) throw new Error("scoped(): pipeline updates cannot upsert");
    return {
      ...update,
      $setOnInsert: { ...(update.$setOnInsert ?? {}), weddingId },
    } as unknown as UpdateFilter<T>;
  };

  return {
    weddingId,

    find: (filter?: Filter<T>, options?: FindOptions) => collection.find(only(filter), options),

    findOne: (filter?: Filter<T>, options?: FindOptions) =>
      collection.findOne(only(filter), options),

    countDocuments: (filter?: Filter<T>, options?: CountDocumentsOptions) =>
      collection.countDocuments(only(filter), options),

    insertOne: (doc: Omit<OptionalUnlessRequiredId<T>, "weddingId">, options?: InsertOneOptions) =>
      collection.insertOne(
        { ...doc, weddingId } as unknown as OptionalUnlessRequiredId<T>,
        options,
      ),

    updateOne: (filter: Filter<T>, update: UpdateFilter<T>, options?: UpdateOptions) => {
      assertNoScopeWrite(update);
      return collection.updateOne(only(filter), withUpsertScope(update, options), options);
    },

    updateMany: (filter: Filter<T>, update: UpdateFilter<T>, options?: UpdateOptions) => {
      assertNoScopeWrite(update);
      return collection.updateMany(only(filter), withUpsertScope(update, options), options);
    },

    // Atomic read-modify-write. With returnDocument set, resolves to the document or null.
    findOneAndUpdate: (
      filter: Filter<T>,
      update: UpdateFilter<T>,
      options?: FindOneAndUpdateOptions,
    ) => {
      assertNoScopeWrite(update);
      return collection.findOneAndUpdate(only(filter), withUpsertScope(update, options), {
        ...options,
        includeResultMetadata: false,
      });
    },

    findOneAndDelete: (filter: Filter<T>, options?: FindOneAndDeleteOptions) =>
      collection.findOneAndDelete(only(filter), { ...options, includeResultMetadata: false }),

    deleteOne: (filter: Filter<T>, options?: DeleteOptions) =>
      collection.deleteOne(only(filter), options),

    deleteMany: (filter: Filter<T>, options?: DeleteOptions) =>
      collection.deleteMany(only(filter), options),

    aggregate: <R extends Document = Document>(
      pipeline: Document[],
      options?: AggregateOptions,
    ) => {
      assertSafePipeline(pipeline);
      return collection.aggregate<R>([{ $match: { weddingId } }, ...pipeline], options);
    },
  };
}
