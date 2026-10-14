import type { Metadata } from "next";
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
