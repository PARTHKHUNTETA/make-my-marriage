import { Zip, ZipPassThrough } from "fflate";

// Builds a ZIP in the browser from files fetched one at a time, so memory holds the finished ZIP
// and one photo, not every photo twice. Photos are already compressed, so they are stored as they
// are ("pass-through"), which is also faster.

// Two photos called IMG_1.jpg must not overwrite each other inside the ZIP.
export function uniqueNames(names: string[]): string[] {
  const seen = new Map<string, number>();
  return names.map((name) => {
    const key = name.toLowerCase();
    const n = seen.get(key) ?? 0;
    seen.set(key, n + 1);
    if (n === 0) return name;
    const dot = name.lastIndexOf(".");
    return dot > 0 ? `${name.slice(0, dot)} (${n + 1})${name.slice(dot)}` : `${name} (${n + 1})`;
  });
}

export type ZipSource = { fileName: string; url: string };

export async function buildZip(
  entries: ZipSource[],
  fetchBytes: (url: string) => Promise<Uint8Array>,
  onProgress?: (done: number, total: number) => void,
): Promise<Uint8Array> {
  const names = uniqueNames(entries.map((e) => e.fileName));
  const chunks: Uint8Array[] = [];
  let failure: Error | null = null;
  const zip = new Zip((err, chunk) => {
    if (err) failure = err;
    else chunks.push(chunk);
  });
  for (const [i, entry] of entries.entries()) {
    const file = new ZipPassThrough(names[i]!);
    zip.add(file);
    file.push(await fetchBytes(entry.url), true);
    onProgress?.(i + 1, entries.length);
  }
  zip.end();
  if (failure) throw failure;
  const size = chunks.reduce((n, c) => n + c.length, 0);
  const out = new Uint8Array(size);
  let at = 0;
  for (const c of chunks) {
    out.set(c, at);
    at += c.length;
  }
  return out;
}

// Fetches one file, retrying a dropped connection a couple of times.
export async function fetchBytes(url: string): Promise<Uint8Array> {
  let last: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Could not fetch a photo (${res.status})`);
      return new Uint8Array(await res.arrayBuffer());
    } catch (err) {
      last = err;
      await new Promise((r) => setTimeout(r, 400 * 2 ** attempt));
    }
  }
  throw last instanceof Error ? last : new Error("Could not fetch a photo");
}

// Hands the finished ZIP to the browser as a download.
export function saveZip(bytes: Uint8Array, fileName: string): void {
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: "application/zip" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
