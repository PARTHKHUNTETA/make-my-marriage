"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { FormAlert } from "@/components/auth/form-alert";
import { deleteEventAction, previewEventDeleteAction } from "@/modules/events/actions";
import type { EventDeletePreview } from "@/modules/events/schema";

const small = "rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-50";

function describeLinks({ taskCount, guestCount, expenseCount }: EventDeletePreview) {
  const parts: string[] = [];
  if (guestCount > 0)
    parts.push(
      `${guestCount} ${guestCount === 1 ? "guest is" : "guests are"} invited to it. Their invitations and replies for this event will be deleted.`,
    );
  if (taskCount > 0)
    parts.push(
      `${taskCount} ${taskCount === 1 ? "task is" : "tasks are"} linked to it. ${taskCount === 1 ? "It stays" : "They stay"} on your list, without the event.`,
    );
  if (expenseCount > 0)
    parts.push(
      `${expenseCount} ${expenseCount === 1 ? "expense is" : "expenses are"} linked to it. ${expenseCount === 1 ? "It stays" : "They stay"} in your totals, without the event, and this event's budget is removed.`,
    );
  return parts.length > 0 ? parts.join(" ") : "Nothing else is linked to this event.";
}

// Asks the server what is linked first, then asks for confirmation (PRD 5.3).
export function DeleteEventButton({ eventId, name }: { eventId: string; name: string }) {
  const router = useRouter();
  const [preview, setPreview] = React.useState<EventDeletePreview | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [problem, setProblem] = React.useState<string | null>(null);

  async function ask() {
    setBusy(true);
    setProblem(null);
    const result = await previewEventDeleteAction({ eventId });
    setBusy(false);
    if (result.ok) setPreview(result.data);
    else setProblem(result.error.message);
  }

  async function confirm() {
    setBusy(true);
    const result = await deleteEventAction({ eventId });
    if (result.ok) {
      router.push("/events");
      return;
    }
    setBusy(false);
    setProblem(result.error.message);
  }

  return (
    <div className="flex flex-col gap-3">
      {problem ? <FormAlert title="Couldn't delete the event">{problem}</FormAlert> : null}
      {preview ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-ink">
          <p className="font-semibold">Delete &ldquo;{name}&rdquo;?</p>
          <p className="mt-1 text-[13px] text-ink-2">
            {describeLinks(preview)} This can&rsquo;t be undone.
          </p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={confirm}
              className={`${small} bg-destructive text-white hover:bg-destructive/90`}
            >
              {busy ? "Deleting..." : "Delete event"}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => setPreview(null)}
              className={`${small} text-ink-2 hover:bg-rose-100`}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          disabled={busy}
          onClick={ask}
          className={`${small} self-start text-destructive hover:bg-destructive/10`}
        >
          Delete this event
        </button>
      )}
    </div>
  );
}
