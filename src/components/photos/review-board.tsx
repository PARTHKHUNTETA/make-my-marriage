"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, Trash2 } from "lucide-react";
import {
  approveFromUploaderAction,
  approvePhotosAction,
  rejectPhotosAction,
} from "@/modules/photos/actions";
import type { PendingGroup } from "@/modules/photos/service";

const button =
  "inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-[13px] font-semibold transition-colors disabled:opacity-50";

// Guest photos waiting for a decision, grouped by who sent them. Approving shows a photo to
// everyone with the gallery link; rejecting deletes it, files included.
export function ReviewBoard({
  groups,
  total,
  expiring,
  keepDays,
}: {
  groups: PendingGroup[];
  total: number;
  expiring: number;
  keepDays: number;
}) {
  const router = useRouter();
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [confirmReject, setConfirmReject] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [preview, setPreview] = React.useState<string | null>(null);

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  async function run(
    work: () => Promise<{ ok: true; data: unknown } | { ok: false; error: { message: string } }>,
    done: (data: never) => string,
  ) {
    setBusy(true);
    setError(null);
    setMessage(null);
    const r = await work();
    setBusy(false);
    if (!r.ok) return setError(r.error.message);
    setSelected(new Set());
    setConfirmReject(false);
    setMessage(done(r.data as never));
    router.refresh();
  }

  const ids = [...selected];
  const word = (n: number) => `${n} ${n === 1 ? "photo" : "photos"}`;

  if (total === 0 && groups.length === 0)
    return (
      <div className="mt-5 rounded-xl bg-white p-10 text-center shadow-[0_1px_3px_rgba(35,31,32,0.04)]">
        {message ? (
          <p role="status" className="mb-2 text-[13px] font-medium text-forest">
            {message}
          </p>
        ) : null}
        <p className="font-serif text-xl text-ink">Nothing to review</p>
        <p className="mt-1 text-sm text-ink-2">Photos your guests send will wait here for you.</p>
      </div>
    );

  return (
    <div className="mt-5 flex flex-col gap-5">
      {expiring > 0 ? (
        <p
          role="alert"
          className="rounded-xl border border-bronze/30 bg-bronze/10 p-4 text-[13px] text-ink"
        >
          {word(expiring)} {expiring === 1 ? "has" : "have"} been waiting a long time. Photos not
          reviewed within {keepDays} days are deleted automatically.
        </p>
      ) : null}
      <div className="flex min-h-9 flex-wrap items-center gap-2">
        {message ? (
          <p role="status" className="text-[13px] font-medium text-forest">
            {message}
          </p>
        ) : null}
        {error ? (
          <p role="alert" className="text-[13px] font-medium text-destructive">
            {error}
          </p>
        ) : null}
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <span className="text-[13px] text-ink-2">{selected.size} selected</span>
          <button
            type="button"
            disabled={busy || ids.length === 0}
            onClick={() =>
              run(
                () => approvePhotosAction({ photoIds: ids }),
                (d: { approved: number }) => `Approved ${word(d.approved)}.`,
              )
            }
            className={`${button} bg-forest text-white`}
          >
            <Check className="size-4" aria-hidden /> Approve selected
          </button>
          {confirmReject ? (
            <>
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  run(
                    () => rejectPhotosAction({ photoIds: ids }),
                    (d: { rejected: number }) => `Deleted ${word(d.rejected)}.`,
                  )
                }
                className={`${button} bg-destructive text-white`}
              >
                Yes, delete {ids.length}
              </button>
              <button
                type="button"
                onClick={() => setConfirmReject(false)}
                className={`${button} bg-white text-ink`}
              >
                Keep them
              </button>
            </>
          ) : (
            <button
              type="button"
              disabled={busy || ids.length === 0}
              onClick={() => setConfirmReject(true)}
              className={`${button} bg-white text-destructive hover:bg-rose-200`}
            >
              <Trash2 className="size-4" aria-hidden /> Reject selected
            </button>
          )}
        </div>
      </div>
      {confirmReject ? (
        <p role="alert" className="-mt-3 text-[13px] text-destructive">
          Rejected photos are deleted for good. This cannot be undone.
        </p>
      ) : null}
      {total > groups.reduce((n, g) => n + g.items.length, 0) ? (
        <p className="text-[13px] text-ink-2">
          Showing the oldest 300 of {total}. Review these, then come back for the rest.
        </p>
      ) : null}

      {groups.map((group) => (
        <section
          key={group.uploader ?? "anonymous"}
          className="rounded-xl bg-white p-4 shadow-[0_1px_3px_rgba(35,31,32,0.04)] sm:p-5"
        >
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-serif text-lg text-ink">
              {group.label}{" "}
              <span className="font-sans text-[13px] text-ink-2">· {word(group.items.length)}</span>
            </h2>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() =>
                  setSelected((prev) => new Set([...prev, ...group.items.map((i) => i.id)]))
                }
                className={`${button} bg-white text-ink-2 hover:bg-rose-200`}
              >
                Select these
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  run(
                    () => approveFromUploaderAction({ uploader: group.uploader }),
                    (d: { approved: number }) =>
                      `Approved ${word(d.approved)} from ${group.uploader ?? "guests with no name"}.`,
                  )
                }
                className={`${button} bg-forest/10 text-forest hover:bg-forest/20`}
              >
                Approve all from {group.uploader ?? "them"}
              </button>
            </div>
          </div>
          <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
            {group.items.map((p) => (
              <li
                key={p.id}
                className="relative aspect-square overflow-hidden rounded-lg bg-rose-100"
              >
                <button
                  type="button"
                  onClick={() => toggle(p.id)}
                  aria-pressed={selected.has(p.id)}
                  aria-label={`${selected.has(p.id) ? "Deselect" : "Select"} ${p.fileName}`}
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
                    <span className="flex size-full items-center justify-center p-1 text-center text-[11px] text-ink-2">
                      {p.fileName}
                    </span>
                  )}
                </button>
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
                {p.displayUrl && p.viewable ? (
                  <button
                    type="button"
                    onClick={() => setPreview(p.displayUrl ?? null)}
                    aria-label={`Look closer at ${p.fileName}`}
                    className="absolute right-1.5 bottom-1.5 rounded bg-black/55 px-1.5 py-0.5 text-[11px] font-semibold text-white"
                  >
                    View
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ))}

      {preview ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Photo preview"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
          onClick={() => setPreview(null)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt="Photo preview" className="max-h-full max-w-full object-contain" />
          <button
            type="button"
            onClick={() => setPreview(null)}
            className="absolute top-3 right-3 rounded-lg bg-white/15 px-3 py-2 text-sm font-semibold text-white"
          >
            Close
          </button>
        </div>
      ) : null}
    </div>
  );
}
