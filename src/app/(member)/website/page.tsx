import type { Metadata } from "next";
import { WebsiteSettingsForm } from "@/components/site/website-settings-form";
import { requireMember } from "@/lib/authz";
import { absoluteUrl } from "@/lib/app-url";
import { getWedding } from "@/modules/wedding/service";

export const metadata: Metadata = { title: "Wedding website — Make My Marriage" };

export default async function WebsitePage() {
  const ctx = await requireMember();
  const wedding = await getWedding(ctx.weddingId);
  if (!wedding) return null;
  const site = wedding.website;
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
      <WebsiteSettingsForm
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
