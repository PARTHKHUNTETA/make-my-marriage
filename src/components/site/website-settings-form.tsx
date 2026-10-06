"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { ExternalLink, Eye } from "lucide-react";
import { useForm, useWatch } from "react-hook-form";
import { Field } from "@/components/auth/field";
import { FormAlert } from "@/components/auth/form-alert";
import { SubmitButton } from "@/components/auth/submit-button";
import { saveWebsiteSettingsAction } from "@/modules/website/actions";
import {
  THEME_INFO,
  websiteSettingsSchema,
  type WebsiteSettingsFormValues,
  type WebsiteSettingsInput,
} from "@/modules/website/schema";
import { THEMES } from "@/modules/wedding/schema";

const FIELDS = ["slug", "youtubeUrl", "theme"] as const;

export function WebsiteSettingsForm({
  initial,
  siteBase,
}: {
  initial: WebsiteSettingsFormValues;
  // The address people type, up to the slug: "https://makemymarriage.com/".
  siteBase: string;
}) {
  const router = useRouter();
  const [saved, setSaved] = React.useState(false);
  const [problem, setProblem] = React.useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    reset,
    getValues,
    control,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<WebsiteSettingsFormValues, undefined, WebsiteSettingsInput>({
    resolver: zodResolver(websiteSettingsSchema),
    defaultValues: initial,
  });
  const [theme, slug, showLive] = useWatch({
    control,
    name: ["theme", "slug", "showLive"],
  });
  const savedSlug = initial.slug;

  async function onSubmit() {
    setProblem(null);
    setSaved(false);
    const raw = getValues();
    const result = await saveWebsiteSettingsAction(raw);
    if (result.ok) {
      reset(raw);
      setSaved(true);
      router.refresh();
      return;
    }
    const { code, message, details } = result.error;
    if (code === "VALIDATION_FAILED" && details && typeof details === "object") {
      let shown = false;
      for (const field of FIELDS) {
        const first = (details as Record<string, string[] | undefined>)[field]?.[0];
        if (first) {
          setError(field, { message: first });
          shown = true;
        }
      }
      if (shown) return;
    }
    setProblem(message);
  }

  const liveUrl = `${siteBase}${savedSlug}`;
  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      onChange={() => setSaved(false)}
      noValidate
      className="flex flex-col gap-6"
    >
      <fieldset disabled={isSubmitting} className="flex flex-col gap-6">
        {problem ? <FormAlert title="Couldn't save your website">{problem}</FormAlert> : null}
        {saved ? (
          <p
            role="status"
            className="rounded-lg border border-forest/20 bg-forest/10 px-3.5 py-3 text-[13px] font-medium text-forest"
          >
            Saved.
          </p>
        ) : null}

        <section className="rounded-xl bg-white p-5 shadow-[0_1px_3px_rgba(35,31,32,0.04)] sm:p-6">
          <label className="flex items-start gap-3 text-sm text-ink">
            <input type="checkbox" className="mt-0.5 size-4 accent-plum" {...register("isOn")} />
            <span>
              <strong>Show my wedding website</strong>
              <span className="block text-xs text-ink-2">
                Off: nobody can open it, not even with the link. It is never listed on search
                engines either way.
              </span>
            </span>
          </label>
          <p className="mt-4 text-[13px] text-ink-2">
            {initial.isOn ? (
              <>
                Live at{" "}
                <a
                  href={liveUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 font-semibold text-bronze hover:underline"
                >
                  {liveUrl} <ExternalLink className="size-3.5" aria-hidden />
                </a>
              </>
            ) : (
              "Your site is off. Preview it first, then turn it on to share."
            )}
          </p>
          <p className="mt-2">
            <Link
              href="/website/preview"
              className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-bronze hover:underline"
            >
              <Eye className="size-4" aria-hidden /> Preview your website
            </Link>
            {isDirty ? (
              <span className="ml-2 text-xs text-ink-2">(shows what you last saved)</span>
            ) : null}
          </p>
        </section>

        <section className="rounded-xl bg-white p-5 shadow-[0_1px_3px_rgba(35,31,32,0.04)] sm:p-6">
          <h2 className="font-serif text-xl text-ink">Theme</h2>
          <p className="mt-1 mb-3 text-[13px] text-ink-2">
            Switch any time. Your content comes with you.
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            {THEMES.map((value) => (
              <label
                key={value}
                className={`flex cursor-pointer flex-col gap-1 rounded-lg border p-4 text-sm ${
                  theme === value ? "border-plum bg-plum/5" : "border-line"
                }`}
              >
                <input type="radio" value={value} className="sr-only" {...register("theme")} />
                <span className="font-semibold text-ink">{THEME_INFO[value].name}</span>
                <span className="text-xs text-ink-2">{THEME_INFO[value].feel}</span>
              </label>
            ))}
          </div>
          {errors.theme?.message ? (
            <p role="alert" className="mt-2 text-xs text-destructive">
              {errors.theme.message}
            </p>
          ) : null}
        </section>

        <section className="rounded-xl bg-white p-5 shadow-[0_1px_3px_rgba(35,31,32,0.04)] sm:p-6">
          <h2 className="font-serif text-xl text-ink">Web address</h2>
          <div className="mt-3 max-w-md">
            <Field
              id="slug"
              label="Address"
              autoComplete="off"
              hint={`${siteBase}${slug || "your-address"}`}
              error={errors.slug?.message}
              {...register("slug")}
            />
          </div>
          {slug !== savedSlug ? (
            <p className="mt-2 text-xs text-bronze">
              Changing it stops the old address from working, so share the new one again.
            </p>
          ) : null}
        </section>

        <section className="rounded-xl bg-white p-5 shadow-[0_1px_3px_rgba(35,31,32,0.04)] sm:p-6">
          <h2 className="font-serif text-xl text-ink">Live stream</h2>
          <label className="mt-3 flex items-start gap-3 text-sm text-ink">
            <input
              type="checkbox"
              className="mt-0.5 size-4 accent-plum"
              {...register("showLive")}
            />
            <span>
              Show a live video on the website
              <span className="block text-xs text-ink-2">
                After the stream ends, the same link plays YouTube&rsquo;s recording.
              </span>
            </span>
          </label>
          <div className="mt-4 max-w-xl">
            <Field
              id="youtubeUrl"
              label="YouTube link"
              autoComplete="off"
              placeholder="https://www.youtube.com/live/..."
              error={errors.youtubeUrl?.message}
              {...register("youtubeUrl")}
            />
          </div>
          {showLive && !getValues("youtubeUrl") ? (
            <p className="mt-2 text-xs text-bronze">Add a link and the live section will appear.</p>
          ) : null}
          <p className="mt-3 rounded-lg bg-rose-50 p-3 text-xs text-ink-2">
            Tip: in YouTube, set the stream to <strong>Unlisted</strong> and allow embedding, so
            only people with your website can find it.
          </p>
        </section>

        <div className="w-full sm:w-auto sm:min-w-56">
          <SubmitButton pending={isSubmitting} pendingLabel="Saving...">
            Save website settings
          </SubmitButton>
        </div>
      </fieldset>
    </form>
  );
}
