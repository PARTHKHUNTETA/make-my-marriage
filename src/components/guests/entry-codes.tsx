"use client";

import * as React from "react";
import { Download, QrCode } from "lucide-react";

type Code = { eventId: string; eventName: string; people: number };

// Each event this party is coming to, with a "Show entry QR" button. The picture is only fetched when
// it is asked for, and it is the same code the guest has on their own page.
export function EntryCodes({ guestId, codes }: { guestId: string; codes: Code[] }) {
  const [open, setOpen] = React.useState<string | null>(null);
  return (
    <section className="rounded-xl bg-white p-5 shadow-[0_1px_3px_rgba(35,31,32,0.04)] sm:p-6">
      <h2 className="font-serif text-xl text-ink">Entry codes</h2>
      <p className="mt-1 text-[13px] text-ink-2">
        Each event this party is coming to has one code. Scan it at the gate in Check-in, or show it
        here if a guest has lost theirs.
      </p>
      {codes.length === 0 ? (
        <p className="mt-3 rounded-lg bg-rose-50 p-4 text-[13px] text-ink-2">
          No codes yet. A party gets one for each event once it has replied that it is coming.
        </p>
      ) : (
        <ul className="mt-3 flex flex-col gap-3">
          {codes.map((c) => {
            const shown = open === c.eventId;
            const src = `/api/guests/${guestId}/entry/${c.eventId}`;
            return (
              <li key={c.eventId} className="rounded-lg border border-line p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-ink">{c.eventName}</p>
                    <p className="text-xs text-ink-2">
                      {c.people} {c.people === 1 ? "person" : "people"} coming
                    </p>
                  </div>
                  <button
                    type="button"
                    aria-expanded={shown}
                    onClick={() => setOpen(shown ? null : c.eventId)}
                    className="inline-flex h-10 items-center gap-2 rounded-lg bg-white px-4 text-[13px] font-semibold text-ink ring-1 ring-line hover:bg-rose-100"
                  >
                    <QrCode className="size-4" aria-hidden /> {shown ? "Hide" : "Show entry QR"}
                  </button>
                </div>
                {shown ? (
                  <div className="mt-3 flex flex-col items-center gap-3 rounded-lg bg-white p-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={src}
                      alt={`Entry QR for ${c.eventName}`}
                      width={256}
                      height={256}
                      className="size-64 max-w-full"
                    />
                    <a
                      href={`${src}?download=1`}
                      download
                      className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-bronze hover:underline"
                    >
                      <Download className="size-4" aria-hidden /> Download PNG
                    </a>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
