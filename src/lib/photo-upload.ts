// Browser-side photo upload, shared by the member gallery and the guest upload page. For each
// photo: make a 1600 px and a 400 px copy, ask the server for upload addresses, send the files
// straight to storage (retrying a dropped connection), then ask the server to confirm. The server
// checks everything again; this only makes the experience fast and forgiving.
import { normalizeImageType, type ImageType } from "@/lib/image-types";
import type { ConfirmResult, UploadSlot } from "@/modules/photos/schema";

export const DISPLAY_EDGE = 1600;
export const THUMB_EDGE = 400;
export const BATCH = 50;
const PARALLEL = 3;
const ATTEMPTS = 4;

const EXTENSION_TYPES: Record<string, ImageType> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  heic: "image/heic",
  heif: "image/heic",
};

// The type of a chosen file. Phones often leave it blank for HEIC, so the name is the fallback.
export function guessType(file: { name: string; type: string }): ImageType | null {
  return (
    normalizeImageType(file.type) ??
    EXTENSION_TYPES[file.name.split(".").pop()?.toLowerCase() ?? ""] ??
    null
  );
}

// A fresh key for one file; the same key on a retry is how the server knows it is the same photo.
export function newClientKey(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export type Copies = { display?: Blob; thumb?: Blob };

async function shrink(bitmap: ImageBitmap, edge: number, quality: number): Promise<Blob | null> {
  const scale = Math.min(1, edge / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) return null;
  context.drawImage(bitmap, 0, 0, width, height);
  return new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
}

// The quick-view copies. A browser that cannot read the format (HEIC on most computers) returns
// none, and the photo is stored as it is.
export async function makeCopies(file: Blob): Promise<Copies> {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    try {
      const [display, thumb] = await Promise.all([
        shrink(bitmap, DISPLAY_EDGE, 0.85),
        shrink(bitmap, THUMB_EDGE, 0.75),
      ]);
      return { ...(display ? { display } : {}), ...(thumb ? { thumb } : {}) };
    } finally {
      bitmap.close();
    }
  } catch {
    return {};
  }
}

export const COVER_EDGE = 1920;

// One JPEG, at most 1920 px on its longest side, for a cover picture. Null if this browser cannot
// read the file (HEIC on most computers).
export async function makeCoverBlob(file: Blob): Promise<Blob | null> {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    try {
      return await shrink(bitmap, COVER_EDGE, 0.88);
    } finally {
      bitmap.close();
    }
  } catch {
    return null;
  }
}

// PUTs one file, reporting progress. XHR rather than fetch, because only XHR reports upload progress.
export function putBlob(
  url: string,
  blob: Blob,
  contentType: string,
  onProgress?: (sent: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", contentType);
    xhr.upload.onprogress = (e) => onProgress?.(e.loaded);
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(new Error(`Upload failed (${xhr.status})`));
    xhr.onerror = () => reject(new Error("Network error"));
    xhr.ontimeout = () => reject(new Error("Timed out"));
    xhr.send(blob);
  });
}

export type Deps = {
  // Asks the server for slots. Rejects with the server's message (e.g. storage full).
  requestSlots: (files: SlotRequest[]) => Promise<UploadSlot[]>;
  confirm: (photoIds: string[]) => Promise<ConfirmResult[]>;
  put: typeof putBlob;
  copies: (file: Blob) => Promise<Copies>;
  wait?: (ms: number) => Promise<void>;
};

export type SlotRequest = {
  clientKey: string;
  name: string;
  type: ImageType;
  size: number;
  hasDisplay: boolean;
  hasThumb: boolean;
  displaySize?: number;
  thumbSize?: number;
};

export type FileOutcome = { name: string; ok: boolean; error?: string };

export type Progress = {
  total: number;
  done: number;
  failed: number;
  sentBytes: number;
  totalBytes: number;
};

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

async function withRetries<T>(
  work: () => Promise<T>,
  wait: (ms: number) => Promise<void>,
): Promise<T> {
  let last: unknown;
  for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
    try {
      return await work();
    } catch (err) {
      last = err;
      if (attempt < ATTEMPTS - 1) await wait(500 * 2 ** attempt);
    }
  }
  throw last;
}

// Uploads the chosen files. Never throws: each file ends as ok or failed with a reason, so one bad
// photo does not lose the rest. `onProgress` fires as files finish and as bytes go.
export async function uploadPhotos(
  chosen: File[],
  deps: Deps,
  onProgress: (p: Progress) => void,
): Promise<FileOutcome[]> {
  const wait = deps.wait ?? sleep;
  const outcomes: FileOutcome[] = [];
  const progress: Progress = {
    total: chosen.length,
    done: 0,
    failed: 0,
    sentBytes: 0,
    totalBytes: chosen.reduce((s, f) => s + f.size, 0),
  };
  const finish = (name: string, error?: string) => {
    outcomes.push({ name, ok: !error, ...(error ? { error } : {}) });
    if (error) progress.failed++;
    else progress.done++;
    onProgress({ ...progress });
  };

  const accepted: { file: File; type: ImageType }[] = [];
  for (const file of chosen) {
    const type = guessType(file);
    if (!type) finish(file.name, "Only JPEG, PNG, HEIC and WebP photos can be added");
    else if (file.size === 0) finish(file.name, "That file is empty");
    else if (file.size > 25 * 1024 * 1024) finish(file.name, "Each photo can be up to 25 MB");
    else accepted.push({ file, type });
  }

  for (let i = 0; i < accepted.length; i += BATCH) {
    const batch = accepted.slice(i, i + BATCH);
    const prepared = await Promise.all(
      batch.map(async ({ file, type }) => {
        const copies = await deps.copies(file);
        return { file, type, copies, clientKey: newClientKey() };
      }),
    );
    let slots: UploadSlot[];
    try {
      slots = await withRetries(
        () =>
          deps.requestSlots(
            prepared.map((p) => ({
              clientKey: p.clientKey,
              name: p.file.name,
              type: p.type,
              size: p.file.size,
              hasDisplay: Boolean(p.copies.display),
              hasThumb: Boolean(p.copies.thumb),
              ...(p.copies.display ? { displaySize: p.copies.display.size } : {}),
              ...(p.copies.thumb ? { thumbSize: p.copies.thumb.size } : {}),
            })),
          ),
        wait,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not start the upload";
      for (const p of prepared) finish(p.file.name, message);
      continue;
    }
    const slotByKey = new Map(slots.map((s) => [s.clientKey, s]));
    const toConfirm: { photoId: string; name: string }[] = [];
    let next = 0;
    const worker = async () => {
      while (next < prepared.length) {
        const item = prepared[next++]!;
        const slot = slotByKey.get(item.clientKey);
        if (!slot) {
          finish(item.file.name, "The server did not accept this photo");
          continue;
        }
        if (slot.state === "done") {
          finish(item.file.name);
          continue;
        }
        try {
          await withRetries(async () => {
            await deps.put(slot.originalUrl!, item.file, slot.contentType, () => undefined);
            if (slot.displayUrl && item.copies.display)
              await deps.put(slot.displayUrl, item.copies.display, "image/jpeg");
            if (slot.thumbUrl && item.copies.thumb)
              await deps.put(slot.thumbUrl, item.copies.thumb, "image/jpeg");
          }, wait);
          progress.sentBytes += item.file.size;
          toConfirm.push({ photoId: slot.photoId, name: item.file.name });
        } catch (err) {
          finish(item.file.name, err instanceof Error ? err.message : "The upload did not finish");
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(PARALLEL, prepared.length) }, worker));

    if (toConfirm.length > 0) {
      try {
        const results = await withRetries(
          () => deps.confirm(toConfirm.map((c) => c.photoId)),
          wait,
        );
        const byId = new Map(results.map((r) => [r.photoId, r]));
        for (const c of toConfirm) {
          const r = byId.get(c.photoId);
          finish(c.name, r?.ok ? undefined : (r?.error ?? "The photo could not be saved"));
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "The photos could not be saved";
        for (const c of toConfirm) finish(c.name, message);
      }
    }
  }
  return outcomes;
}
