"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { deleteWeddingAction } from "@/modules/deletion/actions";

// Typing the title is the confirmation: it cannot be done by accident, or by a stray double click.
export function DeleteWeddingForm({ title }: { title: string }) {
  const router = useRouter();
  const [typed, setTyped] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [problem, setProblem] = React.useState<string | null>(null);
  const matches = typed.trim().replace(/\s+/g, " ").toLowerCase() === title.toLowerCase();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!matches || busy) return;
    setBusy(true);
    setProblem(null);
    const result = await deleteWeddingAction({ confirmTitle: typed });
    if (!result.ok) {
      setBusy(false);
      return setProblem(result.error.message);
    }
    // The wedding is gone, so there is nothing here to refresh: leave for the start of the app.
    router.replace("/");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="mt-6 border-t border-line pt-5">
      <label className="block text-[13px] font-semibold text-ink">
        To confirm, type <span className="font-mono text-plum">{title}</span>
        <Input
          className="mt-2"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          autoComplete="off"
          spellCheck={false}
        />
      </label>
      {problem ? (
        <p role="alert" className="mt-3 text-sm text-destructive">
          {problem}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={!matches || busy}
        className="mt-4 h-11 rounded-lg bg-destructive px-5 text-sm font-semibold text-white disabled:opacity-40"
      >
        {busy ? "Deleting…" : "Delete this wedding for good"}
      </button>
    </form>
  );
}
