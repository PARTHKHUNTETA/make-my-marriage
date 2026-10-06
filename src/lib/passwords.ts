import "server-only";
import { hash, verify } from "@node-rs/argon2";

// Argon2id at the OWASP-recommended minimum (19 MiB, 2 passes, 1 lane). The algorithm is
// passed as its numeric value because the library's enum is a `const enum`, which cannot be
// imported under isolatedModules. 2 = Argon2id.
const OPTIONS = { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 } as const;

export function hashPassword(plain: string): Promise<string> {
  return hash(plain, OPTIONS);
}

// A malformed stored hash counts as a mismatch rather than an error.
export async function verifyPassword(storedHash: string, plain: string): Promise<boolean> {
  try {
    return await verify(storedHash, plain);
  } catch {
    return false;
  }
}

// Used when the email is unknown, so "no such account" costs the same time as "wrong
// password" and login timing does not reveal which accounts exist.
let dummyHash: Promise<string> | undefined;
export async function burnPasswordCheck(plain: string): Promise<void> {
  dummyHash ??= hashPassword("not-a-real-password");
  await verifyPassword(await dummyHash, plain);
}
