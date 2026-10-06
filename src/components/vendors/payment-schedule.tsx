"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { FormAlert } from "@/components/auth/form-alert";
import { Select } from "@/components/ui/select";
import { toIstYmd } from "@/lib/dates";
import { formatRupees, toRupeeInput } from "@/lib/money";
import { PAYER_LABELS } from "@/modules/money/schema";
import {
  addInstallmentAction,
  deleteInstallmentAction,
  markInstallmentPaidAction,
  markInstallmentUnpaidAction,
  updateInstallmentAction,
} from "@/modules/vendors/actions";
import {
  INSTALLMENT_LABELS,
  type InstallmentItem,
  type InstallmentStatus,
} from "@/modules/vendors/schema";

const badge: Record<InstallmentStatus, string> = {
  upcoming: "bg-rose-200 text-ink-2",
  due: "bg-honey/25 text-bronze",
  overdue: "bg-destructive/10 text-destructive",
  paid: "bg-forest/15 text-forest",
};
const dateFormat = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "Asia/Kolkata",
});
const small = "rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-50";
const inputClass =
  "h-9 rounded-lg border border-line-soft/60 bg-white px-3 text-[13px] text-ink outline-none focus:border-plum focus:ring-1 focus:ring-plum";

type Run = (
  action: () => Promise<
    { ok: true } | { ok: false; error: { message: string; details?: unknown } }
  >,
) => Promise<boolean>;

// The shared "do it, show the result, refresh" for every button on this page.
function useRunner() {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const run: Run = async (action) => {
    setBusy(true);
    setError(null);
    const result = await action();
    setBusy(false);
    if (result.ok) {
      router.refresh();
      return true;
    }
    const details = result.error.details as Record<string, string[] | undefined> | undefined;
    setError(
      details?.label?.[0] ?? details?.amount?.[0] ?? details?.dueDate?.[0] ?? result.error.message,
    );
    return false;
  };
  return { busy, error, run, clear: () => setError(null) };
}

function InstallmentRow({ vendorId, item }: { vendorId: string; item: InstallmentItem }) {
  const { busy, error, run, clear } = useRunner();
  const [mode, setMode] = React.useState<"view" | "edit" | "pay" | "unpay" | "delete">("view");
  const [label, setLabel] = React.useState(item.label);
  const [amount, setAmount] = React.useState(toRupeeInput(item.amount));
  const [dueDate, setDueDate] = React.useState(toIstYmd(item.dueDate));
  const [paidBy, setPaidBy] = React.useState<"bride_family" | "groom_family" | "couple">("couple");
  const [paidOn, setPaidOn] = React.useState(toIstYmd(new Date()));
  const ref = { vendorId, installmentId: item.id };
  const done = () => {
    setMode("view");
    clear();
  };

  return (
    <li className="flex flex-col gap-2 px-5 py-3.5">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <div className="min-w-0 flex-1 basis-40">
          <p className="text-sm font-semibold text-ink">{item.label}</p>
          <p className="text-[13px] text-ink-2">
            {item.paidOn
              ? `Paid ${dateFormat.format(item.paidOn)}`
              : `Due ${dateFormat.format(item.dueDate)}`}
          </p>
        </div>
        <span className="text-sm font-semibold text-ink">{formatRupees(item.amount)}</span>
        <span
          className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${badge[item.status]}`}
        >
          {INSTALLMENT_LABELS[item.status]}
        </span>
        {mode === "view" ? (
          <span className="flex flex-wrap gap-1">
            {item.status === "paid" ? (
              <button
                type="button"
                onClick={() => setMode("unpay")}
                className={`${small} text-ink-2 hover:bg-rose-100`}
              >
                Mark unpaid
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setMode("pay")}
                  className={`${small} bg-bronze text-white hover:bg-bronze/90`}
                >
                  Mark paid
                </button>
                <button
                  type="button"
                  onClick={() => setMode("edit")}
                  className={`${small} bg-rose-100 text-ink hover:bg-rose-200`}
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => setMode("delete")}
                  className={`${small} text-destructive hover:bg-destructive/10`}
                >
                  Delete
                </button>
              </>
            )}
          </span>
        ) : null}
      </div>

      {mode === "edit" ? (
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            if (await run(() => updateInstallmentAction({ ...ref, label, amount, dueDate })))
              done();
          }}
        >
          <label className="flex flex-col gap-0.5 text-xs text-ink-2">
            Label
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              className={`${inputClass} w-36`}
            />
          </label>
          <label className="flex flex-col gap-0.5 text-xs text-ink-2">
            Amount (₹)
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              inputMode="decimal"
              className={`${inputClass} w-28`}
            />
          </label>
          <label className="flex flex-col gap-0.5 text-xs text-ink-2">
            Due date
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className={inputClass}
            />
          </label>
          <button type="submit" disabled={busy} className={`${small} bg-bronze text-white`}>
            {busy ? "Saving..." : "Save"}
          </button>
          <button type="button" onClick={done} className={`${small} text-ink-2 hover:bg-rose-100`}>
            Cancel
          </button>
        </form>
      ) : null}

      {mode === "pay" ? (
        <form
          className="flex flex-wrap items-end gap-2 rounded-lg bg-rose-50 p-3"
          onSubmit={async (e) => {
            e.preventDefault();
            if (await run(() => markInstallmentPaidAction({ ...ref, paidBy, paidOn }))) done();
          }}
        >
          <label className="flex flex-col gap-0.5 text-xs text-ink-2">
            Paid by
            <Select
              value={paidBy}
              onChange={(e) => setPaidBy(e.target.value as typeof paidBy)}
              className="h-9 w-auto text-[13px]"
            >
              <option value="bride_family">{PAYER_LABELS.bride_family}</option>
              <option value="groom_family">{PAYER_LABELS.groom_family}</option>
              <option value="couple">{PAYER_LABELS.couple}</option>
            </Select>
          </label>
          <label className="flex flex-col gap-0.5 text-xs text-ink-2">
            Paid on
            <input
              type="date"
              value={paidOn}
              onChange={(e) => setPaidOn(e.target.value)}
              className={inputClass}
            />
          </label>
          <button type="submit" disabled={busy} className={`${small} bg-bronze text-white`}>
            {busy ? "Saving..." : `Mark ${formatRupees(item.amount)} paid`}
          </button>
          <button type="button" onClick={done} className={`${small} text-ink-2 hover:bg-rose-100`}>
            Cancel
          </button>
          <span className="basis-full text-xs text-ink-2">
            This adds the payment to your expenses.
          </span>
        </form>
      ) : null}

      {mode === "unpay" ? (
        <div className="flex flex-wrap items-center gap-2 text-[13px] text-ink-2">
          Mark as unpaid? The expense it created will be removed.
          <button
            type="button"
            disabled={busy}
            onClick={async () => {
              if (await run(() => markInstallmentUnpaidAction(ref))) done();
            }}
            className={`${small} bg-destructive text-white`}
          >
            {busy ? "Working..." : "Mark unpaid"}
          </button>
          <button type="button" onClick={done} className={`${small} hover:bg-rose-100`}>
            Cancel
          </button>
        </div>
      ) : null}

      {mode === "delete" ? (
        <div className="flex flex-wrap items-center gap-2 text-[13px] text-ink-2">
          Delete this payment?
          <button
            type="button"
            disabled={busy}
            onClick={async () => {
              if (await run(() => deleteInstallmentAction(ref))) done();
            }}
            className={`${small} bg-destructive text-white`}
          >
            {busy ? "Deleting..." : "Delete"}
          </button>
          <button type="button" onClick={done} className={`${small} hover:bg-rose-100`}>
            Cancel
          </button>
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </li>
  );
}

// A vendor's payment schedule: advance, final and so on, each with a due date (PRD 5.7).
export function PaymentSchedule({
  vendorId,
  installments,
}: {
  vendorId: string;
  installments: InstallmentItem[];
}) {
  const { busy, error, run } = useRunner();
  const [label, setLabel] = React.useState("");
  const [amount, setAmount] = React.useState("");
  const [dueDate, setDueDate] = React.useState("");

  return (
    <section className="rounded-xl bg-white shadow-[0_1px_3px_rgba(35,31,32,0.04)]">
      <h2 className="px-5 pt-5 font-serif text-xl text-ink">Payment schedule</h2>
      {installments.length === 0 ? (
        <p className="px-5 pt-2 text-[13px] text-ink-2">
          No payments planned yet. Add the advance, the final payment and anything in between.
        </p>
      ) : (
        <ul className="mt-2 divide-y divide-line">
          {installments.map((item) => (
            <InstallmentRow
              key={`${item.id}-${item.status}-${item.amount}`}
              vendorId={vendorId}
              item={item}
            />
          ))}
        </ul>
      )}

      <form
        className="flex flex-wrap items-end gap-2 px-5 py-4"
        onSubmit={async (e) => {
          e.preventDefault();
          if (await run(() => addInstallmentAction({ vendorId, label, amount, dueDate }))) {
            setLabel("");
            setAmount("");
            setDueDate("");
          }
        }}
      >
        <label className="flex flex-col gap-0.5 text-xs text-ink-2">
          Label
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Advance"
            className={`${inputClass} w-36`}
          />
        </label>
        <label className="flex flex-col gap-0.5 text-xs text-ink-2">
          Amount (₹)
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            inputMode="decimal"
            placeholder="50,000"
            className={`${inputClass} w-28`}
          />
        </label>
        <label className="flex flex-col gap-0.5 text-xs text-ink-2">
          Due date
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className={inputClass}
          />
        </label>
        <button
          type="submit"
          disabled={busy}
          className={`${small} bg-bronze text-white hover:bg-bronze/90`}
        >
          {busy ? "Adding..." : "Add payment"}
        </button>
      </form>
      {error ? (
        <div className="px-5 pb-4">
          <FormAlert title="Couldn't add the payment">{error}</FormAlert>
        </div>
      ) : null}
    </section>
  );
}
