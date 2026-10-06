"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ImagePlus } from "lucide-react";
import {
  makeCopies,
  putBlob,
  uploadPhotos,
  type FileOutcome,
  type Progress,
} from "@/lib/photo-upload";
import type { ConfirmResult, UploadSlot } from "@/modules/photos/schema";

const ACCEPT = "image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif";
const NAME_KEY = "mmm-guest-photo-name";

type Envelope<T> = { ok: true; data: T } | { ok: false; error: { message: string } };

async function post<T>(path: string, body: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error("No connection. Check your signal and try again.");
  }
  const json = (await res.json().catch(() => null)) as Envelope<T> | null;
  if (!json) throw new Error("Something went wrong. Please try again.");
  if (!json.ok) throw new Error(json.error.message);
  return json.data;
}

// The guest's "add your photos" box: an optional name, an album, and a file picker. Photos go
// straight to storage; the couple approves them before anyone else sees them.
export function GuestUploader({
  token,
  albums,
}: {
  token: string;
  albums: { id: string; name: string; isGeneral: boolean }[];
}) {
  const router = useRouter();
  const [name, setName] = React.useState("");
  const [album, setAlbum] = React.useState(
    albums.find((a) => a.isGeneral)?.id ?? albums[0]?.id ?? "",
  );
  const [progress, setProgress] = React.useState<Progress | null>(null);
  const [outcomes, setOutcomes] = React.useState<FileOutcome[] | null>(null);
  const input = React.useRef<HTMLInputElement>(null);
  const uploading = progress !== null && progress.done + progress.failed < progress.total;

  React.useEffect(() => {
    const id = setTimeout(() => {
      try {
        const saved = localStorage.getItem(NAME_KEY);
        if (saved) setName(saved);
      } catch {
        // Private browsing: the name just is not remembered.
      }
    }, 0);
    return () => clearTimeout(id);
  }, []);

  async function onChoose(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (files.length === 0 || !album) return;
    try {
      localStorage.setItem(NAME_KEY, name.trim());
    } catch {
      // Not remembered; fine.
    }
    setOutcomes(null);
    setProgress({ total: files.length, done: 0, failed: 0, sentBytes: 0, totalBytes: 0 });
    const result = await uploadPhotos(
      files,
      {
        requestSlots: (list) =>
          post<UploadSlot[]>(`/api/g/${token}/sign`, { albumId: album, files: list, name }),
        confirm: (photoIds) => post<ConfirmResult[]>(`/api/g/${token}/confirm`, { photoIds }),
        put: putBlob,
        copies: makeCopies,
      },
      setProgress,
    );
    setOutcomes(result);
    router.refresh();
  }

  const failed = outcomes?.filter((o) => !o.ok) ?? [];
  const sent = outcomes ? outcomes.length - failed.length : 0;
  return (
    <section className="rounded-2xl bg-white p-5 shadow-[0_1px_3px_rgba(35,31,32,0.04)]">
      <h2 className="font-serif text-xl text-plum">Share your photos</h2>
      <p className="mt-1 text-[13px] text-ink-2">
        Add the pictures you took. They appear here once the couple has approved them.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-xs font-semibold text-ink-2">
          Your name (optional)
          <input
            type="text"
            value={name}
            maxLength={60}
            autoComplete="name"
            onChange={(e) => setName(e.target.value)}
            disabled={uploading}
            placeholder="So the couple knows who sent them"
            className="rounded-lg border border-line bg-white px-3 py-2 text-sm font-normal text-ink"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-semibold text-ink-2">
          Album
          <select
            value={album}
            onChange={(e) => setAlbum(e.target.value)}
            disabled={uploading}
            className="rounded-lg border border-line bg-white px-3 py-2 text-sm font-normal text-ink"
          >
            {albums.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <button
        type="button"
        disabled={uploading || !album}
        onClick={() => input.current?.click()}
        className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-plum px-4 py-3 text-sm font-semibold text-white hover:bg-plum/90 disabled:opacity-60 sm:w-auto"
      >
        <ImagePlus className="size-4" aria-hidden /> Choose photos
      </button>
      <input
        ref={input}
        type="file"
        accept={ACCEPT}
        multiple
        className="sr-only"
        aria-label="Choose photos"
        onChange={onChoose}
      />
      <p className="mt-2 text-xs text-ink-2">JPEG, PNG, HEIC or WebP · up to 25 MB each</p>

      {progress && uploading ? (
        <div className="mt-4" role="status">
          <p className="text-[13px] text-ink">
            Sending {progress.done + progress.failed} of {progress.total}… please keep this page
            open.
          </p>
          <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-rose-100">
            <div
              className="h-full bg-forest transition-all"
              style={{ width: `${((progress.done + progress.failed) / progress.total) * 100}%` }}
            />
          </div>
        </div>
      ) : null}
      {outcomes ? (
        <div className="mt-4 text-[13px]" role="status">
          {sent > 0 ? (
            <p className="rounded-lg bg-forest/10 p-3 font-medium text-forest">
              Thank you! {sent} {sent === 1 ? "photo is" : "photos are"} with the couple. They will
              show up here once approved.
            </p>
          ) : null}
          {failed.length > 0 ? (
            <div className="mt-2 rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-destructive">
              <p className="font-semibold">
                {failed.length} {failed.length === 1 ? "photo" : "photos"} could not be sent:
              </p>
              <ul className="mt-1 list-disc pl-5">
                {failed.slice(0, 6).map((o, i) => (
                  <li key={`${o.name}-${i}`}>
                    {o.name} — {o.error}
                  </li>
                ))}
                {failed.length > 6 ? <li>and {failed.length - 6} more</li> : null}
              </ul>
              <p className="mt-1">Choose them again to retry.</p>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
