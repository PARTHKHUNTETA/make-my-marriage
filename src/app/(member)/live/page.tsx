import type { Metadata } from "next";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { LiveStreamForm } from "@/components/site/live-stream-form";
import { absoluteUrl } from "@/lib/app-url";
import { requireMember } from "@/lib/authz";
import { parseYouTube } from "@/lib/youtube";
import { getWedding } from "@/modules/wedding/service";

export const metadata: Metadata = { title: "Live stream — Make My Marriage" };
export const dynamic = "force-dynamic";

const card = "rounded-xl bg-white p-5 shadow-[0_1px_3px_rgba(35,31,32,0.04)] sm:p-6";

// Live streaming is a YouTube link shown on the wedding website; the product builds no streaming of
// its own (PRD 5.11). This page is where the family sets it up and checks it before the day.
export default async function LiveStreamPage() {
  const ctx = await requireMember();
  const wedding = await getWedding(ctx.weddingId);
  if (!wedding) return null;
  const { showLive, youtubeUrl, isOn, slug } = wedding.website;
  const video = youtubeUrl ? parseYouTube(youtubeUrl) : null;
  const siteUrl = `${absoluteUrl("/")}${slug}`;
  const live = showLive && Boolean(video);

  return (
    <main className="mx-auto w-full max-w-3xl pt-6">
      <p className="text-xs font-semibold tracking-[0.6px] text-bronze uppercase">
        Wedding experience
      </p>
      <h1 className="mt-1 font-serif text-4xl leading-11 tracking-tight text-plum">Live stream</h1>
      <p className="mt-1 mb-6 text-sm text-ink-2">
        Let family who cannot travel watch the wedding. Stream on YouTube and paste the link here;
        we show it on your wedding website.
      </p>

      <div className="flex flex-col gap-5">
        <section
          aria-label="Status"
          className={`${card} flex flex-wrap items-center justify-between gap-3`}
        >
          <div>
            <span
              className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                live && isOn ? "bg-forest/15 text-forest" : "bg-rose-200 text-ink-2"
              }`}
            >
              {live && isOn ? "Showing on your website" : "Not showing to guests"}
            </span>
            <p className="mt-2 text-[13px] text-ink-2">
              {!video
                ? "Add a YouTube link below to get started."
                : !showLive
                  ? "The link is saved, but the live section is switched off."
                  : !isOn
                    ? "The live section is on, but your wedding website is switched off, so guests cannot see it yet."
                    : "Guests see it on your wedding website now."}
            </p>
          </div>
          {!isOn && video ? (
            <Link href="/website" className="text-[13px] font-semibold text-bronze hover:underline">
              Turn on your website
            </Link>
          ) : null}
          {isOn ? (
            <a
              href={siteUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[13px] font-semibold text-bronze hover:underline"
            >
              Open your website <ExternalLink className="size-3.5" aria-hidden />
            </a>
          ) : null}
        </section>

        <section className={card}>
          <h2 className="font-serif text-xl text-ink">Your stream</h2>
          <div className="mt-3">
            <LiveStreamForm initial={{ showLive, youtubeUrl: youtubeUrl ?? "" }} />
          </div>
          <p className="mt-4 rounded-lg bg-rose-50 p-3 text-xs text-ink-2">
            Tip: in YouTube, set the stream to <strong>Unlisted</strong> and allow embedding, so
            only people with your website can find it. If a guest cannot see the video, the site
            also offers a link to open it on YouTube.
          </p>
        </section>

        {video ? (
          <section className={card} aria-label="Preview">
            <h2 className="font-serif text-xl text-ink">Preview</h2>
            <p className="mt-1 text-[13px] text-ink-2">
              This is how the player looks to your guests. If it says the video is unavailable,
              check the embedding setting in YouTube.
            </p>
            <div className="mt-3 aspect-video w-full overflow-hidden rounded-lg bg-black">
              <iframe
                src={video.embedUrl}
                title="Preview of your live stream"
                loading="lazy"
                allow="encrypted-media; picture-in-picture; fullscreen"
                allowFullScreen
                referrerPolicy="strict-origin-when-cross-origin"
                sandbox="allow-scripts allow-same-origin allow-presentation allow-popups allow-popups-to-escape-sandbox"
                className="size-full border-0"
              />
            </div>
            <p className="mt-2 text-[13px]">
              <a
                href={video.watchUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-bronze hover:underline"
              >
                Open it on YouTube
              </a>
            </p>
          </section>
        ) : null}
      </div>
    </main>
  );
}
