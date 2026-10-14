"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { PLATFORM_ROLES } from "@/lib/permissions";
import { setStaffRolesAction } from "@/modules/staff/actions";

type RoleKey = keyof typeof PLATFORM_ROLES;
const KEYS = Object.keys(PLATFORM_ROLES) as RoleKey[];

// Sets one account's staff roles: tick none to take away staff access.
export function StaffRolesForm({ email = "", roles = [] }: { email?: string; roles?: string[] }) {
  const router = useRouter();
  const [address, setAddress] = React.useState(email);
  const [chosen, setChosen] = React.useState<string[]>(roles);
  const [message, setMessage] = React.useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = React.useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const r = await setStaffRolesAction({ email: address, roles: chosen });
    setBusy(false);
    setMessage(r.ok ? { ok: true, text: "Saved." } : { ok: false, text: r.error.message });
    if (r.ok) router.refresh();
  }

  return (
    <form
      onSubmit={save}
      className="flex flex-col gap-3 rounded-xl bg-white p-4 shadow-[0_1px_3px_rgba(35,31,32,0.04)]"
    >
      <label className="flex flex-col gap-1 text-xs font-semibold text-ink">
        Account email
        <input
          type="email"
          required
          readOnly={Boolean(email)}
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          className="h-10 rounded-lg border border-line-soft/60 bg-white px-3 text-sm font-normal"
        />
      </label>
      <div className="flex flex-wrap gap-4">
        {KEYS.map((k) => (
          <label key={k} className="flex items-center gap-2 text-[13px] text-ink">
            <input
              type="checkbox"
              className="size-4 accent-plum"
              checked={chosen.includes(k)}
              onChange={() =>
                setChosen((c) => (c.includes(k) ? c.filter((x) => x !== k) : [...c, k]))
              }
            />
            {PLATFORM_ROLES[k].name}
          </label>
        ))}
      </div>
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={busy}
          className="h-10 rounded-lg bg-plum px-4 text-sm font-semibold text-white disabled:opacity-50"
        >
          {busy ? "Saving..." : "Save"}
        </button>
        {message ? (
          <span
            role={message.ok ? "status" : "alert"}
            className={`text-[13px] ${message.ok ? "text-forest" : "text-destructive"}`}
          >
            {message.text}
          </span>
        ) : null}
      </div>
    </form>
  );
}
