"use client";

import * as React from "react";
import { Dialog } from "radix-ui";
import { CalendarHeart, ImagePlus, Images, UploadCloud, X } from "lucide-react";
import { formatBytes } from "@/lib/bytes";
import { cn } from "@/lib/utils";
import { guessType } from "@/lib/photo-upload";
import { MAX_FILE_BYTES, type AlbumSummary } from "@/modules/photos/schema";

const ACCEPT = "image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif";
const PREVIEWS = 24;

type Picked = { key: string; file: File; problem?: string };

function check(file: File): string | undefined {
  if (!guessType(file)) return "Not a photo we can take (JPEG, PNG, HEIC or WebP)";
  if (file.size > MAX_FILE_BYTES) return "Bigger than 25 MB";
  return undefined;
}

// Adds files to the list, skipping any already in it (or twice in one drop).
function withFiles(list: Picked[], files: File[]): Picked[] {
  const seen = new Set(list.map((p) => p.key));
  const fresh: Picked[] = [];
  for (const file of files) {
    const key = `${file.name}-${file.size}-${file.lastModified}`;
    if (seen.has(key)) continue;
    seen.add(key);
    fresh.push({ key, file, problem: check(file) });
  }
  return [...list, ...fresh];
}

// "Add photos": choose which event the photos are from, drop or pick the files, look them over,
// then upload. The upload itself runs on the gallery page (with its progress bar) once the couple
// presses Upload, so the dialog closes straight away.
export function UploadDialog({
  open,
  onOpenChange,
  albums,
  initialAlbumId,
  initialFiles,
  onUpload,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  albums: AlbumSummary[];
  initialAlbumId: string;
  // Files dropped on the gallery page before the dialog opened.
  initialFiles: File[];
  onUpload: (files: File[], albumId: string) => void;
}) {
  // Starts fresh each time it opens: the gallery remounts it with a new key.
  const [albumId, setAlbumId] = React.useState(initialAlbumId);
  const [picked, setPicked] = React.useState<Picked[]>(() => withFiles([], initialFiles));
  const [dragging, setDragging] = React.useState(false);
  const input = React.useRef<HTMLInputElement>(null);

  const add = (files: File[]) => setPicked((list) => withFiles(list, files));
  const remove = (key: string) => setPicked((list) => list.filter((p) => p.key !== key));
  const clear = () => setPicked([]);

  const good = picked.filter((p) => !p.problem);
  const skipped = picked.length - good.length;
  const totalBytes = good.reduce((sum, p) => sum + p.file.size, 0);
  const album = albums.find((a) => a.id === albumId);
  const events = albums.filter((a) => !a.isGeneral);
  const general = albums.find((a) => a.isGeneral);

  function upload() {
    if (!album || good.length === 0) return;
    onUpload(
      good.map((p) => p.file),
      album.id,
    );
    onOpenChange(false);
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[60] bg-black/50 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <Dialog.Content className="fixed top-1/2 left-1/2 z-[61] flex max-h-[90vh] w-[calc(100%-2rem)] max-w-2xl -translate-x-1/2 -translate-y-1/2 flex-col rounded-xl bg-white shadow-xl data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95">
          <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4 sm:px-6">
            <div>
              <Dialog.Title className="font-serif text-xl text-ink">Add photos</Dialog.Title>
              <Dialog.Description className="mt-0.5 text-[13px] text-ink-2">
                Pick the event, then drop your photos in.
              </Dialog.Description>
            </div>
            <Dialog.Close
              aria-label="Close"
              className="rounded-lg p-1.5 text-ink-2 hover:bg-rose-100"
            >
              <X className="size-5" />
            </Dialog.Close>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 sm:px-6">
            <fieldset>
              <legend className="mb-2 text-sm font-semibold text-ink">
                Which event are these photos from?
              </legend>
              <div className="flex flex-wrap gap-2">
                {events.map((a) => (
                  <AlbumChip
                    key={a.id}
                    on={albumId === a.id}
                    onClick={() => setAlbumId(a.id)}
                    icon={<CalendarHeart className="size-4" aria-hidden />}
                  >
                    {a.name}
                  </AlbumChip>
                ))}
                {general ? (
                  <AlbumChip
                    on={albumId === general.id}
                    onClick={() => setAlbumId(general.id)}
                    icon={<Images className="size-4" aria-hidden />}
                  >
                    {events.length ? "Not from one event" : general.name}
                  </AlbumChip>
                ) : null}
              </div>
              {events.length === 0 ? (
                <p className="mt-2 text-xs text-ink-2">
                  Add your events and each one gets its own album here.
                </p>
              ) : null}
            </fieldset>

            <div
              onDragEnter={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = "copy";
              }}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragging(false);
              }}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                add(Array.from(e.dataTransfer.files));
              }}
              className={cn(
                "mt-5 flex flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 text-center transition-colors",
                picked.length ? "py-6" : "py-12",
                dragging ? "border-plum bg-plum/5" : "border-line bg-rose-50/50",
              )}
            >
              <UploadCloud
                className={cn("size-10", dragging ? "text-plum" : "text-bronze")}
                aria-hidden
              />
              <p className="mt-2 text-base font-semibold text-ink">
                {dragging ? "Let go to add them" : "Drop your photos here"}
              </p>
              <p className="mt-0.5 text-[13px] text-ink-2">
                or{" "}
                <button
                  type="button"
                  onClick={() => input.current?.click()}
                  className="font-semibold text-plum underline underline-offset-2"
                >
                  choose from your device
                </button>
              </p>
              <p className="mt-2 text-xs text-ink-2">JPEG, PNG, HEIC or WebP · up to 25 MB each</p>
              <input
                ref={input}
                type="file"
                accept={ACCEPT}
                multiple
                className="sr-only"
                aria-label="Choose photos"
                onChange={(e) => {
                  add(Array.from(e.target.files ?? []));
                  e.target.value = "";
                }}
              />
            </div>

            {picked.length ? (
              <div className="mt-4">
                <div className="mb-2 flex items-center justify-between text-[13px]">
                  <span className="font-semibold text-ink">
                    {good.length} {good.length === 1 ? "photo" : "photos"} ·{" "}
                    {formatBytes(totalBytes)}
                  </span>
                  <button
                    type="button"
                    onClick={clear}
                    className="font-semibold text-ink-2 hover:text-ink"
                  >
                    Clear all
                  </button>
                </div>
                <ul className="grid grid-cols-4 gap-2 sm:grid-cols-6">
                  {picked.slice(0, PREVIEWS).map((p) => (
                    <li
                      key={p.key}
                      className={cn(
                        "group relative aspect-square overflow-hidden rounded-lg bg-rose-100",
                        p.problem && "ring-2 ring-destructive",
                      )}
                      title={p.problem ? `${p.file.name}: ${p.problem}` : p.file.name}
                    >
                      <Thumb file={p.file} showable={!p.problem} />
                      <button
                        type="button"
                        onClick={() => remove(p.key)}
                        aria-label={`Don't add ${p.file.name}`}
                        className="absolute top-1 right-1 rounded-full bg-black/60 p-0.5 text-white sm:opacity-0 sm:group-hover:opacity-100"
                      >
                        <X className="size-3.5" />
                      </button>
                    </li>
                  ))}
                  {picked.length > PREVIEWS ? (
                    <li className="flex aspect-square items-center justify-center rounded-lg bg-rose-100 text-sm font-semibold text-ink-2">
                      +{picked.length - PREVIEWS}
                    </li>
                  ) : null}
                </ul>
                {skipped > 0 ? (
                  <p className="mt-2 text-xs font-medium text-destructive">
                    {skipped} {skipped === 1 ? "file" : "files"} will be left out:{" "}
                    {[...new Set(picked.flatMap((p) => (p.problem ? [p.problem] : [])))].join("; ")}
                    .
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="flex flex-col-reverse gap-2 border-t border-line px-5 py-4 sm:flex-row sm:items-center sm:justify-end sm:px-6">
            <Dialog.Close className="rounded-lg px-4 py-2 text-sm font-semibold text-ink-2 hover:bg-rose-100">
              Cancel
            </Dialog.Close>
            <button
              type="button"
              onClick={upload}
              disabled={!album || good.length === 0}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-plum px-4 py-2 text-sm font-semibold text-white hover:bg-plum/90 disabled:opacity-50"
            >
              <ImagePlus className="size-4" aria-hidden />
              {good.length
                ? `Upload ${good.length} ${good.length === 1 ? "photo" : "photos"}${album ? ` to ${album.name}` : ""}`
                : "Upload"}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function AlbumChip({
  on,
  onClick,
  icon,
  children,
}: {
  on: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[13px] font-semibold transition-colors",
        on
          ? "border-plum bg-plum text-white"
          : "border-line text-ink-2 hover:border-plum hover:text-ink",
      )}
    >
      {icon}
      {children}
    </button>
  );
}

// One chosen file: its picture, or its name for files a browser can't show (HEIC). The local
// address is released when the tile goes away.
function Thumb({ file, showable }: { file: File; showable: boolean }) {
  const viewable = showable && /^image\/(jpeg|png|webp)$/.test(file.type);
  const img = React.useRef<HTMLImageElement>(null);
  // Made and released together inside the effect, so a remount never leaves a released address.
  React.useEffect(() => {
    if (!viewable || !img.current) return;
    const url = URL.createObjectURL(file);
    img.current.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file, viewable]);
  return viewable ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img ref={img} alt={file.name} className="size-full object-cover" />
  ) : (
    <span className="flex size-full items-center justify-center p-1 text-center text-[10px] break-all text-ink-2">
      {file.name}
    </span>
  );
}
