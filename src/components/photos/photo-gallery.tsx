"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Download, ImagePlus, Trash2, X } from "lucide-react";
import { formatBytes } from "@/lib/bytes";
import {
  makeCopies,
  putBlob,
  uploadPhotos,
  type FileOutcome,
  type Progress,
} from "@/lib/photo-upload";
import {
  confirmUploadsAction,
  deletePhotosAction,
  getDownloadAction,
  movePhotosAction,
  requestUploadsAction,
} from "@/modules/photos/actions";
import type { AlbumSummary, PhotoItem, Usage } from "@/modules/photos/schema";

const ACCEPT = "image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif";

type Props = {
  albums: AlbumSummary[];
  albumId: string | undefined;
  usage: Usage;
  items: PhotoItem[];
  page: number;
  pages: number;
  total: number;
};

const chip = (on: boolean) =>
  `rounded-full px-4 py-1.5 text-[13px] font-semibold transition-colors ${
    on ? "bg-bronze text-white" : "bg-white text-ink-2 hover:bg-rose-200"
  }`;
const button =
  "inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-[13px] font-semibold transition-colors disabled:opacity-50";

function href(albumId: string | undefined, page = 1) {
  const q = new URLSearchParams();
  if (albumId) q.set("album", albumId);
  if (page > 1) q.set("page", String(page));
  const s = q.toString();
  return s ? `/photos?${s}` : "/photos";
}

export function PhotoGallery({ albums, albumId, usage, items, page, pages, total }: Props) {
  const router = useRouter();
  const general = albums.find((a) => a.isGeneral);
  const inAlbum = albums.find((a) => a.id === albumId);
  const [target, setTarget] = React.useState(albumId ?? general?.id ?? "");
  const [progress, setProgress] = React.useState<Progress | null>(null);
  const [outcomes, setOutcomes] = React.useState<FileOutcome[] | null>(null);
  const [selecting, setSelecting] = React.useState(false);
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [moveTo, setMoveTo] = React.useState("");
  const [message, setMessage] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [open, setOpen] = React.useState<number | null>(null);
  const fileInput = React.useRef<HTMLInputElement>(null);
  const uploading = progress !== null && progress.done + progress.failed < progress.total;
  const used = usage.quotaBytes > 0 ? Math.min(100, (usage.usedBytes / usage.quotaBytes) * 100) : 0;

  async function onChoose(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (files.length === 0 || !target) return;
    setOutcomes(null);
    setMessage(null);
    setProgress({ total: files.length, done: 0, failed: 0, sentBytes: 0, totalBytes: 0 });
    const result = await uploadPhotos(
      files,
      {
        requestSlots: async (list) => {
          const r = await requestUploadsAction({ albumId: target, files: list });
          if (!r.ok) throw new Error(r.error.message);
          return r.data;
        },
        confirm: async (photoIds) => {
          const r = await confirmUploadsAction({ photoIds });
          if (!r.ok) throw new Error(r.error.message);
          return r.data.results;
        },
        put: putBlob,
        copies: makeCopies,
      },
      setProgress,
    );
    setOutcomes(result);
    router.refresh();
  }

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const stopSelecting = () => {
    setSelecting(false);
    setSelected(new Set());
    setConfirmDelete(false);
    setMoveTo("");
  };

  async function download(id: string) {
    const r = await getDownloadAction({ photoId: id });
    if (!r.ok) return setMessage(r.error.message);
    const a = document.createElement("a");
    a.href = r.data.url;
    a.download = r.data.fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  async function remove(ids: string[]) {
    setBusy(true);
    setMessage(null);
    const r = await deletePhotosAction({ photoIds: ids });
    setBusy(false);
    if (!r.ok) return setMessage(r.error.message);
    setOpen(null);
    stopSelecting();
    setMessage(`Deleted ${r.data.removed} ${r.data.removed === 1 ? "photo" : "photos"}.`);
    router.refresh();
  }

  async function move() {
    if (!moveTo || selected.size === 0) return;
    setBusy(true);
    const r = await movePhotosAction({ photoIds: [...selected], albumId: moveTo });
    setBusy(false);
    if (!r.ok) return setMessage(r.error.message);
    const name = albums.find((a) => a.id === moveTo)?.name ?? "the album";
    stopSelecting();
    setMessage(`Moved ${r.data.moved} ${r.data.moved === 1 ? "photo" : "photos"} to ${name}.`);
    router.refresh();
  }

  const failed = outcomes?.filter((o) => !o.ok) ?? [];
  const saved = outcomes ? outcomes.length - failed.length : 0;

  return (
    <div className="mt-5 flex flex-col gap-5">
      <section className="rounded-xl bg-white p-5 shadow-[0_1px_3px_rgba(35,31,32,0.04)]">
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-xs font-semibold text-ink-2">
            Add to album
            <select
              value={target}
              onChange={(e) => setTarget(e.target.value)}
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
          <button
            type="button"
            disabled={uploading || !target}
            onClick={() => fileInput.current?.click()}
            className={`${button} bg-plum text-white hover:bg-plum/90`}
          >
            <ImagePlus className="size-4" aria-hidden /> Add photos
          </button>
          <input
            ref={fileInput}
            type="file"
            accept={ACCEPT}
            multiple
            className="sr-only"
            aria-label="Choose photos"
            onChange={onChoose}
          />
          <p className="ml-auto text-xs text-ink-2">JPEG, PNG, HEIC or WebP · up to 25 MB each</p>
        </div>
        {progress && uploading ? (
          <div className="mt-4" role="status">
            <p className="text-[13px] text-ink">
              Uploading {progress.done + progress.failed} of {progress.total}…
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
            {saved > 0 ? (
              <p className="font-medium text-forest">
                Added {saved} {saved === 1 ? "photo" : "photos"}.
              </p>
            ) : null}
            {failed.length > 0 ? (
              <div className="mt-1 rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-destructive">
                <p className="font-semibold">
                  {failed.length} {failed.length === 1 ? "photo" : "photos"} could not be added:
                </p>
                <ul className="mt-1 list-disc pl-5">
                  {failed.slice(0, 8).map((o, i) => (
                    <li key={`${o.name}-${i}`}>
                      {o.name} — {o.error}
                    </li>
                  ))}
                  {failed.length > 8 ? <li>and {failed.length - 8} more</li> : null}
                </ul>
              </div>
            ) : null}
          </div>
        ) : null}
        <div className="mt-4">
          <div className="flex justify-between text-xs text-ink-2">
            <span>
              {formatBytes(usage.usedBytes)} of {formatBytes(usage.quotaBytes)} used
            </span>
            {used >= 90 ? <span className="font-semibold text-bronze">Nearly full</span> : null}
          </div>
          <div
            className="mt-1 h-1.5 overflow-hidden rounded-full bg-rose-100"
            role="progressbar"
            aria-label="Storage used"
            aria-valuenow={Math.round(used)}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div
              className={`h-full ${used >= 90 ? "bg-bronze" : "bg-plum"}`}
              style={{ width: `${used}%` }}
            />
          </div>
        </div>
      </section>

      <nav aria-label="Albums" className="flex flex-wrap gap-2">
        <Link
          href={href(undefined)}
          aria-current={!albumId ? "page" : undefined}
          className={chip(!albumId)}
        >
          All photos · {albums.reduce((n, a) => n + a.approvedCount, 0)}
        </Link>
        {albums.map((a) => (
          <Link
            key={a.id}
            href={href(a.id)}
            aria-current={a.id === albumId ? "page" : undefined}
            className={chip(a.id === albumId)}
          >
            {a.name} · {a.approvedCount}
          </Link>
        ))}
      </nav>

      <div className="flex min-h-9 flex-wrap items-center gap-2">
        {message ? (
          <p role="status" className="text-[13px] font-medium text-forest">
            {message}
          </p>
        ) : null}
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {items.length > 0 && !selecting ? (
            <button
              type="button"
              onClick={() => setSelecting(true)}
              className={`${button} bg-white text-ink hover:bg-rose-200`}
            >
              Select
            </button>
          ) : null}
          {selecting ? (
            <>
              <span className="text-[13px] text-ink-2">{selected.size} selected</span>
              <button
                type="button"
                onClick={() => setSelected(new Set(items.map((i) => i.id)))}
                className={`${button} bg-white text-ink hover:bg-rose-200`}
              >
                Select all on this page
              </button>
              <select
                aria-label="Move selected photos to"
                value={moveTo}
                onChange={(e) => setMoveTo(e.target.value)}
                className="rounded-lg border border-line bg-white px-3 py-2 text-[13px] text-ink"
              >
                <option value="">Move to…</option>
                {albums
                  .filter((a) => a.id !== albumId)
                  .map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
              </select>
              <button
                type="button"
                disabled={!moveTo || selected.size === 0 || busy}
                onClick={move}
                className={`${button} bg-white text-ink hover:bg-rose-200`}
              >
                Move
              </button>
              {confirmDelete ? (
                <>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => remove([...selected])}
                    className={`${button} bg-destructive text-white`}
                  >
                    Yes, delete {selected.size}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(false)}
                    className={`${button} bg-white text-ink`}
                  >
                    Keep them
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  disabled={selected.size === 0}
                  onClick={() => setConfirmDelete(true)}
                  className={`${button} bg-white text-destructive hover:bg-rose-200`}
                >
                  <Trash2 className="size-4" aria-hidden /> Delete
                </button>
              )}
              <button
                type="button"
                onClick={stopSelecting}
                className={`${button} bg-white text-ink-2 hover:bg-rose-200`}
              >
                Done
              </button>
            </>
          ) : null}
        </div>
      </div>
      {confirmDelete ? (
        <p role="alert" className="-mt-3 text-[13px] text-destructive">
          This permanently deletes {selected.size} {selected.size === 1 ? "photo" : "photos"} for
          everyone. It cannot be undone.
        </p>
      ) : null}

      {items.length === 0 ? (
        <div className="rounded-xl bg-white p-10 text-center shadow-[0_1px_3px_rgba(35,31,32,0.04)]">
          <p className="font-serif text-xl text-ink">
            {inAlbum ? `No photos in ${inAlbum.name} yet` : "No photos yet"}
          </p>
          <p className="mt-1 text-sm text-ink-2">Add the first ones with “Add photos” above.</p>
        </div>
      ) : (
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {items.map((p, index) => (
            <li
              key={p.id}
              className="relative aspect-square overflow-hidden rounded-lg bg-rose-100"
            >
              <button
                type="button"
                onClick={() => (selecting ? toggle(p.id) : setOpen(index))}
                aria-label={
                  selecting
                    ? `${selected.has(p.id) ? "Deselect" : "Select"} ${p.fileName}`
                    : `Open ${p.fileName}`
                }
                aria-pressed={selecting ? selected.has(p.id) : undefined}
                className="block size-full"
              >
                {p.thumbUrl && p.viewable ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={p.thumbUrl}
                    alt={p.fileName}
                    loading="lazy"
                    className="size-full object-cover"
                  />
                ) : (
                  <span className="flex size-full items-center justify-center p-2 text-center text-xs text-ink-2">
                    {p.fileName}
                    <br />
                    Download to view
                  </span>
                )}
              </button>
              {selecting ? (
                <span
                  aria-hidden
                  className={`pointer-events-none absolute top-2 left-2 flex size-6 items-center justify-center rounded-full border-2 text-xs font-bold ${
                    selected.has(p.id)
                      ? "border-plum bg-plum text-white"
                      : "border-white bg-black/20 text-transparent"
                  }`}
                >
                  ✓
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {pages > 1 ? (
        <nav aria-label="Pages" className="flex items-center justify-center gap-3 text-[13px]">
          {page > 1 ? (
            <Link
              href={href(albumId, page - 1)}
              className={`${button} bg-white text-ink hover:bg-rose-200`}
            >
              Newer
            </Link>
          ) : null}
          <span className="text-ink-2">
            Page {page} of {pages} · {total} photos
          </span>
          {page < pages ? (
            <Link
              href={href(albumId, page + 1)}
              className={`${button} bg-white text-ink hover:bg-rose-200`}
            >
              Older
            </Link>
          ) : null}
        </nav>
      ) : null}

      {open !== null && items[open] ? (
        <Lightbox
          items={items}
          index={open}
          onIndex={setOpen}
          onClose={() => setOpen(null)}
          onDownload={download}
          onDelete={(id) => remove([id])}
          busy={busy}
        />
      ) : null}
    </div>
  );
}

function Lightbox({
  items,
  index,
  onIndex,
  onClose,
  onDownload,
  onDelete,
  busy,
}: {
  items: PhotoItem[];
  index: number;
  onIndex: (i: number) => void;
  onClose: () => void;
  onDownload: (id: string) => void;
  onDelete: (id: string) => void;
  busy: boolean;
}) {
  const photo = items[index]!;
  const [sure, setSure] = React.useState(false);
  const prev = () => {
    setSure(false);
    onIndex((index + items.length - 1) % items.length);
  };
  const next = () => {
    setSure(false);
    onIndex((index + 1) % items.length);
  };
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft") prev();
      else if (e.key === "ArrowRight") next();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });
  const touchX = React.useRef<number | null>(null);
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={photo.fileName}
      className="fixed inset-0 z-50 flex flex-col bg-black/90"
      onTouchStart={(e) => {
        touchX.current = e.touches[0]?.clientX ?? null;
      }}
      onTouchEnd={(e) => {
        const start = touchX.current;
        const end = e.changedTouches[0]?.clientX;
        touchX.current = null;
        if (start === null || end === undefined || Math.abs(end - start) < 50) return;
        if (end < start) next();
        else prev();
      }}
    >
      <div className="flex items-center justify-between gap-2 p-3 text-white">
        <p className="min-w-0 truncate text-sm">
          {photo.fileName} · {photo.albumName}
          {photo.uploaderName ? ` · by ${photo.uploaderName}` : ""} · {formatBytes(photo.sizeBytes)}
        </p>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => onDownload(photo.id)}
            aria-label="Download original"
            className="rounded-lg p-2 hover:bg-white/10"
          >
            <Download className="size-5" />
          </button>
          {sure ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => onDelete(photo.id)}
              className="rounded-lg bg-destructive px-3 py-2 text-[13px] font-semibold"
            >
              Delete for good
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setSure(true)}
              aria-label="Delete photo"
              className="rounded-lg p-2 hover:bg-white/10"
            >
              <Trash2 className="size-5" />
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-2 hover:bg-white/10"
          >
            <X className="size-5" />
          </button>
        </div>
      </div>
      <div className="relative flex min-h-0 flex-1 items-center justify-center">
        {photo.viewable && photo.displayUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photo.displayUrl}
            alt={photo.fileName}
            className="max-h-full max-w-full object-contain"
          />
        ) : (
          <p className="text-white">This format can’t be shown here. Download it to view.</p>
        )}
        {items.length > 1 ? (
          <>
            <button
              type="button"
              onClick={prev}
              aria-label="Previous photo"
              className="absolute left-2 rounded-full bg-black/40 p-2 text-white hover:bg-black/60"
            >
              <ChevronLeft className="size-6" />
            </button>
            <button
              type="button"
              onClick={next}
              aria-label="Next photo"
              className="absolute right-2 rounded-full bg-black/40 p-2 text-white hover:bg-black/60"
            >
              <ChevronRight className="size-6" />
            </button>
          </>
        ) : null}
      </div>
      <p className="p-3 text-center text-xs text-white/70">
        {index + 1} of {items.length}
      </p>
    </div>
  );
}
