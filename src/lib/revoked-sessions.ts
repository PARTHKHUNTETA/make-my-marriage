import "server-only";
import type { Collection } from "mongodb";
import { getDb } from "@/lib/db";

// Signing out has to end the session, not just forget the cookie: a copied cookie would otherwise
// stay valid until the token expires, up to 30 days. Each signed-out token's id is kept here until
// the token would have expired anyway, and the TTL index then clears it.
type RevokedDoc = { _id: string; expiresAt: Date };

let ready: Promise<Collection<RevokedDoc>> | undefined;

function collection(): Promise<Collection<RevokedDoc>> {
  ready ??= (async () => {
    const col = (await getDb()).collection<RevokedDoc>("revokedSessions");
    await col.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
    return col;
  })();
  ready.catch(() => {
    ready = undefined;
  });
  return ready;
}

export async function revokeSession(id: string, expiresAt: Date): Promise<void> {
  await (await collection()).updateOne({ _id: id }, { $set: { expiresAt } }, { upsert: true });
}

export async function isSessionRevoked(id: string | undefined): Promise<boolean> {
  // A token without an id predates revocation; it can only be ended by a password reset.
  if (!id) return false;
  return (await (await collection()).countDocuments({ _id: id }, { limit: 1 })) > 0;
}
