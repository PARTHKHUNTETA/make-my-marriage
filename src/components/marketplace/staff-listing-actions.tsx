"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { decideListingAction } from "@/modules/marketplace/actions";
import type { ListingStatus } from "@/modules/marketplace/schema";

const small = "rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-50";

// Approve, reject or suspend one listing. A reason is optional and shown to the vendor.
export function StaffListingActions({
  listingId,
  status,
}: {
  listingId: string;
  status: ListingStatus;
}) {
  const router = useRouter();
  const [note, setNote] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function decide(decision: "approve" | "reject" | "suspend") {
    setBusy(true);
    setError(null);
    const result = await decideListingAction({ listingId, decision, note });
    setBusy(false);
    if (result.ok) {
      setNote("");
      router.refresh();
    } else setError(result.error.message);
  }

  const canApprove = status === "pending" || status === "rejected" || status === "suspended";
  const canReject = status === "pending";
  const canSuspend = status === "approved" || status === "paused" || status === "pending";

  return (
    <div className="flex flex-col gap-2">
      {canReject || canSuspend ? (
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Reason shown to the vendor (optional)"
          aria-label="Reason"
          className="h-9 rounded-lg border border-line-soft/60 bg-white px-3 text-[13px] text-ink outline-none focus:border-plum focus:ring-1 focus:ring-plum"
        />
      ) : null}
      <div className="flex flex-wrap gap-2">
        {canApprove ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => decide("approve")}
            className={`${small} bg-forest text-white`}
          >
            Approve
          </button>
        ) : null}
        {canReject ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => decide("reject")}
            className={`${small} bg-rose-100 text-ink hover:bg-rose-200`}
          >
            Reject
          </button>
        ) : null}
        {canSuspend ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => decide("suspend")}
            className={`${small} text-destructive hover:bg-destructive/10`}
          >
            Suspend
          </button>
        ) : null}
      </div>
      {error ? (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
