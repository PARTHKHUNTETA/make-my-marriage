"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { FormAlert } from "@/components/auth/form-alert";
import { deleteExpenseAction } from "@/modules/money/actions";

const small = "rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-50";

export function DeleteExpenseButton({ expenseId }: { expenseId: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [problem, setProblem] = React.useState<string | null>(null);

  async function remove() {
    setBusy(true);
    const result = await deleteExpenseAction({ expenseId });
    if (result.ok) {
      router.push("/money");
      return;
    }
    setBusy(false);
    setProblem(result.error.message);
  }

  return (
    <div className="flex flex-col gap-3">
      {problem ? <FormAlert title="Couldn't delete the expense">{problem}</FormAlert> : null}
      {confirming ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[13px] text-ink-2">
            Delete this expense? Your totals will drop.
          </span>
          <button
            type="button"
            disabled={busy}
            onClick={remove}
            className={`${small} bg-destructive text-white hover:bg-destructive/90`}
          >
            {busy ? "Deleting..." : "Delete expense"}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => setConfirming(false)}
            className={`${small} text-ink-2 hover:bg-rose-100`}
          >
            Cancel
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className={`${small} self-start text-destructive hover:bg-destructive/10`}
        >
          Delete this expense
        </button>
      )}
    </div>
  );
}
