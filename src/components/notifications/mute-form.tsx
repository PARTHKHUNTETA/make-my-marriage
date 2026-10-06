"use client";

import * as React from "react";
import { saveMutedTypesAction } from "@/modules/notifications/actions";
import {
  MEMBER_TYPE_LABELS,
  MEMBER_TYPES,
  type MemberNotificationType,
} from "@/modules/notifications/schema";

// Each person chooses which alerts they want. Ticked means "tell me".
export function MuteForm({ muted }: { muted: string[] }) {
  const [on, setOn] = React.useState<Set<string>>(
    new Set(MEMBER_TYPES.filter((t) => !muted.includes(t))),
  );
  const [busy, setBusy] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  async function save() {
    setBusy(true);
    setMessage(null);
    setError(null);
    const types = MEMBER_TYPES.filter((t) => !on.has(t)) as MemberNotificationType[];
    const r = await saveMutedTypesAction({ types });
    setBusy(false);
    if (r.ok) setMessage("Saved.");
    else setError(r.error.message);
  }

  return (
    <div className="rounded-xl bg-white p-5 shadow-[0_1px_3px_rgba(35,31,32,0.04)] sm:p-6">
      <ul className="flex flex-col gap-3">
        {MEMBER_TYPES.map((t) => (
          <li key={t}>
            <label className="flex items-start gap-3 text-sm text-ink">
              <input
                type="checkbox"
                className="mt-0.5 size-4 accent-plum"
                checked={on.has(t)}
                onChange={(e) =>
                  setOn((prev) => {
                    const next = new Set(prev);
                    if (e.target.checked) next.add(t);
                    else next.delete(t);
                    return next;
                  })
                }
              />
              {MEMBER_TYPE_LABELS[t]}
            </label>
          </li>
        ))}
      </ul>
      <div className="mt-5 flex items-center gap-3">
        <button
          type="button"
          disabled={busy}
          onClick={save}
          className="rounded-lg bg-plum px-4 py-2 text-sm font-semibold text-white hover:bg-plum/90 disabled:opacity-60"
        >
          {busy ? "Saving..." : "Save"}
        </button>
        {message ? (
          <span role="status" className="text-[13px] font-medium text-forest">
            {message}
          </span>
        ) : null}
        {error ? (
          <span role="alert" className="text-[13px] font-medium text-destructive">
            {error}
          </span>
        ) : null}
      </div>
    </div>
  );
}
