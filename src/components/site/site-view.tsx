import { CalendarDays, Camera, Clock, MapPin, Shirt } from "lucide-react";
import { daysToGoLabel, daysUntil, formatLongDate } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { formatTime } from "@/modules/events/schema";
import type { SiteData, SiteEvent } from "@/modules/website/schema";
import { siteFontVariables } from "@/themes/fonts";
import { FONT_PAIRS, PALETTES, type FontPair, type MotifId, type Palette } from "@/themes/kit";
import { Garland, Lotus, Mandala, MotifDivider, Toran } from "./motifs";

// The public wedding website. One layout, styled by a design from the kit (a palette, a font
// pairing, a hero layout and a motif): a theme's preset, or the AI's choice. Every part is built
// from the same data, and a missing part (no welcome, no events, no venue, no live link) is simply
// left out, never broken (PRD 5.9). There is no RSVP form: replies happen only through each guest's
// personal link.

type Look = { p: Palette; f: FontPair; motif: MotifId };

export function SiteView({ site }: { site: SiteData }) {
  const look: Look = {
    p: PALETTES[site.design.palette],
    f: FONT_PAIRS[site.design.fonts],
    motif: site.design.motif,
  };
  const { p, f } = look;
  const words = site.content;
  const afterWedding = daysUntil(site.date) < 0;
  const venues = uniqueVenues(site.events);

  return (
    <div
      className={cn(siteFontVariables, "min-h-screen leading-relaxed", f.bodyClass)}
      style={{ backgroundColor: p.bg, color: p.ink, fontFamily: f.body }}
    >
      {site.isPreview ? (
        <div
          role="status"
          className="bg-ink px-4 py-2 text-center font-sans text-xs font-semibold text-white"
        >
          Preview. This is how your website looks. Guests can only see it once you turn it on.
        </div>
      ) : null}

      <Hero site={site} look={look} tagline={words?.tagline} />

      {site.welcome ? (
        <Section look={look} id="welcome" title="Welcome" hideTitle>
          <p
            className="mx-auto max-w-2xl text-xl leading-9 whitespace-pre-line sm:text-2xl sm:leading-10"
            style={{ fontFamily: f.heading === f.names ? f.body : f.heading }}
          >
            {site.welcome}
          </p>
        </Section>
      ) : null}

      {words?.story ? (
        <Section look={look} id="story" title={words.story.title}>
          <div
            className="mx-auto mt-8 max-w-2xl rounded-3xl px-6 py-8 text-left whitespace-pre-line sm:px-10"
            style={{ backgroundColor: p.surface, boxShadow: `0 0 0 1px ${p.accent}55` }}
          >
            {words.story.body}
          </div>
        </Section>
      ) : null}

      {site.events.length > 0 ? (
        <Section look={look} id="events" title={words?.eventsTitle ?? "The celebrations"}>
          <Timeline events={site.events} look={look} />
        </Section>
      ) : null}

      {venues.length > 0 ? (
        <Section look={look} id="venues" title={words?.venuesTitle ?? "Where to find us"}>
          <ul
            className={cn(
              "mt-10 grid gap-5 text-left",
              venues.length > 1 ? "sm:grid-cols-2" : "mx-auto max-w-md",
            )}
          >
            {venues.map((v) => (
              <li key={v.key} className="rounded-2xl p-6" style={card(p)}>
                <p
                  className={cn("text-xl", f.headingClass)}
                  style={{ fontFamily: f.heading, color: p.heading }}
                >
                  {v.venueName ?? "Venue to be announced"}
                </p>
                <p className="mt-1 text-sm opacity-80">{v.events.join(" · ")}</p>
                {v.address ? (
                  <p className="mt-3 flex gap-2 text-[0.94em]">
                    <MapPin className="mt-1 size-4 shrink-0" aria-hidden />
                    {v.address}
                  </p>
                ) : null}
                {v.mapsUrl ? (
                  <a
                    href={v.mapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-4 inline-block rounded-full px-4 py-2 text-sm font-semibold"
                    style={{ backgroundColor: p.heading, color: p.bg }}
                  >
                    Open in Google Maps
                  </a>
                ) : null}
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {site.live ? (
        <Section
          look={look}
          id="live"
          title={afterWedding ? "Watch the wedding" : "Watch the wedding live"}
        >
          <div
            className="mt-8 aspect-video w-full overflow-hidden rounded-2xl bg-black"
            style={{ boxShadow: `0 0 0 6px ${p.surface}, 0 0 0 7px ${p.accent}` }}
          >
            <iframe
              src={site.live.embedUrl}
              title={afterWedding ? "The wedding video" : "The wedding live stream"}
              loading="lazy"
              allow="encrypted-media; picture-in-picture; fullscreen"
              allowFullScreen
              referrerPolicy="strict-origin-when-cross-origin"
              sandbox="allow-scripts allow-same-origin allow-presentation allow-popups allow-popups-to-escape-sandbox"
              className="size-full border-0"
            />
          </div>
          <p className="mt-4 text-sm opacity-80">
            Can&rsquo;t see it?{" "}
            <a href={site.live.watchUrl} target="_blank" rel="noopener noreferrer" style={link(p)}>
              Open it on YouTube
            </a>
          </p>
        </Section>
      ) : null}

      {site.galleryUrl ? (
        <Section look={look} id="gallery" title="Photo gallery">
          <div className="mx-auto mt-8 max-w-md rounded-3xl px-6 py-8" style={card(p)}>
            <Camera className="mx-auto size-8" style={{ color: p.heading }} aria-hidden />
            <p className="mt-3">See the photos from the wedding, and add your own.</p>
            <a
              href={site.galleryUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-5 inline-block rounded-full px-5 py-2.5 text-sm font-semibold"
              style={{ backgroundColor: p.heading, color: p.bg }}
            >
              Open the photo gallery
            </a>
          </div>
        </Section>
      ) : null}

      {words && words.faqs.length > 0 ? (
        <Section look={look} id="faqs" title="Good to know">
          <div className="mx-auto mt-8 max-w-2xl space-y-3 text-left">
            {words.faqs.map((faq, i) => (
              <details
                key={i}
                className="group rounded-2xl px-5 py-4"
                style={card(p)}
                open={i === 0}
              >
                <summary
                  className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold"
                  style={{ color: p.heading }}
                >
                  {faq.q}
                  <span
                    aria-hidden
                    className="text-xl leading-none transition-transform group-open:rotate-45"
                  >
                    +
                  </span>
                </summary>
                <p className="mt-2">{faq.a}</p>
              </details>
            ))}
          </div>
        </Section>
      ) : null}

      {words?.closingNote ? (
        <section aria-label="A note from the couple" className="px-6 py-16 text-center sm:py-20">
          {look.motif !== "none" ? (
            <div style={{ color: p.accent }}>
              <MotifMark motif={look.motif} className="mx-auto h-16 w-16" />
            </div>
          ) : null}
          <p
            className={cn("mx-auto mt-6 max-w-2xl text-2xl leading-snug sm:text-3xl")}
            style={{ fontFamily: f.heading, color: p.heading }}
          >
            {words.closingNote}
          </p>
        </section>
      ) : null}

      <footer className="px-6 py-12 text-center" style={{ background: p.heroBg, color: p.heroInk }}>
        <p className={cn("text-3xl sm:text-4xl", f.namesClass)} style={{ fontFamily: f.names }}>
          {site.brideName} <span style={{ color: p.heroAccent }}>&amp;</span> {site.groomName}
        </p>
        <p className="mt-2 text-sm tracking-[0.2em] uppercase opacity-85">
          {formatLongDate(site.date)} · {site.city}
        </p>
      </footer>
    </div>
  );
}

// ---- Hero ----------------------------------------------------------------------------------

function Hero({ site, look, tagline }: { site: SiteData; look: Look; tagline?: string }) {
  const { p } = look;
  const hero = site.design.hero === "photo" && !site.coverUrl ? "classic" : site.design.hero;

  if (hero === "photo") {
    return (
      <header className="relative isolate flex min-h-[88vh] items-end overflow-hidden px-6 pt-24 pb-16 text-center text-white sm:items-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={site.coverUrl} alt="" className="absolute inset-0 -z-20 size-full object-cover" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-t from-black/80 via-black/45 to-black/25" />
        <div className="mx-auto w-full max-w-3xl">
          <HeroText site={site} look={look} tagline={tagline} ink="#ffffff" />
        </div>
      </header>
    );
  }

  const decor = <HeroDecor motif={look.motif} color={p.heroAccent} />;

  if (hero === "arch") {
    return (
      <header
        className="relative isolate overflow-hidden px-5 pt-16 pb-14 text-center sm:pt-24 sm:pb-20"
        style={{ background: p.heroBg, color: p.heroInk }}
      >
        {decor}
        <div
          className="relative mx-auto max-w-xl rounded-t-[999px] px-5 pt-14 pb-10 sm:px-12 sm:pt-20"
          style={{
            boxShadow: `inset 0 0 0 2px ${p.heroAccent}`,
            outline: `1px solid ${p.heroAccent}55`,
            outlineOffset: "8px",
          }}
        >
          {site.coverUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={site.coverUrl}
              alt=""
              className="mx-auto mb-8 aspect-[4/5] w-48 rounded-t-[999px] object-cover sm:w-60"
              style={{ boxShadow: `0 0 0 4px ${p.heroAccent}` }}
            />
          ) : null}
          <HeroText site={site} look={look} tagline={tagline} ink={p.heroInk} stacked />
        </div>
      </header>
    );
  }

  if (hero === "monogram") {
    const initials = `${initial(site.brideName)}${initial(site.groomName)}`;
    return (
      <>
        <header
          className="relative isolate overflow-hidden px-6 py-20 text-center sm:py-28"
          style={{ background: p.heroBg, color: p.heroInk }}
        >
          {look.motif === "mandala" ? null : decor}
          <div className="relative mx-auto grid size-36 place-items-center sm:size-44">
            <div style={{ color: p.heroAccent }} className="absolute inset-0 opacity-60">
              <Mandala className="size-full" />
            </div>
            <div
              className="grid size-24 place-items-center rounded-full sm:size-28"
              style={{
                background: p.heroSolid,
                boxShadow: `0 0 0 2px ${p.heroAccent}, 0 0 0 6px ${p.heroSolid}, 0 0 0 7px ${p.heroAccent}`,
              }}
            >
              <span
                className="text-3xl tracking-widest sm:text-4xl"
                style={{ fontFamily: look.f.names, color: p.heroInk }}
              >
                {initials}
              </span>
            </div>
          </div>
          <div className="mt-8">
            <HeroText site={site} look={look} tagline={tagline} ink={p.heroInk} />
          </div>
        </header>
        {site.coverUrl ? <CoverStrip src={site.coverUrl} /> : null}
      </>
    );
  }

  // classic
  return (
    <header
      className="relative isolate overflow-hidden px-6 pt-20 pb-20 text-center sm:pt-28 sm:pb-28"
      style={{ background: p.heroBg, color: p.heroInk }}
    >
      {decor}
      {site.coverUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={site.coverUrl}
          alt=""
          className="relative mx-auto mb-8 size-40 rounded-full object-cover sm:size-48"
          style={{ boxShadow: `0 0 0 4px ${p.heroSolid}, 0 0 0 6px ${p.heroAccent}` }}
        />
      ) : null}
      <div className="relative">
        <HeroText site={site} look={look} tagline={tagline} ink={p.heroInk} />
      </div>
    </header>
  );
}

function HeroText({
  site,
  look,
  tagline,
  ink,
  stacked = false,
}: {
  site: SiteData;
  look: Look;
  tagline?: string;
  ink: string;
  // Each name on its own line at a smaller size, for narrow frames like the arch.
  stacked?: boolean;
}) {
  const { p, f } = look;
  const days = daysUntil(site.date);
  const script = site.design.fonts === "romantic";
  return (
    <div style={{ color: ink }}>
      <p className="text-xs font-semibold tracking-[0.35em] uppercase opacity-85 sm:text-sm">
        We&rsquo;re getting married
      </p>
      <h1
        className={cn(
          "mt-5 leading-[1.05] break-words",
          script
            ? stacked
              ? "text-6xl sm:text-7xl"
              : "text-6xl sm:text-8xl"
            : stacked
              ? "text-4xl sm:text-5xl"
              : "text-4xl sm:text-6xl lg:text-7xl",
          f.namesClass,
        )}
        style={{ fontFamily: f.names }}
      >
        <span className={cn("block", !stacked && "sm:inline")}>{site.brideName}</span>
        <span
          className={cn(
            script ? "mx-4 block" : "mx-3 block",
            !stacked && "sm:inline",
            stacked && "my-1",
            script ? "text-5xl sm:text-6xl" : "",
          )}
          style={{ color: p.heroAccent, fontFamily: script ? f.names : f.heading }}
        >
          &amp;
        </span>
        <span className={cn("block", !stacked && "sm:inline")}>{site.groomName}</span>
      </h1>
      {tagline ? (
        <p
          className="mx-auto mt-6 max-w-xl text-lg italic sm:text-xl"
          style={{ fontFamily: f.heading === f.names && !script ? f.body : f.heading }}
        >
          {tagline}
        </p>
      ) : null}
      <p className="mt-6 text-base tracking-[0.25em] uppercase sm:text-lg">
        {formatLongDate(site.date)}
      </p>
      <p className="mt-1 text-sm tracking-[0.2em] uppercase opacity-85">{site.city}</p>
      {days >= 0 ? (
        <p
          className="mt-6 inline-block rounded-full px-4 py-1.5 text-sm font-semibold"
          style={{ boxShadow: `inset 0 0 0 1px ${ink}66` }}
        >
          {daysToGoLabel(days)}
        </p>
      ) : null}
    </div>
  );
}

function HeroDecor({ motif, color }: { motif: MotifId; color: string }) {
  if (motif === "none") return null;
  if (motif === "toran") {
    return (
      <div aria-hidden className="absolute inset-x-0 top-0 -z-10" style={{ color }}>
        <Toran className="h-14 w-full sm:h-20" />
      </div>
    );
  }
  if (motif === "marigold") {
    return (
      <div aria-hidden className="absolute inset-x-0 top-0 -z-10" style={{ color }}>
        <Garland className="h-12 w-full sm:h-16" swags={4} />
      </div>
    );
  }
  if (motif === "lotus") {
    return (
      <div
        aria-hidden
        className="absolute inset-x-0 bottom-0 -z-10 flex justify-between px-2 opacity-40"
        style={{ color }}
      >
        <Lotus className="h-20 w-32 sm:h-28 sm:w-44" />
        <Lotus className="h-20 w-32 sm:h-28 sm:w-44" />
      </div>
    );
  }
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute top-1/2 left-1/2 -z-10 size-[30rem] -translate-x-1/2 -translate-y-1/2 opacity-[0.14] sm:size-[42rem]"
      style={{ color }}
    >
      <Mandala className="size-full" />
    </div>
  );
}

function CoverStrip({ src }: { src: string }) {
  return (
    <div className="aspect-[16/7] max-h-[60vh] w-full overflow-hidden">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="" className="size-full object-cover" />
    </div>
  );
}

// ---- Sections ------------------------------------------------------------------------------

function Section({
  look,
  id,
  title,
  hideTitle,
  children,
}: {
  look: Look;
  id: string;
  title: string;
  hideTitle?: boolean;
  children: React.ReactNode;
}) {
  const { p, f } = look;
  return (
    <section aria-labelledby={id} className="mx-auto max-w-4xl px-6 py-14 text-center sm:py-20">
      <h2
        id={id}
        className={cn(hideTitle ? "sr-only" : "text-3xl sm:text-4xl", f.headingClass)}
        style={{ fontFamily: f.heading, color: p.heading }}
      >
        {title}
      </h2>
      <MotifDivider motif={look.motif} color={p.accent} />
      {children}
    </section>
  );
}

function Timeline({ events, look }: { events: SiteEvent[]; look: Look }) {
  const { p, f } = look;
  const days = groupByDay(events);
  return (
    <div className="mt-10 space-y-10 text-left">
      {days.map((day, d) => (
        <div key={day.label}>
          {days.length > 1 ? (
            <p className="mb-4 text-center text-sm font-semibold tracking-[0.2em] uppercase">
              <span
                className="rounded-full px-4 py-1.5"
                style={{ backgroundColor: p.surface, boxShadow: `inset 0 0 0 1px ${p.accent}` }}
              >
                Day {d + 1} · {day.label}
              </span>
            </p>
          ) : null}
          <ol
            className={cn(
              "grid gap-5",
              day.events.length > 1 ? "sm:grid-cols-2" : "mx-auto max-w-md",
            )}
          >
            {day.events.map((e) => (
              <li key={e.id} className="overflow-hidden rounded-2xl" style={card(p)}>
                {e.coverUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={e.coverUrl}
                    alt=""
                    loading="lazy"
                    className="aspect-[16/9] w-full object-cover"
                  />
                ) : (
                  <div aria-hidden className="h-1.5" style={{ backgroundColor: p.accent }} />
                )}
                <div className="p-6">
                  <h3
                    className={cn("text-2xl", f.headingClass)}
                    style={{ fontFamily: f.heading, color: p.heading }}
                  >
                    {e.name}
                  </h3>
                  <dl className="mt-3 space-y-1.5 text-[0.94em]">
                    <Fact icon={<CalendarDays className="size-4" aria-hidden />} label="Date">
                      {formatLongDate(e.date)}
                    </Fact>
                    <Fact icon={<Clock className="size-4" aria-hidden />} label="Time">
                      {formatTime(e.startTime)}
                      {e.endTime ? ` – ${formatTime(e.endTime)}` : ""}
                    </Fact>
                    <Fact icon={<MapPin className="size-4" aria-hidden />} label="Venue">
                      {e.venueName ?? "Venue to be announced"}
                    </Fact>
                    {e.dressCode ? (
                      <Fact icon={<Shirt className="size-4" aria-hidden />} label="Dress code">
                        {e.dressCode}
                      </Fact>
                    ) : null}
                  </dl>
                </div>
              </li>
            ))}
          </ol>
        </div>
      ))}
    </div>
  );
}

function Fact({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <dt className="mt-1 shrink-0 opacity-70">
        {icon}
        <span className="sr-only">{label}</span>
      </dt>
      <dd>{children}</dd>
    </div>
  );
}

function MotifMark({ motif, className }: { motif: MotifId; className?: string }) {
  if (motif === "lotus") return <Lotus className={className} />;
  if (motif === "mandala") return <Mandala className={className} />;
  if (motif === "toran") return <Toran className={cn(className, "w-48")} />;
  return <Garland className={cn(className, "w-48")} swags={2} />;
}

// ---- helpers -------------------------------------------------------------------------------

const card = (p: Palette): React.CSSProperties => ({
  backgroundColor: p.surface,
  boxShadow: `0 0 0 1px ${p.accent}66, 0 10px 30px -18px ${p.ink}55`,
});

const link = (p: Palette): React.CSSProperties => ({
  color: p.heading,
  fontWeight: 600,
  textDecoration: "underline",
  textDecorationColor: p.accent,
  textUnderlineOffset: "4px",
});

const initial = (name: string) => name.trim().charAt(0).toUpperCase();

function groupByDay(events: SiteEvent[]): { label: string; events: SiteEvent[] }[] {
  const days = new Map<string, SiteEvent[]>();
  for (const e of events) {
    const label = formatLongDate(e.date);
    days.set(label, [...(days.get(label) ?? []), e]);
  }
  return [...days].map(([label, list]) => ({ label, events: list }));
}

// Each place once, with the events held there. Events with no place at all are left out here (they
// already say "Venue to be announced" in the timeline).
function uniqueVenues(events: SiteEvent[]) {
  const venues = new Map<
    string,
    { key: string; venueName?: string; address?: string; mapsUrl: string | null; events: string[] }
  >();
  for (const e of events) {
    if (!e.venueName && !e.address) continue;
    const key = `${e.venueName ?? ""}|${e.address ?? ""}`.toLowerCase();
    const found = venues.get(key);
    if (found) found.events.push(e.name);
    else
      venues.set(key, {
        key,
        venueName: e.venueName,
        address: e.address,
        mapsUrl: e.mapsUrl,
        events: [e.name],
      });
  }
  return [...venues.values()];
}
