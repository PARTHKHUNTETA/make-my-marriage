"use client";

import * as React from "react";
import { CalendarDays, Clock, MapPin, Shirt } from "lucide-react";
import { formatLongDate } from "@/lib/dates";
import { formatTime } from "@/lib/time";
import type { InvitationEventView } from "@/modules/invitations/schema";

type Reply = "attending" | "not_attending";

// One card per event the guest is invited to. Plain wording and big tap targets: this is opened
// from WhatsApp on a phone by relatives who have never seen the app (PRD 6).
export function EventReply({
  token,
  event,
  guestsAllowed,
}: {
  token: string;
  event: InvitationEventView;
  guestsAllowed: number;
}) {
  const [saved, setSaved] = React.useState(event.status !== "pending" ? event : null);
  const [choice, setChoice] = React.useState<Reply | null>(
    event.status === "pending" ? null : event.status,
  );
  const [count, setCount] = React.useState(event.numberAttending ?? guestsAllowed);
  const [busy, setBusy] = React.useState(false);
  const [message, setMessage] = React.useState<{ ok: boolean; text: string } | null>(null);

  async function save() {
    if (!choice) return;
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/i/${encodeURIComponent(token)}/rsvp`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          eventId: event.eventId,
          status: choice,
          numberAttending: choice === "attending" ? count : undefined,
        }),
      });
      const body = (await response.json()) as
        { ok: true } | { ok: false; error: { message: string } };
      if (body.ok) {
        setSaved({
          ...event,
          status: choice,
          numberAttending: choice === "attending" ? count : undefined,
        });
        setMessage({
          ok: true,
          text:
            choice === "attending"
              ? "Thank you! We can't wait to see you. You can change your reply here until the event starts."
              : "Thank you for letting us know. You can change your reply here until the event starts.",
        });
      } else setMessage({ ok: false, text: body.error.message });
    } catch {
      setMessage({
        ok: false,
        text: "We couldn't reach the server. Please check your connection and try again.",
      });
    }
    setBusy(false);
  }

  const option = (value: Reply, label: string) => (
    <label
      className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-[15px] ${
        choice === value ? "border-plum bg-plum/5 font-semibold" : "border-line bg-white"
      }`}
    >
      <input
        type="radio"
        name={`reply-${event.eventId}`}
        value={value}
        checked={choice === value}
        onChange={() => setChoice(value)}
        className="size-5 accent-plum"
      />
      {label}
    </label>
  );

  return (
    <section className="rounded-2xl bg-white p-5 shadow-[0_1px_3px_rgba(35,31,32,0.06)]">
      <h2 className="font-serif text-2xl text-plum">{event.name}</h2>
      <ul className="mt-3 flex flex-col gap-1.5 text-[15px] text-ink-2">
        <li className="flex items-start gap-2">
          <CalendarDays className="mt-0.5 size-4 shrink-0" aria-hidden />
          {formatLongDate(event.date)}
        </li>
        <li className="flex items-start gap-2">
          <Clock className="mt-0.5 size-4 shrink-0" aria-hidden />
          {formatTime(event.startTime)}
          {event.endTime ? ` – ${formatTime(event.endTime)}` : ""}
        </li>
        <li className="flex items-start gap-2">
          <MapPin className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>
            {event.venueName ?? "Venue to be announced"}
            {event.address ? <span className="block">{event.address}</span> : null}
          </span>
        </li>
        {event.dressCode ? (
          <li className="flex items-start gap-2">
            <Shirt className="mt-0.5 size-4 shrink-0" aria-hidden />
            {event.dressCode}
          </li>
        ) : null}
      </ul>
      {event.description ? <p className="mt-3 text-[15px] text-ink">{event.description}</p> : null}
      {saved?.status === "attending" ? (
        <div className="mt-4 flex flex-col items-center gap-2 rounded-xl border border-line p-4 text-center">
          {/* A small generated picture of the guest's entry code; the next/image optimiser adds nothing here. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/api/i/${encodeURIComponent(token)}/entry/${event.eventId}`}
            alt={`Your entry code for ${event.name}`}
            width={192}
            height={192}
            className="size-48"
          />
          <p className="text-[13px] text-ink-2">Show this code at the entrance to {event.name}.</p>
        </div>
      ) : null}
      {event.tableLabel && saved?.status === "attending" ? (
        <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-[15px] font-semibold text-plum">
          {event.tableLabel}
        </p>
      ) : null}

      <div className="mt-5 border-t border-line pt-4">
        {event.locked ? (
          <p className="text-[15px] text-ink">
            {saved?.status === "attending"
              ? `You replied: attending${saved.numberAttending ? ` (${saved.numberAttending})` : ""}.`
              : saved?.status === "not_attending"
                ? "You replied: not attending."
                : "Replies for this event are now closed."}{" "}
            <span className="text-ink-2">
              Replies close when the event starts. Please contact the couple to change it.
            </span>
          </p>
        ) : (
          <fieldset disabled={busy} className="flex flex-col gap-3">
            <legend className="mb-2 text-[15px] font-semibold text-ink">Will you be there?</legend>
            {option("attending", "Yes, I'll be there")}
            {option("not_attending", "Sorry, I can't make it")}
            {choice === "attending" && guestsAllowed > 1 ? (
              <label className="flex flex-col gap-1 text-[15px] text-ink">
                How many people are coming?
                <select
                  value={count}
                  onChange={(e) => setCount(Number(e.target.value))}
                  className="h-12 rounded-xl border border-line bg-white px-3 text-[15px]"
                >
                  {Array.from({ length: guestsAllowed }, (_, i) => i + 1).map((n) => (
                    <option key={n} value={n}>
                      {n} {n === 1 ? "person" : "people"}
                    </option>
                  ))}
                </select>
                <span className="text-xs text-ink-2">
                  Your invitation is for up to {guestsAllowed}.
                </span>
              </label>
            ) : null}
            <button
              type="button"
              onClick={save}
              disabled={!choice || busy}
              className="mt-1 h-12 rounded-xl bg-bronze text-[15px] font-semibold text-white disabled:opacity-50"
            >
              {busy ? "Saving..." : saved ? "Update my reply" : "Send my reply"}
            </button>
          </fieldset>
        )}
        {message ? (
          <p
            role={message.ok ? "status" : "alert"}
            className={`mt-3 text-[14px] ${message.ok ? "text-forest" : "text-destructive"}`}
          >
            {message.text}
          </p>
        ) : null}
      </div>
    </section>
  );
}
