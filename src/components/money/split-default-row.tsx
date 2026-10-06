"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { saveSplitDefaultAction } from "@/modules/money/actions";
import type { ExpenseCategory, SplitDefault } from "@/modules/money/schema";

// A category's usual split for shared expenses, as percentages. New shared expenses in that
// category start from it and can still be changed one by one (PRD 5.7).
export function SplitDefaultRow({
  category,
  label,
  initial,
}: {
  category: ExpenseCategory;
  label: string;
  initial: SplitDefault | undefined;
}) {
  const router = useRouter();
  const show = (n: number | undefined) => (n ? String(n) : "");
  const start = [show(initial?.bride_family), show(initial?.groom_family), show(initial?.couple)];
  const [values, setValues] = React.useState(start);
  const [busy, setBusy] = React.useState(false);
  const [message, setMessage] = React.useState<{ ok: boolean; text: string } | null>(null);
  const changed = values.some((v, i) => v.trim() !== start[i]);
  const total = values.reduce((s, v) => s + (Number(v.replace(/%/g, "")) || 0), 0);

  async function save() {
    setBusy(true);
    setMessage(null);
    const result = await saveSplitDefaultAction({
      category,
      shareBride: values[0],
      shareGroom: values[1],
      shareCouple: values[2],
    });
    setBusy(false);
    if (result.ok) {
      setMessage({ ok: true, text: values.every((v) => !v.trim()) ? "Cleared" : "Saved" });
      router.refresh();
      return;
    }
    const details = result.error.details as Record<string, string[] | undefined> | undefined;
    setMessage({
      ok: false,
      text:
        details?.shareBride?.[0] ??
        details?.shareGroom?.[0] ??
        details?.shareCouple?.[0] ??
        result.error.message,
    });
  }

  const input = (i: number, name: string) => (
    <input
      aria-label={`${name} share of ${label}, percent`}
      value={values[i]}
      onChange={(e) => {
        setValues((current) => current.map((v, j) => (j === i ? e.target.value : v)));
        setMessage(null);
      }}
      inputMode="decimal"
      placeholder="%"
      autoComplete="off"
      className="h-9 w-20 rounded-lg border border-line-soft/60 bg-white px-2 text-right text-[13px] text-ink outline-none focus:border-plum focus:ring-1 focus:ring-plum"
    />
  );

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
      className="flex flex-wrap items-center gap-x-3 gap-y-2 py-2.5"
    >
      <span className="w-32 text-sm font-semibold text-ink">{label}</span>
      {input(0, "Bride's family")}
      {input(1, "Groom's family")}
      {input(2, "Couple")}
      <span className="w-16 text-xs text-ink-2">
        {total > 0 ? `${Math.round(total * 100) / 100}%` : ""}
      </span>
      {changed ? (
        <button
          type="submit"
          disabled={busy}
          className="rounded-lg bg-bronze px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
        >
          {busy ? "Saving..." : "Save"}
        </button>
      ) : null}
      {message ? (
        <span
          role={message.ok ? "status" : "alert"}
          className={`text-xs ${message.ok ? "text-forest" : "text-destructive"}`}
        >
          {message.text}
        </span>
      ) : null}
    </form>
  );
}
