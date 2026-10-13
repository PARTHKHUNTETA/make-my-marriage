"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { switchWeddingAction } from "@/modules/members/actions";

// For someone who belongs to more than one wedding: which one they are working in. Choosing
// another reloads the app in that wedding. The last option starts a new wedding.
export function WeddingSwitcher({
  weddings,
  currentId,
}: {
  weddings: { id: string; title: string }[];
  currentId: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function onChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const value = e.target.value;
    if (value === "new") {
      router.push("/setup?new=1");
      return;
    }
    setBusy(true);
    setError(null);
    const r = await switchWeddingAction({ weddingId: value });
    setBusy(false);
    if (!r.ok) return setError(r.error.message);
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="px-4 pb-2">
      <label htmlFor="wedding-switcher" className="sr-only">
        Wedding
      </label>
      <select
        id="wedding-switcher"
        value={currentId}
        disabled={busy}
        onChange={onChange}
        className="h-10 w-full rounded-xl border border-line-soft/60 bg-white px-3 text-[13px] font-semibold text-ink"
      >
        {weddings.map((w) => (
          <option key={w.id} value={w.id}>
            {w.title}
          </option>
        ))}
        <option value="new">+ Start another wedding</option>
      </select>
      {error ? (
        <p role="alert" className="mt-1 text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
