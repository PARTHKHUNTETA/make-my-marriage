import type { Metadata } from "next";
import Link from "next/link";
import { ExternalLink, Eye } from "lucide-react";
import { AiWebsitePanel } from "@/components/site/ai-website-panel";
import { WebsiteSettingsForm } from "@/components/site/website-settings-form";
import { aiProvider } from "@/lib/ai";
import { requirePagePermission } from "@/lib/page-guard";
import { absoluteUrl } from "@/lib/app-url";
import { getWedding } from "@/modules/wedding/service";
import { getSitePreview } from "@/modules/website/service";

export const metadata: Metadata = { title: "Wedding website — Make My Marriage" };

export default async function WebsitePage() {
  const ctx = await requirePagePermission("wedding.update");
  const wedding = await getWedding(ctx.weddingId);
  if (!wedding) return null;
  const site = wedding.website;
  // The AI panel shows only when a provider is set up on this server.
  const preview = aiProvider() ? await getSitePreview(ctx.weddingId) : null;
  const address = absoluteUrl(`/${site.slug}`);
  return (
    <main className="mx-auto w-full max-w-3xl pt-6">
      <p className="text-xs font-semibold tracking-[0.6px] text-bronze uppercase">
        Wedding experience
      </p>
      <h1 className="mt-1 font-serif text-4xl leading-11 tracking-tight text-plum">
        Wedding website
      </h1>
      <p className="mt-1 mb-6 text-sm text-ink-2">
        A page for your guests with your events, venues and, if you like, a live video. It updates
        itself when you change your wedding details and events.
      </p>
      {/* Where the site is and how to see it, before any of the settings. */}
      <section className="mb-6 flex flex-col gap-4 rounded-xl bg-white p-5 shadow-[0_1px_3px_rgba(35,31,32,0.04)] sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm font-semibold text-ink">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                site.isOn ? "bg-forest/10 text-forest" : "bg-rose-100 text-ink-2"
              }`}
            >
              <span
                aria-hidden
                className={`size-1.5 rounded-full ${site.isOn ? "bg-forest" : "bg-ink-2/60"}`}
              />
              {site.isOn ? "Live" : "Off"}
            </span>
            Your website
          </p>
          <p className="mt-1 truncate font-mono text-[13px] text-ink-2">{address}</p>
          {site.isOn ? null : (
            <p className="mt-1 text-xs text-ink-2">
              Guests can&rsquo;t open it yet. Preview it, then{" "}
              <a href="#show-site" className="font-semibold text-bronze hover:underline">
                turn it on
              </a>{" "}
              to share.
            </p>
          )}
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Link
            href="/website/preview"
            className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-plum px-4 text-sm font-semibold text-white hover:bg-plum/90"
          >
            <Eye className="size-4" aria-hidden /> Preview
          </Link>
          {site.isOn ? (
            <a
              href={address}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-white px-4 text-sm font-semibold text-plum ring-1 ring-line hover:bg-rose-100"
            >
              Open site <ExternalLink className="size-3.5" aria-hidden />
            </a>
          ) : null}
        </div>
      </section>

      {preview ? <AiWebsitePanel site={preview} hasDesign={Boolean(site.content)} /> : null}
      <WebsiteSettingsForm
        aiDesign={Boolean(site.content?.design)}
        siteBase={absoluteUrl("/")}
        initial={{
          isOn: site.isOn,
          theme: site.theme,
          slug: site.slug,
          showLive: site.showLive,
          showGallery: site.showGallery,
          youtubeUrl: site.youtubeUrl ?? "",
        }}
      />
    </main>
  );
}
