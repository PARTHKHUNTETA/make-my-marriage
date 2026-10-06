"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { removeReviewAction } from "@/modules/marketplace/actions";

const small = "rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-50";

export function RemoveReviewButton({ reviewId }: { reviewId: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function remove() {
    setBusy(true);
    const result = await removeReviewAction({ reviewId });
    setBusy(false);
    if (result.ok) router.refresh();
    else setError(result.error.message);
  }

  return confirming ? (
    <span className="flex flex-wrap items-center gap-2 text-[13px] text-ink-2">
      Remove this review for good?
      <button
        type="button"
        disabled={busy}
        onClick={remove}
        className={`${small} bg-destructive text-white`}
      >
        {busy ? "Removing..." : "Remove"}
      </button>
      <button
        type="button"
        onClick={() => setConfirming(false)}
        className={`${small} hover:bg-rose-100`}
      >
        Keep
      </button>
      {error ? (
        <span role="alert" className="text-xs text-destructive">
          {error}
        </span>
      ) : null}
    </span>
  ) : (
    <button
      type="button"
      onClick={() => setConfirming(true)}
      className={`${small} text-destructive hover:bg-destructive/10`}
    >
      Remove review
    </button>
  );
}
