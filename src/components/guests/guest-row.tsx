"use client";

import * as React from "react";
import Link from "next/link";
import { Check, Copy, Mail, MessageCircle } from "lucide-react";
import { recordWhatsappShareAction } from "@/modules/guests/actions";
import { RSVP_LABELS, type GuestItem, type RsvpStatus } from "@/modules/guests/schema";

const chip: Record<RsvpStatus, string> = {
  pending: "bg-rose-200 text-ink-2",
  attending: "bg-forest/15 text-forest",
  not_attending: "bg-destructive/10 text-destructive",
};

const shortDate = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  timeZone: "Asia/Kolkata",
});

export function GuestRow({
  guest,
  eventNames,
  inviteUrl,
  whatsappUrl,
  selected,
  onToggle,
  onEmail,
  busy,
}: {
  guest: GuestItem;
  eventNames: Record<string, string>;
  inviteUrl: string;
  whatsappUrl: string;
  selected: boolean;
  onToggle: () => void;
  // Absent when the guest has no email address.
  onEmail?: () => void;
  busy: boolean;
}) {
  const [copied, setCopied] = React.useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Copy this link", inviteUrl);
    }
  }

  const button =
    "inline-flex items-center gap-1.5 rounded-lg bg-rose-100 px-3 py-1.5 text-xs font-semibold text-ink transition-colors hover:bg-rose-200";

  return (
    <li className="flex flex-col gap-3 px-5 py-4">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
        <div className="flex min-w-0 items-start gap-3">
          <input
            type="checkbox"
            checked={selected}
            onChange={onToggle}
            aria-label={`Select ${guest.name}`}
            className="mt-1 size-4 shrink-0 accent-plum"
          />
          <div className="min-w-0">
            <Link
              href={`/guests/${guest.id}`}
              className="text-sm font-semibold text-ink hover:underline"
            >
              {guest.name}
            </Link>
            <p className="text-[13px] text-ink-2">
              Up to {guest.guestsAllowed} {guest.guestsAllowed === 1 ? "guest" : "guests"}
              {guest.phone ? ` · ${guest.phone}` : ""}
              {guest.email ? ` · ${guest.email}` : ""}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={copy} className={button}>
            {copied ? (
              <Check className="size-3.5" aria-hidden />
            ) : (
              <Copy className="size-3.5" aria-hidden />
            )}
            {copied ? "Copied" : "Copy link"}
          </button>
          {onEmail ? (
            <button type="button" disabled={busy} onClick={onEmail} className={button}>
              <Mail className="size-3.5" aria-hidden />{" "}
              {guest.inviteEmailedAt ? "Email again" : "Email invite"}
            </button>
          ) : null}
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => void recordWhatsappShareAction({ guestId: guest.id })}
            className={button}
          >
            <MessageCircle className="size-3.5" aria-hidden /> WhatsApp
          </a>
        </div>
      </div>
      <ul className="flex flex-wrap gap-1.5">
        {guest.invitations.map((i) => (
          <li
            key={i.eventId}
            className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${chip[i.rsvpStatus]}`}
          >
            {eventNames[i.eventId] ?? "Event"}: {RSVP_LABELS[i.rsvpStatus]}
            {i.rsvpStatus === "attending" && i.numberAttending ? ` (${i.numberAttending})` : ""}
          </li>
        ))}
      </ul>
      {guest.whatsappSharedAt || guest.inviteEmailedAt ? (
        <p className="text-xs text-ink-2">
          {[
            guest.inviteEmailedAt ? `Emailed ${shortDate.format(guest.inviteEmailedAt)}` : "",
            guest.whatsappSharedAt
              ? `Shared on WhatsApp ${shortDate.format(guest.whatsappSharedAt)}`
              : "",
            guest.remindersUnsubscribed ? "Unsubscribed from reminders" : "",
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
      ) : null}
    </li>
  );
}
