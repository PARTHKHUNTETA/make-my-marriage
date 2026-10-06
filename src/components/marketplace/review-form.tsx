"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Star } from "lucide-react";
import { FormAlert } from "@/components/auth/form-alert";
import { Textarea } from "@/components/ui/textarea";
import { writeReviewAction } from "@/modules/marketplace/actions";

// A couple's rating (1 to 5 stars) and a few words about a vendor they booked.
export function ReviewForm({
  listingId,
  initialRating,
  initialText,
}: {
  listingId: string;
  initialRating?: number;
  initialText?: string;
}) {
  const router = useRouter();
  const [rating, setRating] = React.useState(initialRating ?? 0);
  const [text, setText] = React.useState(initialText ?? "");
  const [busy, setBusy] = React.useState(false);
  const [saved, setSaved] = React.useState(false);
  const [problem, setProblem] = React.useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setProblem(null);
    setSaved(false);
    const result = await writeReviewAction({ listingId, rating, text });
    setBusy(false);
    if (result.ok) {
      setSaved(true);
      router.refresh();
      return;
    }
    const details = result.error.details as Record<string, string[] | undefined> | undefined;
    setProblem(details?.rating?.[0] ?? details?.text?.[0] ?? result.error.message);
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-3">
      {problem ? <FormAlert title="Couldn't save your review">{problem}</FormAlert> : null}
      <fieldset className="flex items-center gap-1">
        <legend className="mb-1 text-xs font-semibold tracking-wide text-ink">Your rating</legend>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setRating(n)}
            aria-label={`${n} ${n === 1 ? "star" : "stars"}`}
            aria-pressed={rating === n}
            className="rounded p-0.5"
          >
            <Star
              className={`size-7 ${n <= rating ? "fill-honey text-honey" : "text-line"}`}
              aria-hidden
            />
          </button>
        ))}
      </fieldset>
      <label className="flex flex-col gap-1 text-xs font-semibold tracking-wide text-ink">
        Your review (optional)
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="How was it working with them?"
        />
      </label>
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={busy || rating === 0}
          className="h-10 rounded-lg bg-bronze px-5 text-sm font-semibold text-white hover:bg-bronze/90 disabled:opacity-50"
        >
          {busy ? "Saving..." : initialRating ? "Update my review" : "Post my review"}
        </button>
        {saved ? (
          <span role="status" className="text-xs font-medium text-forest">
            Saved. Thank you.
          </span>
        ) : null}
      </div>
    </form>
  );
}
