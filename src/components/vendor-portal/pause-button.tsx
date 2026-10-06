"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { pauseListingAction } from "@/modules/marketplace/actions";

// Pausing hides a live listing from couples; resuming brings it back without another review.
export function PauseButton({ paused }: { paused: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function toggle() {
    setBusy(true);
    setError(null);
    const result = await pauseListingAction({ paused: !paused });
    setBusy(false);
    if (result.ok) router.refresh();
    else setError(result.error.message);
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={toggle}
        disabled={busy}
        className="rounded-lg bg-rose-100 px-4 py-2 text-xs font-semibold text-ink hover:bg-rose-200 disabled:opacity-50"
      >
        {busy ? "One moment..." : paused ? "Resume listing" : "Pause listing"}
      </button>
      {error ? (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
