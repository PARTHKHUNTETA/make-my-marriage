import "server-only";
import { createHash, randomBytes } from "node:crypto";

const ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
const LENGTH = 22; // 62^22 > 2^128, so 128 bits always fit

// A 128-bit random token, base62-encoded to a fixed 22 characters (system-design §7). Used for
// credentials that live in URLs (guest invites, gallery links, entry QRs): unguessable, never
// sequential, and safe to put in a path. Converting the whole number avoids modulo bias.
export function generateToken(): string {
  let n = BigInt(`0x${randomBytes(16).toString("hex")}`);
  let out = "";
  while (n > 0n) {
    out = ALPHABET[Number(n % 62n)] + out;
    n /= 62n;
  }
  return out.padStart(LENGTH, "0");
}

// Tokens that unlock something (verify email, reset password, accept an invite) are stored as
// a SHA-256 hash and only the hash is looked up, so reading the database never yields a working
// link. A fast hash is right here: the input is 128 random bits, not a guessable password.
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
