"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight, Download, X } from "lucide-react";
import type { GuestPhoto } from "@/modules/photos/schema";

// The guest's photo grid with a full-screen viewer: swipe or arrow keys to move, a plain link to
// download the original. Kept small: guests open this on a phone, often on a slow connection.
export function GuestGrid({ token, items }: { token: string; items: GuestPhoto[] }) {
  const [open, setOpen] = React.useState<number | null>(null);
  const touchX = React.useRef<number | null>(null);
  const count = items.length;
  const go = React.useCallback(
    (delta: number) => setOpen((i) => (i === null ? i : (i + delta + count) % count)),
    [count],
  );
  React.useEffect(() => {
    if (open === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(null);
      else if (e.key === "ArrowLeft") go(-1);
      else if (e.key === "ArrowRight") go(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, go]);

  const photo = open === null ? null : items[open];
  return (
    <>
      <ul className="grid grid-cols-3 gap-1.5 sm:grid-cols-4 md:grid-cols-5">
        {items.map((p, i) => (
          <li key={p.id} className="aspect-square overflow-hidden rounded-md bg-rose-100">
            <button
              type="button"
              onClick={() => setOpen(i)}
              aria-label={`Open photo ${i + 1}`}
              className="block size-full"
            >
              {p.thumbUrl && p.viewable ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={p.thumbUrl}
                  alt={`${p.albumName} photo ${i + 1}`}
                  loading="lazy"
                  className="size-full object-cover"
                />
              ) : (
                <span className="flex size-full items-center justify-center p-1 text-center text-[11px] text-ink-2">
                  Download to view
                </span>
              )}
            </button>
          </li>
        ))}
      </ul>
      {photo ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Photo"
          className="fixed inset-0 z-50 flex flex-col bg-black/95"
          onTouchStart={(e) => {
            touchX.current = e.touches[0]?.clientX ?? null;
          }}
          onTouchEnd={(e) => {
            const start = touchX.current;
            const end = e.changedTouches[0]?.clientX;
            touchX.current = null;
            if (start === null || end === undefined || Math.abs(end - start) < 50) return;
            go(end < start ? 1 : -1);
          }}
        >
          <div className="flex items-center justify-between p-3 text-white">
            <p className="text-sm">
              {(open ?? 0) + 1} of {count}
            </p>
            <div className="flex items-center gap-1">
              <a
                href={`/api/g/${token}/download/${photo.id}`}
                aria-label="Download this photo"
                className="rounded-lg p-2 hover:bg-white/10"
              >
                <Download className="size-5" />
              </a>
              <button
                type="button"
                onClick={() => setOpen(null)}
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
                alt={`${photo.albumName} photo`}
                className="max-h-full max-w-full object-contain"
              />
            ) : (
              <p className="px-6 text-center text-white">
                This photo can’t be shown here. Download it to view.
              </p>
            )}
            {count > 1 ? (
              <>
                <button
                  type="button"
                  onClick={() => go(-1)}
                  aria-label="Previous photo"
                  className="absolute left-2 rounded-full bg-black/40 p-2 text-white hover:bg-black/60"
                >
                  <ChevronLeft className="size-6" />
                </button>
                <button
                  type="button"
                  onClick={() => go(1)}
                  aria-label="Next photo"
                  className="absolute right-2 rounded-full bg-black/40 p-2 text-white hover:bg-black/60"
                >
                  <ChevronRight className="size-6" />
                </button>
              </>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
