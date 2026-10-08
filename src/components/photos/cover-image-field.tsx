"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ImagePlus, Trash2 } from "lucide-react";
import { makeCoverBlob, putBlob } from "@/lib/photo-upload";
import {
  confirmCoverAction,
  removeCoverAction,
  requestCoverUploadAction,
} from "@/modules/photos/actions";

type Target = { kind: "wedding" } | { kind: "event"; eventId: string };

const button =
  "inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-[13px] font-semibold transition-colors disabled:opacity-50";

// Choose, replace or remove a cover picture. The browser shrinks it to a web-sized JPEG first, so
// even a large phone photo uploads quickly.
export function CoverImageField({
  target,
  currentUrl,
  title = "Cover picture",
  hint,
}: {
  target: Target;
  currentUrl?: string;
  title?: string;
  hint?: string;
}) {
  const router = useRouter();
  const input = React.useRef<HTMLInputElement>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [done, setDone] = React.useState<string | null>(null);

  async function onChoose(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError(null);
    setDone(null);
    setBusy(true);
    try {
      const blob = await makeCoverBlob(file);
      if (!blob)
        throw new Error("We couldn't read that picture. Choose a JPEG, PNG or WebP photo.");
      const slot = await requestCoverUploadAction({ target, size: blob.size });
      if (!slot.ok) throw new Error(slot.error.message);
      await putBlob(slot.data.uploadUrl, blob, "image/jpeg");
      const saved = await confirmCoverAction({ target, coverId: slot.data.coverId });
      if (!saved.ok) throw new Error(saved.error.message);
      setDone("Saved.");
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "The picture could not be saved. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setError(null);
    setDone(null);
    setBusy(true);
    const r = await removeCoverAction({ target });
    setBusy(false);
    if (!r.ok) return setError(r.error.message);
    setDone("Removed.");
    router.refresh();
  }

  return (
    <section className="rounded-xl bg-white p-5 shadow-[0_1px_3px_rgba(35,31,32,0.04)] sm:p-6">
      <h2 className="font-serif text-xl text-ink">{title}</h2>
      {hint ? <p className="mt-1 text-[13px] text-ink-2">{hint}</p> : null}
      {currentUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={currentUrl}
          alt=""
          className="mt-3 aspect-[16/7] w-full rounded-lg object-cover"
        />
      ) : (
        <p className="mt-3 rounded-lg bg-rose-50 p-4 text-[13px] text-ink-2">No picture yet.</p>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => input.current?.click()}
          className={`${button} bg-plum text-white hover:bg-plum/90`}
        >
          <ImagePlus className="size-4" aria-hidden />{" "}
          {currentUrl ? "Replace picture" : "Choose a picture"}
        </button>
        {currentUrl ? (
          <button
            type="button"
            disabled={busy}
            onClick={remove}
            className={`${button} bg-white text-destructive ring-1 ring-line hover:bg-rose-200`}
          >
            <Trash2 className="size-4" aria-hidden /> Remove
          </button>
        ) : null}
        <input
          ref={input}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          aria-label={`Choose ${title.toLowerCase()}`}
          onChange={onChoose}
        />
        {busy ? (
          <span role="status" className="text-[13px] text-ink-2">
            Working…
          </span>
        ) : null}
        {done ? (
          <span role="status" className="text-[13px] font-medium text-forest">
            {done}
          </span>
        ) : null}
      </div>
      {error ? (
        <p role="alert" className="mt-2 text-[13px] font-medium text-destructive">
          {error}
        </p>
      ) : null}
    </section>
  );
}
