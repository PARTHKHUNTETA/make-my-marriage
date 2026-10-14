"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Sparkles } from "lucide-react";
import { FormAlert } from "@/components/auth/form-alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { generateSiteDraftAction, saveSiteContentAction } from "@/modules/website/actions";
import {
  draftToContent,
  LANGUAGES,
  TONES,
  VIBES,
  type SiteBrief,
  type SiteData,
  type SiteDraft,
} from "@/modules/website/schema";
import { FONT_PAIRS, PALETTES, type PaletteId } from "@/themes/kit";
import { SiteView } from "./site-view";

type Vibe = keyof typeof VIBES;
type Tone = keyof typeof TONES;
type Language = keyof typeof LANGUAGES;

const EMPTY: SiteBrief = {
  vibes: [],
  colours: "",
  tone: null,
  language: "english",
  howWeMet: "",
  extra: "",
  previous: null,
};

const HERO_NAMES = { classic: "Classic", arch: "Arch", monogram: "Monogram", photo: "Photo" };

// "Design with AI": the couple answers a short brief (a few taps, two optional boxes), looks at the
// draft, and applies it or tries again. Nothing changes on the live site until they press Apply.
export function AiWebsitePanel({ site, hasDesign }: { site: SiteData; hasDesign: boolean }) {
  const router = useRouter();
  const [brief, setBrief] = React.useState<SiteBrief>(EMPTY);
  const [draft, setDraft] = React.useState<SiteDraft | null>(null);
  const [busy, setBusy] = React.useState<"generate" | "apply" | "reset" | null>(null);
  const [problem, setProblem] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);
  const set = <K extends keyof SiteBrief>(key: K, value: SiteBrief[K]) =>
    setBrief((b) => ({ ...b, [key]: value }));

  const ready =
    brief.vibes.length > 0 ||
    brief.colours.trim() !== "" ||
    brief.howWeMet.trim() !== "" ||
    brief.extra.trim().length >= 10;

  function toggleVibe(v: Vibe) {
    set(
      "vibes",
      brief.vibes.includes(v)
        ? brief.vibes.filter((x) => x !== v)
        : brief.vibes.length < 3
          ? [...brief.vibes, v]
          : brief.vibes,
    );
  }

  async function generate() {
    setBusy("generate");
    setProblem(null);
    setNotice(null);
    // "Try another" tells the AI what the current draft was, so the next one is different.
    const previous = draft ? { design: draft.design, tagline: draft.tagline } : null;
    const result = await generateSiteDraftAction({ ...brief, previous });
    setBusy(null);
    if (result.ok) setDraft(result.data.draft);
    else setProblem(result.error.message);
  }

  async function save(next: SiteDraft | null) {
    setBusy(next ? "apply" : "reset");
    setProblem(null);
    const result = await saveSiteContentAction(next);
    setBusy(null);
    if (!result.ok) {
      setProblem(result.error.message);
      return;
    }
    setDraft(null);
    setNotice(next ? "Applied. Your website now uses this design." : "Back to your plain theme.");
    router.refresh();
  }

  const disabled = busy !== null;
  return (
    <section className="mb-6 rounded-xl bg-white p-5 shadow-[0_1px_3px_rgba(35,31,32,0.04)] sm:p-6">
      <h2 className="flex items-center gap-2 font-serif text-xl text-ink">
        <Sparkles className="size-5 text-bronze" aria-hidden /> Design your website with AI
      </h2>
      <p className="mt-1 text-[13px] text-ink-2">
        A few taps is enough. Your names, dates, events and venues always come from your wedding
        details.
      </p>

      <fieldset disabled={disabled} className="mt-5 flex flex-col gap-5">
        <Question label="The vibe" hint="Pick up to 3">
          {(Object.keys(VIBES) as Vibe[]).map((v) => (
            <Chip key={v} on={brief.vibes.includes(v)} onClick={() => toggleVibe(v)}>
              {VIBES[v]}
            </Chip>
          ))}
        </Question>

        <Question label="Colours" hint="Tap one or type your own">
          {(Object.keys(PALETTES) as PaletteId[]).map((id) => {
            const p = PALETTES[id];
            return (
              <Chip
                key={id}
                on={brief.colours === p.label}
                onClick={() => set("colours", brief.colours === p.label ? "" : p.label)}
              >
                <span aria-hidden className="flex -space-x-1">
                  <span
                    className="size-3.5 rounded-full ring-1 ring-white"
                    style={{ background: p.heroSolid }}
                  />
                  <span
                    className="size-3.5 rounded-full ring-1 ring-white"
                    style={{ background: p.accent }}
                  />
                </span>
                {p.label}
              </Chip>
            );
          })}
          <Input
            aria-label="Your own colours"
            value={brief.colours}
            onChange={(e) => set("colours", e.target.value)}
            maxLength={80}
            placeholder="Or type, e.g. peach and mint"
            className="h-8 w-56"
          />
        </Question>

        <div className="flex flex-wrap gap-x-8 gap-y-5">
          <Question label="Tone">
            {(Object.keys(TONES) as Tone[]).map((t) => (
              <Chip
                key={t}
                on={brief.tone === t}
                onClick={() => set("tone", brief.tone === t ? null : t)}
              >
                {TONES[t]}
              </Chip>
            ))}
          </Question>
          <Question label="Language">
            {(Object.keys(LANGUAGES) as Language[]).map((l) => (
              <Chip key={l} on={brief.language === l} onClick={() => set("language", l)}>
                {LANGUAGES[l]}
              </Chip>
            ))}
          </Question>
        </div>

        <label className="flex flex-col gap-1.5 text-sm font-semibold text-ink">
          How did you meet?{" "}
          <span className="font-normal text-ink-2">(optional, for &ldquo;Our story&rdquo;)</span>
          <Textarea
            value={brief.howWeMet}
            onChange={(e) => set("howWeMet", e.target.value)}
            maxLength={600}
            rows={3}
            placeholder="We met in the college library in Pune in 2018. He borrowed my notes and never gave them back…"
            className="font-normal"
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-semibold text-ink">
          Anything else? <span className="font-normal text-ink-2">(optional)</span>
          <Textarea
            value={brief.extra}
            onChange={(e) => set("extra", e.target.value)}
            maxLength={600}
            rows={2}
            placeholder="Our families are from Jodhpur and Kochi. We love chai, dogs and old Bollywood songs."
            className="font-normal"
          />
        </label>
      </fieldset>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <Button type="button" size="lg" onClick={generate} disabled={disabled || !ready}>
          {busy === "generate" ? (
            <Loader2 className="animate-spin" aria-hidden />
          ) : (
            <Sparkles aria-hidden />
          )}
          {draft ? "Try another" : "Design it for me"}
        </Button>
        {hasDesign && !draft ? (
          <Button
            type="button"
            variant="ghost"
            size="lg"
            onClick={() => save(null)}
            disabled={disabled}
          >
            {busy === "reset" ? <Loader2 className="animate-spin" aria-hidden /> : null}
            Go back to my plain theme
          </Button>
        ) : null}
        {busy === "generate" ? (
          <span role="status" className="text-xs text-ink-2">
            Designing&hellip; this takes about 15 seconds.
          </span>
        ) : null}
      </div>

      <div className="mt-4 flex flex-col gap-3">
        {problem ? <FormAlert title="Couldn't do that">{problem}</FormAlert> : null}
        {notice ? (
          <p
            role="status"
            className="rounded-lg border border-forest/20 bg-forest/10 px-3.5 py-3 text-[13px] font-medium text-forest"
          >
            {notice}
          </p>
        ) : null}
      </div>

      {draft ? (
        <div className="mt-5">
          <div className="mb-3 flex flex-wrap items-center gap-3">
            <div className="mr-auto">
              <p className="text-sm font-semibold text-ink">Draft. Nothing is saved yet.</p>
              <p className="text-xs text-ink-2">
                {PALETTES[draft.design.palette].label} · {FONT_PAIRS[draft.design.fonts].label} ·{" "}
                {HERO_NAMES[draft.design.hero]} top ·{" "}
                {draft.design.motif === "none" ? "no motif" : `${draft.design.motif} motif`}
              </p>
            </div>
            <Button type="button" onClick={() => save(draft)} disabled={disabled}>
              {busy === "apply" ? <Loader2 className="animate-spin" aria-hidden /> : null}
              Apply to my website
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setDraft(null)}
              disabled={disabled}
            >
              Discard
            </Button>
          </div>
          <div className="max-h-[75vh] overflow-y-auto rounded-lg border border-line">
            <SiteView
              site={{
                ...site,
                design: draft.design,
                welcome: draft.welcome,
                content: draftToContent(draft),
              }}
            />
          </div>
        </div>
      ) : null}
    </section>
  );
}

function Question({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div role="group" aria-label={label}>
      <p className="mb-2 text-sm font-semibold text-ink">
        {label} {hint ? <span className="font-normal text-ink-2">({hint})</span> : null}
      </p>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}

function Chip({
  on,
  onClick,
  children,
}: {
  on: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={cn(
        "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors",
        on
          ? "border-plum bg-plum text-white"
          : "border-line text-ink-2 hover:border-plum hover:text-ink",
      )}
    >
      {children}
    </button>
  );
}
