import "server-only";
import { MongoClient, type Db } from "mongodb";
import { getEnv } from "@/lib/env";

// One MongoClient promise per server instance. In dev, hot reload re-evaluates this
// module, so the promise is parked on globalThis to avoid leaking connections.
const globalForMongo = globalThis as unknown as { _mmmMongoClient?: Promise<MongoClient> };

function getClient(): Promise<MongoClient> {
  if (!globalForMongo._mmmMongoClient) {
    const client = new MongoClient(getEnv().MONGODB_URI, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
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
