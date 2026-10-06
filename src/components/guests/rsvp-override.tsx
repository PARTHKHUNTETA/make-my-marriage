"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Select } from "@/components/ui/select";
import { overrideRsvpAction } from "@/modules/guests/actions";
import { RSVP_LABELS, RSVP_STATUSES, type RsvpStatus } from "@/modules/guests/schema";

// A member recording a reply on the guest's behalf. Works at any time, even after the event
// has started and the guest's own link is locked (PRD 5.6).
export function RsvpOverride({
  guestId,
  eventId,
  guestName,
  guestsAllowed,
  status,
  numberAttending,
}: {
  guestId: string;
  eventId: string;
  guestName: string;
  guestsAllowed: number;
  status: RsvpStatus;
  numberAttending?: number;
}) {
  const router = useRouter();
  const [value, setValue] = React.useState(status);
  const [count, setCount] = React.useState(numberAttending ?? guestsAllowed);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const changed = value !== status || (value === "attending" && count !== numberAttending);

  async function save() {
    setBusy(true);
    setError(null);
    const result = await overrideRsvpAction({
      guestId,
      eventId,
      status: value,
      numberAttending: value === "attending" ? count : undefined,
    });
    setBusy(false);
    if (result.ok) router.refresh();
    else setError(result.error.message);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select
        aria-label={`Reply for ${guestName}`}
        value={value}
        disabled={busy}
        onChange={(e) => setValue(e.target.value as RsvpStatus)}
        className="h-9 w-auto text-[13px]"
      >
        {RSVP_STATUSES.map((s) => (
          <option key={s} value={s}>
            {RSVP_LABELS[s]}
          </option>
        ))}
      </Select>
      {value === "attending" ? (
        <Select
          aria-label={`People attending for ${guestName}`}
          value={count}
          disabled={busy}
          onChange={(e) => setCount(Number(e.target.value))}
          className="h-9 w-auto text-[13px]"
        >
          {Array.from({ length: guestsAllowed }, (_, i) => i + 1).map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </Select>
      ) : null}
      {changed ? (
        <button
          type="button"
          disabled={busy}
          onClick={save}
          className="rounded-lg bg-bronze px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
        >
          {busy ? "Saving..." : "Save"}
        </button>
      ) : null}
      {error ? (
        <span role="alert" className="text-xs text-destructive">
          {error}
        </span>
      ) : null}
    </div>
  );
}
