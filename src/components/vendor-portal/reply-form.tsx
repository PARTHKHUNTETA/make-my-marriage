"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Textarea } from "@/components/ui/textarea";
import { replyToReviewAction } from "@/modules/marketplace/actions";

// A vendor's single public reply to a review. Once posted it cannot be changed.
export function ReplyForm({ reviewId }: { reviewId: string }) {
  const router = useRouter();
  const [text, setText] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const result = await replyToReviewAction({ reviewId, text });
    setBusy(false);
    if (result.ok) router.refresh();
    else {
      const details = result.error.details as Record<string, string[] | undefined> | undefined;
      setError(details?.text?.[0] ?? result.error.message);
    }
  }

  return (
    <form onSubmit={submit} className="mt-3 flex flex-col gap-2">
      <label className="text-xs font-semibold text-ink" htmlFor={`reply-${reviewId}`}>
        Reply publicly (one reply, it can&rsquo;t be changed)
      </label>
      <Textarea
        id={`reply-${reviewId}`}
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={3}
      />
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={busy || !text.trim()}
          className="rounded-lg bg-bronze px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"
        >
          {busy ? "Posting..." : "Post reply"}
        </button>
        {error ? (
          <span role="alert" className="text-xs text-destructive">
            {error}
          </span>
        ) : null}
      </div>
    </form>
  );
}
