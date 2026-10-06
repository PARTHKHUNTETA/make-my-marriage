"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  setCategoryBudgetAction,
  setEventBudgetAction,
  setOverallBudgetAction,
} from "@/modules/money/actions";
import type { ExpenseCategory } from "@/modules/money/schema";
import { toRupeeInput } from "@/lib/money";

type Target =
  | { kind: "overall" }
  | { kind: "category"; category: ExpenseCategory }
  | { kind: "event"; eventId: string };

// One budget amount in rupees. Leaving it blank and saving removes that budget.
export function BudgetEditor({
  label,
  target,
  initial,
}: {
  label: string;
  target: Target;
  initial: number | null;
}) {
  const router = useRouter();
  const start = initial === null ? "" : toRupeeInput(initial);
  const [value, setValue] = React.useState(start);
  const [busy, setBusy] = React.useState(false);
  const [message, setMessage] = React.useState<{ ok: boolean; text: string } | null>(null);
  const changed = value.trim() !== start;

  async function save() {
    setBusy(true);
    setMessage(null);
    const result =
      target.kind === "overall"
        ? await setOverallBudgetAction({ amount: value })
        : target.kind === "category"
          ? await setCategoryBudgetAction({ category: target.category, amount: value })
          : await setEventBudgetAction({ eventId: target.eventId, amount: value });
    setBusy(false);
    if (result.ok) {
      setMessage({ ok: true, text: value.trim() ? "Saved" : "Removed" });
      router.refresh();
      return;
    }
    const details = result.error.details as Record<string, string[] | undefined> | undefined;
    setMessage({ ok: false, text: details?.amount?.[0] ?? result.error.message });
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
      className="flex items-center gap-2"
    >
      <label className="sr-only" htmlFor={`budget-${label}`}>
        Budget for {label}
      </label>
      <input
        id={`budget-${label}`}
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setMessage(null);
        }}
        inputMode="decimal"
        placeholder="No budget"
        autoComplete="off"
        aria-invalid={message?.ok === false ? true : undefined}
        className="h-9 w-32 rounded-lg border border-line-soft/60 bg-white px-3 text-right text-[13px] text-ink outline-none focus:border-plum focus:ring-1 focus:ring-plum aria-invalid:border-destructive"
      />
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
