"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { FormAlert } from "@/components/auth/form-alert";
import { saveReminderSettingsAction } from "@/modules/invitations/actions";

export function ReminderSettingsForm({
  enabled: initialEnabled,
  days: initialDays,
}: {
  enabled: boolean;
  days: number[];
}) {
  const router = useRouter();
  const [enabled, setEnabled] = React.useState(initialEnabled);
  const [days, setDays] = React.useState(initialDays.join(", "));
  const [busy, setBusy] = React.useState(false);
  const [notice, setNotice] = React.useState<{ ok: boolean; text: string } | null>(null);

  async function save() {
    setBusy(true);
    setNotice(null);
    const result = await saveReminderSettingsAction({ enabled, days });
    setBusy(false);
    if (result.ok) {
      setDays(result.data.rsvpDays.join(", "));
      setNotice({ ok: true, text: "Saved." });
      router.refresh();
      return;
    }
    const details = result.error.details as Record<string, string[] | undefined> | undefined;
    setNotice({ ok: false, text: details?.rsvpDays?.[0] ?? result.error.message });
  }

  return (
    <div className="flex flex-col gap-4">
      <label className="flex items-start gap-3 text-sm text-ink">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
          className="mt-0.5 size-4 accent-plum"
        />
        <span>
          Send reminders automatically
          <span className="block text-xs text-ink-2">
            Off until you turn it on. Only guests with an email get them, at most one a day, and
            each email has an unsubscribe link.
          </span>
        </span>
      </label>
      <div className="flex max-w-sm flex-col gap-1">
        <label htmlFor="reminder-days" className="text-xs font-semibold tracking-wide text-ink">
          Ask guests who haven&rsquo;t replied this many days before each event
        </label>
        <input
          id="reminder-days"
          value={days}
          onChange={(e) => setDays(e.target.value)}
          placeholder="14, 3"
          inputMode="numeric"
          className="h-11 rounded-lg border border-line-soft/60 bg-white px-4 text-sm text-ink outline-none focus:border-plum focus:ring-1 focus:ring-plum"
        />
        <span className="text-xs text-ink-2">
          Separate with commas, up to 5 numbers. Guests who are attending are also reminded the day
          before each event, with the time, venue, map link and dress code.
        </span>
      </div>
      {notice && !notice.ok ? <FormAlert title="Couldn't save">{notice.text}</FormAlert> : null}
      <div className="flex items-center gap-3">
        <button
          type="button"
          disabled={busy}
          onClick={save}
          className="h-10 rounded-lg bg-bronze px-5 text-sm font-semibold text-white disabled:opacity-50"
        >
          {busy ? "Saving..." : "Save"}
        </button>
        {notice?.ok ? (
          <span role="status" className="text-xs font-medium text-forest">
            {notice.text}
          </span>
        ) : null}
      </div>
    </div>
  );
}
