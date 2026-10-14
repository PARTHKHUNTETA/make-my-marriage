import { ObjectId, type Db } from "mongodb";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

// Opt-in (`npm run test:integration`): the audit log on the real database.
const enabled = process.env.INTEGRATION === "1" && Boolean(process.env.MONGODB_URI);

describe.skipIf(!enabled)("audit log against MongoDB", () => {
  let audit: typeof import("./audit");
  let db: Db;
  const A = new ObjectId().toHexString();
  const B = new ObjectId().toHexString();
  const actor = new ObjectId().toHexString();
  const tag = `zz-audit-${Date.now()}`;

  beforeAll(async () => {
    audit = await import("./audit");
    db = await (await import("@/lib/db")).getDb();
  });
  afterAll(async () => {
    if (db) await db.collection("auditLogs").deleteMany({ target: new RegExp(`^${tag}`) });
  });

  it("keeps each wedding's entries to itself, and platform entries out of every wedding's", async () => {
    await audit.recordAudit({
      weddingId: A,
      actorUserId: actor,
      action: "member.invite",
      target: `${tag} a`,
      after: { roleIds: ["viewer"] },
    });
    await audit.recordAudit({
      weddingId: B,
      actorUserId: actor,
      action: "member.remove",
      target: `${tag} b`,
    });
    await audit.recordAudit({
      actorUserId: actor,
      action: "staff.roles",
      target: `${tag} staff`,
      before: { roles: [] },
      after: { roles: ["moderator"] },
    });

    const inA = await audit.listWeddingAudit(A);
    expect(inA.map((e) => e.target)).toEqual([`${tag} a`]);
    expect(inA[0]).toMatchObject({
      action: "member.invite",
      actorUserId: actor,
      after: { roleIds: ["viewer"] },
    });
    expect((await audit.listWeddingAudit(B)).map((e) => e.target)).toEqual([`${tag} b`]);

    const all = (await audit.listAllAudit()).map((e) => e.target);
    expect(all).toEqual(expect.arrayContaining([`${tag} a`, `${tag} b`, `${tag} staff`]));
  });

  it("newest first", async () => {
    await audit.recordAudit({
      weddingId: A,
      actorUserId: actor,
      action: "role.create",
      target: `${tag} later`,
    });
    expect((await audit.listWeddingAudit(A))[0]?.target).toBe(`${tag} later`);
  });

  it("never turns a failure to write into a failed action", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(
      audit.recordAudit({
        weddingId: "nonsense",
        actorUserId: "nonsense",
        action: "role.delete",
        target: `${tag} x`,
      }),
    ).resolves.toBeUndefined();
    expect(log).toHaveBeenCalled();
    log.mockRestore();
  });

  it("expires entries after two years", async () => {
    const ttl = (await db.collection("auditLogs").indexes()).find((i) => i.key.at === 1);
    expect(ttl?.expireAfterSeconds).toBe(2 * 365 * 24 * 60 * 60);
  });
});
