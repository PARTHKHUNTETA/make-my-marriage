import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, rm, stat, writeFile, open } from "node:fs/promises";
import path from "node:path";
import {
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getAuthEnv, getStorageEnv } from "@/lib/env";

// File storage for photos (system-design §8). Files go straight from the browser to storage on a
// short-lived signed address, so photo bytes never pass through our servers. Two drivers:
//   - Cloudflare R2 (S3 API) when all four R2_* settings exist: always the case in production.
//   - A folder on this computer, in development only, behind addresses signed with SESSION_SECRET.
// Keys look like `weddings/<weddingId>/photos/<photoId>/<original|display|thumb>`; nothing a user
// types ever becomes part of a key.

const KEY_PATTERN =
  /^(weddings\/[a-f0-9]{24}\/(photos\/[a-f0-9]{24}\/(original|display|thumb)|covers\/[a-f0-9]{24})|listings\/[a-f0-9]{24}\/[a-f0-9]{24})$/;
export const UPLOAD_URL_SECONDS = 15 * 60;
export const VIEW_URL_SECONDS = 60 * 60;

// Cover images are shown on public pages whose HTML may be cached for a while, so their addresses
// last nearly as long as storage allows (a week).
export const COVER_URL_SECONDS = 6 * 24 * 60 * 60;

export type PhotoVariant = "original" | "display" | "thumb";

export function photoKey(weddingId: string, photoId: string, variant: PhotoVariant): string {
  const key = `weddings/${weddingId}/photos/${photoId}/${variant}`;
  assertKey(key);
  return key;
}

// One cover picture (the wedding's, or an event's). Every upload gets a new id, so a replaced
// picture never shows from a stale cache.
export function coverKey(weddingId: string, coverId: string): string {
  const key = `weddings/${weddingId}/covers/${coverId}`;
  assertKey(key);
  return key;
}

// A photo on a marketplace listing. Vendors, not weddings, own these.
export function listingPhotoKey(listingId: string, photoId: string): string {
  const key = `listings/${listingId}/${photoId}`;
  assertKey(key);
  return key;
}

export function assertKey(key: string): void {
  if (!KEY_PATTERN.test(key)) throw new Error("Invalid storage key");
}

type R2 = { client: S3Client; bucket: string };
let r2: R2 | null | undefined;

function getR2(): R2 | null {
  if (r2 !== undefined) return r2;
  const s = getStorageEnv();
  if (s.R2_ACCOUNT_ID && s.R2_ACCESS_KEY_ID && s.R2_SECRET_ACCESS_KEY && s.R2_BUCKET) {
    r2 = {
      bucket: s.R2_BUCKET,
      client: new S3Client({
        region: "auto",
        endpoint: `https://${s.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
        credentials: { accessKeyId: s.R2_ACCESS_KEY_ID, secretAccessKey: s.R2_SECRET_ACCESS_KEY },
        // R2 does not take the optional checksum headers newer SDKs add by default.
        requestChecksumCalculation: "WHEN_REQUIRED",
        responseChecksumValidation: "WHEN_REQUIRED",
      }),
    };
  } else if (process.env.NODE_ENV === "production") {
    throw new Error("Photo storage is not configured: set the R2_* settings.");
  } else {
    r2 = null;
  }
  return r2;
}

// ---- the development folder driver ----------------------------------------------------------

const LOCAL_ROOT = path.join(process.cwd(), ".local-storage");

function localPath(key: string): string {
  assertKey(key);
  return path.join(LOCAL_ROOT, ...key.split("/"));
}

function sign(method: "PUT" | "GET", key: string, expires: number, extra: string): string {
  return createHmac("sha256", getAuthEnv().SESSION_SECRET)
    .update(`${method}\n${key}\n${expires}\n${extra}`)
    .digest("hex");
}

// Whether a development address is genuine and unexpired. Used by the dev route only.
export function verifyLocalSignature(
  method: "PUT" | "GET",
  key: string,
  expires: number,
  extra: string,
  signature: string,
): boolean {
  if (process.env.NODE_ENV === "production") return false;
  if (!Number.isFinite(expires) || expires < Date.now() / 1000) return false;
  try {
    assertKey(key);
  } catch {
    return false;
  }
  const expected = Buffer.from(sign(method, key, expires, extra), "hex");
  const given = Buffer.from(signature, "hex");
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export async function localWrite(key: string, bytes: Uint8Array): Promise<void> {
  const file = localPath(key);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, bytes);
}

export async function localRead(key: string): Promise<Buffer | null> {
  return readFile(localPath(key)).catch(() => null);
}

function localUrl(
  method: "PUT" | "GET",
  key: string,
  seconds: number,
  extra: { type?: string; download?: string },
): string {
  const expires = Math.floor(Date.now() / 1000) + seconds;
  const bound = method === "PUT" ? (extra.type ?? "") : (extra.download ?? "");
  const q = new URLSearchParams({ e: String(expires), s: sign(method, key, expires, bound) });
  if (method === "PUT" && extra.type) q.set("t", extra.type);
  if (method === "GET" && extra.download) q.set("d", extra.download);
  return `/api/dev-storage/${key}?${q}`;
}

// ---- the public functions -------------------------------------------------------------------

// An address the browser can PUT one file to, within UPLOAD_URL_SECONDS. The type is part of what
// is signed, so the file must be sent with exactly that Content-Type.
export async function signUpload(key: string, contentType: string): Promise<string> {
  assertKey(key);
  const store = getR2();
  if (!store) return localUrl("PUT", key, UPLOAD_URL_SECONDS, { type: contentType });
  return getSignedUrl(
    store.client,
    new PutObjectCommand({ Bucket: store.bucket, Key: key, ContentType: contentType }),
    { expiresIn: UPLOAD_URL_SECONDS, signableHeaders: new Set(["content-type"]) },
  );
}

// An address to show or download a file, within VIEW_URL_SECONDS. `download` makes the browser
// save it under that file name instead of showing it.
export async function signView(
  key: string,
  options: { download?: string; seconds?: number } = {},
): Promise<string> {
  assertKey(key);
  const seconds = options.seconds ?? VIEW_URL_SECONDS;
  const store = getR2();
  if (!store) return localUrl("GET", key, seconds, { download: options.download });
  return getSignedUrl(
    store.client,
    new GetObjectCommand({
      Bucket: store.bucket,
      Key: key,
      ...(options.download
        ? {
            ResponseContentDisposition: `attachment; filename="${options.download.replace(/"/g, "")}"`,
          }
        : {}),
    }),
    { expiresIn: seconds },
  );
}

// The size of a stored file in bytes, or null if there is none.
export async function objectSize(key: string): Promise<number | null> {
  assertKey(key);
  const store = getR2();
  if (!store)
    return stat(localPath(key)).then(
      (s) => s.size,
      () => null,
    );
  try {
    const head = await store.client.send(new HeadObjectCommand({ Bucket: store.bucket, Key: key }));
    return head.ContentLength ?? null;
  } catch {
    return null;
  }
}

// The first `length` bytes of a stored file, to check what it really is.
export async function readStart(key: string, length: number): Promise<Uint8Array | null> {
  assertKey(key);
  const store = getR2();
  if (!store) {
    const handle = await open(localPath(key), "r").catch(() => null);
    if (!handle) return null;
    try {
      const buffer = Buffer.alloc(length);
      const { bytesRead } = await handle.read(buffer, 0, length, 0);
      return buffer.subarray(0, bytesRead);
    } finally {
      await handle.close();
    }
  }
  try {
    const out = await store.client.send(
      new GetObjectCommand({ Bucket: store.bucket, Key: key, Range: `bytes=0-${length - 1}` }),
    );
    return (await out.Body?.transformToByteArray()) ?? null;
  } catch {
    return null;
  }
}

// Removes files. Missing files are fine, so it can safely be repeated.
export async function deleteObjects(keys: string[]): Promise<void> {
  if (keys.length === 0) return;
  keys.forEach(assertKey);
  const store = getR2();
  if (!store) {
    await Promise.all(keys.map((k) => rm(localPath(k), { force: true })));
    return;
  }
  for (let i = 0; i < keys.length; i += 1000) {
    await store.client.send(
      new DeleteObjectsCommand({
        Bucket: store.bucket,
        Delete: { Objects: keys.slice(i, i + 1000).map((Key) => ({ Key })), Quiet: true },
      }),
    );
  }
}
