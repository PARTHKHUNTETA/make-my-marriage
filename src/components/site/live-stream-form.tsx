"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { saveLiveSettingsAction } from "@/modules/website/actions";

const field =
  "w-full rounded-lg border border-line-soft/60 bg-white px-3 py-2.5 text-sm text-ink outline-none focus:border-plum focus:ring-1 focus:ring-plum";

// The switch and the YouTube link for the live section of the wedding website.
export function LiveStreamForm({
  initial,
}: {
  initial: { showLive: boolean; youtubeUrl: string };
}) {
  const router = useRouter();
  const [showLive, setShowLive] = React.useState(initial.showLive);
  const [url, setUrl] = React.useState(initial.youtubeUrl);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [saved, setSaved] = React.useState(false);
  const dirty = showLive !== initial.showLive || url.trim() !== initial.youtubeUrl;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setSaved(false);
    const r = await saveLiveSettingsAction({ showLive, youtubeUrl: url });
    setBusy(false);
    if (!r.ok) {
      const fields = r.error.details as { youtubeUrl?: string[] } | undefined;
      setError(fields?.youtubeUrl?.[0] ?? r.error.message);
      return;
    }
    setSaved(true);
    router.refresh();
  }

  return (
    <form onSubmit={save} noValidate className="flex flex-col gap-4">
      <label className="flex items-start gap-3 text-sm text-ink">
        <input
          type="checkbox"
          checked={showLive}
          onChange={(e) => {
            setShowLive(e.target.checked);
            setSaved(false);
          }}
          className="mt-0.5 size-4 accent-plum"
        />
        <span>
          <strong>Show a live video on my wedding website</strong>
          <span className="block text-xs text-ink-2">
            Guests watch it right on your site. After the stream ends, the same link plays
            YouTube&rsquo;s recording.
          </span>
        </span>
      </label>
      <label className="flex flex-col gap-1 text-xs font-semibold text-ink-2">
        YouTube link
        <input
          type="text"
          inputMode="url"
          autoComplete="off"
          value={url}
          onChange={(e) => {
            setUrl(e.target.value);
            setSaved(false);
          }}
          placeholder="https://www.youtube.com/live/..."
          aria-invalid={error ? true : undefined}
          className={field}
        />
      </label>
      {error ? (
        <p role="alert" className="text-[13px] font-medium text-destructive">
          {error}
        </p>
      ) : null}
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={busy || !dirty}
          className="rounded-lg bg-plum px-5 py-2.5 text-sm font-semibold text-white hover:bg-plum-hover disabled:opacity-50"
        >
          {busy ? "Saving..." : "Save"}
        </button>
        {saved ? (
          <span role="status" className="text-[13px] font-medium text-forest">
            Saved.
          </span>
        ) : null}
      </div>
    </form>
  );
}
