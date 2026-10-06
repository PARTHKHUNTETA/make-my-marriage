"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Copy, Download, Printer } from "lucide-react";
import { resetGalleryLinkAction, setUploadsAction } from "@/modules/photos/actions";

const button =
  "inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-[13px] font-semibold transition-colors disabled:opacity-50";
const card = "rounded-xl bg-white p-5 shadow-[0_1px_3px_rgba(35,31,32,0.04)] sm:p-6";

export function SharePanel({
  link,
  qr,
  uploadsOn,
  isAdmin,
}: {
  link: string;
  qr: string;
  uploadsOn: boolean;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [on, setOn] = React.useState(uploadsOn);
  const [busy, setBusy] = React.useState(false);
  const [copied, setCopied] = React.useState(false);
  const [sure, setSure] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  async function toggle() {
    setBusy(true);
    setError(null);
    const next = !on;
    const r = await setUploadsAction({ on: next });
    setBusy(false);
    if (!r.ok) return setError(r.error.message);
    setOn(next);
    setMessage(
      next ? "Guests can add photos now." : "Guest uploads are off. Guests can still look.",
    );
    router.refresh();
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Couldn't copy. Select the link and copy it yourself.");
    }
  }

  async function reset() {
    setBusy(true);
    setError(null);
    const r = await resetGalleryLinkAction();
    setBusy(false);
    setSure(false);
    if (!r.ok) return setError(r.error.message);
    setMessage("New link made. The old link and any printed QR no longer work.");
    router.refresh();
  }

  return (
    <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,320px)_1fr]">
      <section className={`${card} flex flex-col items-center text-center`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={qr} alt="QR code for your wedding photo gallery" className="size-64 max-w-full" />
        <p className="mt-2 text-xs text-ink-2">Guests scan this to see and add photos.</p>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <a
            href="/api/photos/qr?format=png"
            download
            className={`${button} bg-plum text-white hover:bg-plum/90`}
          >
            <Download className="size-4" aria-hidden /> PNG
          </a>
          <a
            href="/api/photos/qr?format=svg"
            download
            className={`${button} bg-white text-ink ring-1 ring-line hover:bg-rose-200`}
          >
            <Download className="size-4" aria-hidden /> SVG
          </a>
        </div>
      </section>

      <div className="flex flex-col gap-5">
        <section className={card}>
          <h2 className="font-serif text-xl text-ink">Guest uploads</h2>
          <label className="mt-3 flex items-start gap-3 text-sm text-ink">
            <input
              type="checkbox"
              checked={on}
              disabled={busy}
              onChange={toggle}
              className="mt-0.5 size-4 accent-plum"
            />
            <span>
              <strong>{on ? "Guests can add photos" : "Guest uploads are off"}</strong>
              <span className="block text-xs text-ink-2">
                Switch off when the celebrations are over. Guests can still look at the approved
                photos. Every photo they send waits for your approval.
              </span>
            </span>
          </label>
          {message ? (
            <p role="status" className="mt-3 text-[13px] font-medium text-forest">
              {message}
            </p>
          ) : null}
          {error ? (
            <p role="alert" className="mt-3 text-[13px] font-medium text-destructive">
              {error}
            </p>
          ) : null}
        </section>

        <section className={card}>
          <h2 className="font-serif text-xl text-ink">Your link</h2>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <input
              readOnly
              value={link}
              aria-label="Gallery link"
              onFocus={(e) => e.currentTarget.select()}
              className="min-w-0 flex-1 rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink"
            />
            <button
              type="button"
              onClick={copy}
              className={`${button} bg-white text-ink ring-1 ring-line hover:bg-rose-200`}
            >
              <Copy className="size-4" aria-hidden /> {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <p className="mt-2 text-xs text-ink-2">
            Anyone with this link can see your approved photos, so share it only with people you
            want to have them.
          </p>
        </section>

        <section className={card}>
          <h2 className="font-serif text-xl text-ink">Print a poster</h2>
          <p className="mt-1 text-[13px] text-ink-2">
            A ready-to-print sign for the venue: “Share your wedding photos — scan to upload.”
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <a
              href="/photos/share/poster?size=a4"
              target="_blank"
              rel="noopener noreferrer"
              className={`${button} bg-bronze text-white hover:bg-bronze/90`}
            >
              <Printer className="size-4" aria-hidden /> A4 poster
            </a>
            <a
              href="/photos/share/poster?size=a5"
              target="_blank"
              rel="noopener noreferrer"
              className={`${button} bg-white text-ink ring-1 ring-line hover:bg-rose-200`}
            >
              <Printer className="size-4" aria-hidden /> A5 table card
            </a>
          </div>
          {!on ? (
            <p className="mt-3 text-xs text-bronze">
              Uploads are off, so a scanned poster would only let guests look. Switch them on before
              the event.
            </p>
          ) : null}
        </section>

        {isAdmin ? (
          <section className={card}>
            <h2 className="font-serif text-xl text-ink">Make a new link</h2>
            <p className="mt-1 text-[13px] text-ink-2">
              Only if the link got somewhere it should not. The old link, and every QR already
              printed from it, stops working straight away, so you would need to print new ones.
            </p>
            {sure ? (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={reset}
                  className={`${button} bg-destructive text-white`}
                >
                  Yes, replace the link
                </button>
                <button
                  type="button"
                  onClick={() => setSure(false)}
                  className={`${button} bg-white text-ink ring-1 ring-line`}
                >
                  Keep it
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setSure(true)}
                className={`${button} mt-3 bg-white text-destructive ring-1 ring-line hover:bg-rose-200`}
              >
                Replace link…
              </button>
            )}
          </section>
        ) : null}
      </div>
    </div>
  );
}
