import { afterAll, describe, expect, it } from "vitest";

// Opt-in (`npm run test:integration`): revoked sessions on the real database.
const enabled = process.env.INTEGRATION === "1" && Boolean(process.env.MONGODB_URI);

describe.skipIf(!enabled)("revoked sessions against MongoDB", () => {
  const ids = [`zz-${Date.now()}-a`, `zz-${Date.now()}-b`];
  afterAll(async () => {
    const { getDb } = await import("@/lib/db");
    await (await getDb()).collection("revokedSessions").deleteMany({ _id: { $in: ids as never } });
  });

  it("knows only the sessions that were signed out", async () => {
    const { revokeSession, isSessionRevoked } = await import("./revoked-sessions");
    expect(await isSessionRevoked(ids[0])).toBe(false);
    await revokeSession(ids[0]!, new Date(Date.now() + 86_400_000));
    await revokeSession(ids[0]!, new Date(Date.now() + 86_400_000)); // twice is fine
    expect(await isSessionRevoked(ids[0])).toBe(true);
    expect(await isSessionRevoked(ids[1])).toBe(false);
    expect(await isSessionRevoked(undefined)).toBe(false);
  });
});
