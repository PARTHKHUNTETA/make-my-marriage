"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { PALETTES, paletteTokens, type PaletteDef, type PaletteId } from "@/lib/palettes";
import { setPaletteAction } from "@/modules/members/actions";

// Paints a palette onto the app shell straight away, before the save finishes. It uses the shell's
// own element so everything inside recolours at once.
function paintShell(id: PaletteId) {
  const shell = document.getElementById("app-shell");
  if (!shell) return;
  for (const [name, value] of Object.entries(paletteTokens(id)))
    shell.style.setProperty(name, value);
}

// A small picture of the app in a palette's own colours, drawn from the palette itself (not from the
// colours currently on screen) so every card is accurate whichever theme is active.
function Preview({ palette }: { palette: PaletteDef }) {
  const t = paletteTokens(palette.id);
  return (
    <div
      aria-hidden
      className="overflow-hidden rounded-lg border"
      style={{ backgroundColor: t["--color-blush"], borderColor: t["--color-line"] }}
    >
      <div
        className="flex items-center justify-between px-3 py-2 text-[11px] font-semibold"
        style={{ backgroundColor: t["--color-plum"], color: "#ffffff" }}
      >
        <span>Asha &amp; Dev</span>
        <span style={{ color: t["--color-gold"] }}>131 days</span>
      </div>
      <div className="flex flex-col gap-2 p-3">
        <div
          className="rounded-md p-2.5"
          style={{ backgroundColor: "#ffffff", border: `1px solid ${t["--color-line"]}` }}
        >
          <div className="h-2 w-2/3 rounded" style={{ backgroundColor: t["--color-ink"] }} />
          <div
            className="mt-1.5 h-1.5 w-1/2 rounded"
            style={{ backgroundColor: t["--color-ink-2"], opacity: 0.55 }}
          />
        </div>
        <div className="flex items-center gap-2">
          <span
            className="rounded-md px-2.5 py-1 text-[10px] font-semibold"
            style={{ backgroundColor: t["--color-bronze"], color: "#ffffff" }}
          >
            Send invitations
          </span>
          <span
            className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
            style={{ backgroundColor: t["--color-honey"], color: t["--color-bronze"] }}
          >
            12 pending
          </span>
          <span
            className="ml-auto h-4 w-8 rounded"
            style={{ backgroundColor: t["--color-rose-100"] }}
          />
        </div>
      </div>
    </div>
  );
}

export function PalettePicker({ current }: { current: PaletteId }) {
  const router = useRouter();
  const [selected, setSelected] = React.useState<PaletteId>(current);
  const [busy, setBusy] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  async function choose(id: PaletteId) {
    if (id === selected || busy) return;
    const before = selected;
    setSelected(id);
    setMessage(null);
    setError(null);
    paintShell(id);
    setBusy(true);
    const result = await setPaletteAction({ palette: id });
    setBusy(false);
    if (!result.ok) {
      // Could not save: go back to what it was, so the screen never claims a choice that was not kept.
      setSelected(before);
      paintShell(before);
      setError(result.error.message);
      return;
    }
    setMessage("Saved. This is now your colour theme.");
    router.refresh();
  }

  return (
    <div>
      <div
        role="radiogroup"
        aria-label="Colour theme"
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
      >
        {PALETTES.map((palette) => {
          const on = palette.id === selected;
          const t = paletteTokens(palette.id);
          return (
            <label
              key={palette.id}
              className={`relative flex cursor-pointer flex-col gap-3 rounded-xl bg-white p-4 shadow-[0_1px_3px_rgba(35,31,32,0.04)] ring-2 transition-shadow has-[:focus-visible]:ring-plum/60 ${
                on ? "ring-plum" : "ring-transparent hover:ring-line"
              }`}
            >
              <input
                type="radio"
                name="palette"
                value={palette.id}
                checked={on}
                disabled={busy && !on}
                onChange={() => choose(palette.id)}
                className="sr-only"
              />
              <Preview palette={palette} />
              <div className="flex items-center gap-1.5" aria-hidden>
                {[palette.primary, palette.accent, palette.canvas, palette.surface].map((c) => (
                  <span
                    key={c}
                    className="size-5 rounded-full border"
                    style={{ backgroundColor: c, borderColor: t["--color-line-soft"] }}
                  />
                ))}
                {on ? (
                  <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-plum px-2 py-0.5 text-[11px] font-semibold text-white">
                    <Check className="size-3" aria-hidden /> Your theme
                  </span>
                ) : null}
              </div>
              <div>
                <span className="block text-sm font-semibold text-ink">{palette.name}</span>
                <span className="mt-0.5 block text-[13px] text-ink-2">{palette.vibe}</span>
              </div>
            </label>
          );
        })}
      </div>
      <div className="mt-4 min-h-6" aria-live="polite">
        {message ? <p className="text-[13px] font-medium text-forest">{message}</p> : null}
        {error ? (
          <p role="alert" className="text-[13px] font-medium text-destructive">
            {error}
          </p>
        ) : null}
      </div>
      <p className="mt-2 text-xs text-ink-2">
        Light metallic colours such as rose gold and silver are used as they are for decoration, and
        a slightly deeper shade of them wherever they carry text or sit behind white lettering, so
        everything stays easy to read.
      </p>
    </div>
  );
}
