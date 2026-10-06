"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ImagePlus, Star, Trash2 } from "lucide-react";
import { makeCoverBlob, putBlob } from "@/lib/photo-upload";
import {
  confirmListingPhotoAction,
  makeListingPhotoFirstAction,
  removeListingPhotoAction,
  requestListingPhotoSlotsAction,
} from "@/modules/marketplace/actions";

const MAX = 20;
const button =
  "inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-[13px] font-semibold transition-colors disabled:opacity-50";

// A vendor's listing photos: up to 20, the first is the one couples see in search results. Each is
// shrunk to a web-sized JPEG in the browser and sent straight to storage.
export function ListingPhotos({ photos }: { photos: { id: string; url: string }[] }) {
  const router = useRouter();
  const input = React.useRef<HTMLInputElement>(null);
  const [busy, setBusy] = React.useState(false);
  const [progress, setProgress] = React.useState<string | null>(null);
  const [errors, setErrors] = React.useState<string[]>([]);
  const [message, setMessage] = React.useState<string | null>(null);

  async function onChoose(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (files.length === 0) return;
    setBusy(true);
    setErrors([]);
    setMessage(null);
    const problems: string[] = [];
    let added = 0;
    try {
      const wanted = files.slice(0, MAX - photos.length);
      if (files.length > wanted.length)
        problems.push(`Only ${wanted.length} more fit; the rest were skipped.`);
      const slots = await requestListingPhotoSlotsAction({ count: Math.max(1, wanted.length) });
      if (!slots.ok) throw new Error(slots.error.message);
      for (const [i, file] of wanted.entries()) {
        const slot = slots.data[i];
        if (!slot) break;
        setProgress(`Adding ${i + 1} of ${wanted.length}…`);
        try {
          const blob = await makeCoverBlob(file);
          if (!blob) throw new Error("couldn't be read. Use a JPEG, PNG or WebP photo.");
          await putBlob(slot.uploadUrl, blob, "image/jpeg");
          const done = await confirmListingPhotoAction({ photoId: slot.photoId });
          if (!done.ok) throw new Error(done.error.message);
          added++;
        } catch (err) {
          problems.push(
            `${file.name}: ${err instanceof Error ? err.message : "could not be added"}`,
          );
        }
      }
    } catch (err) {
      problems.push(err instanceof Error ? err.message : "Could not add the photos.");
    }
    setProgress(null);
    setBusy(false);
    setErrors(problems);
    if (added > 0)
      setMessage(
        `Added ${added} ${added === 1 ? "photo" : "photos"}. Your listing goes back to the team for a quick review.`,
      );
    router.refresh();
  }

  async function run(
    work: () => Promise<{ ok: boolean; error?: { message: string } }>,
    done: string,
  ) {
    setBusy(true);
    setErrors([]);
    setMessage(null);
    const r = await work();
    setBusy(false);
    if (!r.ok) return setErrors([r.error?.message ?? "Something went wrong."]);
    setMessage(done);
    router.refresh();
  }

  return (
    <section className="mt-6 rounded-xl bg-white p-5 shadow-[0_1px_3px_rgba(35,31,32,0.04)] sm:p-6">
      <h2 className="font-serif text-xl text-ink">Photos</h2>
      <p className="mt-1 text-[13px] text-ink-2">
        Up to {MAX} photos of your work. The first one is the picture couples see when they browse.
        Adding photos sends your listing for a quick review.
      </p>
      {photos.length === 0 ? (
        <p className="mt-3 rounded-lg bg-rose-50 p-4 text-[13px] text-ink-2">No photos yet.</p>
      ) : (
        <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {photos.map((p, i) => (
            <li key={p.id} className="overflow-hidden rounded-lg bg-rose-50">
              <div className="relative aspect-[4/3]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={p.url}
                  alt={`Listing photo ${i + 1}`}
                  loading="lazy"
                  className="size-full object-cover"
                />
                {i === 0 ? (
                  <span className="absolute top-1.5 left-1.5 rounded bg-plum px-1.5 py-0.5 text-[11px] font-semibold text-white">
                    Cover
                  </span>
                ) : null}
              </div>
              <div className="flex items-center justify-between gap-1 p-1.5">
                {i === 0 ? (
                  <span className="px-1 text-[11px] text-ink-2">Shown first</span>
                ) : (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      run(
                        () => makeListingPhotoFirstAction({ photoId: p.id }),
                        "Cover photo changed.",
                      )
                    }
                    className="inline-flex items-center gap-1 rounded px-1.5 py-1 text-[11px] font-semibold text-bronze hover:bg-white"
                  >
                    <Star className="size-3.5" aria-hidden /> Make cover
                  </button>
                )}
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    run(() => removeListingPhotoAction({ photoId: p.id }), "Photo removed.")
                  }
                  aria-label={`Remove photo ${i + 1}`}
                  className="rounded p-1.5 text-destructive hover:bg-white"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={busy || photos.length >= MAX}
          onClick={() => input.current?.click()}
          className={`${button} bg-plum text-white hover:bg-plum/90`}
        >
          <ImagePlus className="size-4" aria-hidden /> Add photos
        </button>
        <span className="text-xs text-ink-2">
          {photos.length} of {MAX} · JPEG, PNG or WebP
        </span>
        <input
          ref={input}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          className="sr-only"
          aria-label="Choose listing photos"
          onChange={onChoose}
        />
      </div>
      {progress ? (
        <p role="status" className="mt-3 text-[13px] text-ink">
          {progress}
        </p>
      ) : null}
      {message ? (
        <p role="status" className="mt-3 text-[13px] font-medium text-forest">
          {message}
        </p>
      ) : null}
      {errors.length > 0 ? (
        <ul role="alert" className="mt-3 list-disc pl-5 text-[13px] text-destructive">
          {errors.map((e, i) => (
            <li key={i}>{e}</li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
