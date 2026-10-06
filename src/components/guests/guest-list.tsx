"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Mail } from "lucide-react";
import { FormAlert } from "@/components/auth/form-alert";
import type { GuestItem } from "@/modules/guests/schema";
import { sendInvitationsAction } from "@/modules/invitations/actions";
import { describeSend } from "./send-result";
import { GuestRow } from "./guest-row";

type Entry = { guest: GuestItem; inviteUrl: string; whatsappUrl: string };

// The guest rows with a tick box on each, so a member can email invitations to one guest, a few,
// or everyone on this page (PRD 5.6).
export function GuestList({
  entries,
  eventNames,
}: {
  entries: Entry[];
  eventNames: Record<string, string>;
}) {
  const router = useRouter();
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [busy, setBusy] = React.useState(false);
  const [notice, setNotice] = React.useState<{ ok: boolean; text: string } | null>(null);

  const toggle = (id: string) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  async function send(guestIds: string[]) {
    setBusy(true);
    setNotice(null);
    const result = await sendInvitationsAction({ guestIds });
    setBusy(false);
    if (result.ok) {
      setNotice({ ok: true, text: describeSend(result.data, "invitation") });
      setSelected(new Set());
      router.refresh();
    } else setNotice({ ok: false, text: result.error.message });
  }

  const allIds = entries.map((e) => e.guest.id);
  const allSelected = allIds.length > 0 && allIds.every((id) => selected.has(id));

  return (
    <div>
      {notice ? (
        notice.ok ? (
          <p
            role="status"
            className="mt-3 rounded-lg border border-forest/20 bg-forest/10 px-3.5 py-3 text-[13px] font-medium text-forest"
          >
            {notice.text}
          </p>
        ) : (
          <div className="mt-3">
            <FormAlert title="Couldn't send">{notice.text}</FormAlert>
          </div>
        )
      ) : null}

      <div className="mt-2 flex flex-wrap items-center gap-3 text-[13px]">
        <label className="flex items-center gap-2 text-ink-2">
          <input
            type="checkbox"
            checked={allSelected}
            onChange={() => setSelected(allSelected ? new Set() : new Set(allIds))}
            className="size-4 accent-plum"
          />
          Select all on this page
        </label>
        {selected.size > 0 ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => send([...selected])}
            className="inline-flex items-center gap-1.5 rounded-lg bg-bronze px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
          >
            <Mail className="size-3.5" aria-hidden />
            {busy ? "Sending..." : `Email invitation to ${selected.size} selected`}
          </button>
        ) : null}
      </div>

      <ul className="mt-2 divide-y divide-line rounded-xl bg-white shadow-[0_1px_3px_rgba(35,31,32,0.04)]">
        {entries.map((entry) => (
          <GuestRow
            key={entry.guest.id}
            guest={entry.guest}
            eventNames={eventNames}
            inviteUrl={entry.inviteUrl}
            whatsappUrl={entry.whatsappUrl}
            selected={selected.has(entry.guest.id)}
            onToggle={() => toggle(entry.guest.id)}
            onEmail={entry.guest.email ? () => send([entry.guest.id]) : undefined}
            busy={busy}
          />
        ))}
      </ul>
    </div>
  );
}
