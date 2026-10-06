import "server-only";
import { MongoClient, type ClientSession, type Db } from "mongodb";
import { getEnv } from "@/lib/env";

// One MongoClient promise per server instance. In dev, hot reload re-evaluates this
// module, so the promise is parked on globalThis to avoid leaking connections.
const globalForMongo = globalThis as unknown as { _mmmMongoClient?: Promise<MongoClient> };

function getClient(): Promise<MongoClient> {
  if (!globalForMongo._mmmMongoClient) {
    const client = new MongoClient(getEnv().MONGODB_URI, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      // An optional field left undefined is omitted from the document. By default the driver
      // would store it as an explicit null, which is not the "string or absent" the schema means.
      ignoreUndefined: true,
    });
    const connecting = client.connect();
    // A failed connect must not stay cached, or every later call would fail too.
    connecting.catch(() => {
      globalForMongo._mmmMongoClient = undefined;
    });
    globalForMongo._mmmMongoClient = connecting;
  }
  return globalForMongo._mmmMongoClient;
}

// Raw database handle. Repositories only: ESLint blocks this import elsewhere,
// because repositories are what apply `weddingId` scoping.
export async function getDb(): Promise<Db> {
  const client = await getClient();
  return client.db(getEnv().MONGODB_DB);
}

// Liveness probe for /api/health. Safe to import anywhere: it exposes no data.
export async function pingDb(): Promise<{ latencyMs: number }> {
  const db = await getDb();
  const start = performance.now();
  await db.command({ ping: 1 });
  return { latencyMs: Math.round(performance.now() - start) };
}

// Runs `work` in a multi-document transaction (system-design §6). Atlas replica sets support
// them; use only where a partial write would corrupt state (creating a wedding with its admin,
// marking an installment paid, deleting an event). The driver retries transient failures; any
// error thrown by `work` aborts the transaction and is rethrown.
export async function inTransaction<T>(work: (session: ClientSession) => Promise<T>): Promise<T> {
  const session = (await getClient()).startSession();
  try {
    return await session.withTransaction(() => work(session));
  } finally {
    await session.endSession();
  }
}
