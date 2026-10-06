import { CalendarDays, Clock, MapPin, Shirt } from "lucide-react";
import { daysUntil, formatLongDate } from "@/lib/dates";
import { formatTime } from "@/modules/events/schema";
import type { SiteData } from "@/modules/website/schema";
import { themes } from "@/themes";

// The public wedding website. One layout, three looks: every theme renders every section from the
// same data, and a missing part (no welcome message, no events, no venue, no live link) is simply
// left out or shown gently, never broken (PRD 5.9). There is no RSVP form: replies happen only
// through each guest's personal link.
export function SiteView({ site }: { site: SiteData }) {
  const t = themes[site.theme];
  const afterWedding = daysUntil(site.date) < 0;
  const orn = t.ornament ? (
    <div aria-hidden className="mt-2 text-xl opacity-70">
      {t.ornament}
    </div>
  ) : null;

  return (
    <div className={t.page}>
      {site.isPreview ? (
        <div
          role="status"
          className="bg-ink px-4 py-2 text-center text-xs font-semibold text-white"
        >
          Preview. This is how your website looks. Guests can only see it once you turn it on.
        </div>
      ) : null}

      {site.coverUrl ? (
        <div className="aspect-[16/7] max-h-[60vh] w-full overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={site.coverUrl} alt="" className="size-full object-cover" />
        </div>
      ) : null}

      <header className={t.hero}>
        <p className={t.eyebrow}>We&rsquo;re getting married</p>
        <h1 className={t.names}>
          {site.brideName}
          <span className={t.ampersand}>&amp;</span>
          {site.groomName}
        </h1>
        <p className={t.dateLine}>{formatLongDate(site.date)}</p>
        <p className={t.cityLine}>{site.city}</p>
      </header>

      {site.welcome ? (
        <section aria-labelledby="welcome" className={t.section}>
          <h2 id="welcome" className={t.sectionTitle}>
            Welcome
          </h2>
          {orn}
          <p className={t.body}>{site.welcome}</p>
        </section>
      ) : null}

      {site.events.length > 0 ? (
        <>
          <section aria-labelledby="events" className={t.section}>
            <h2 id="events" className={t.sectionTitle}>
              The celebrations
            </h2>
            {orn}
            <ul className="mt-8 grid gap-5 sm:grid-cols-2">
              {site.events.map((e) => (
                <li key={e.id} className={t.card}>
                  {e.coverUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={e.coverUrl}
                      alt=""
                      loading="lazy"
                      className="mb-4 aspect-[16/9] w-full rounded object-cover"
                    />
                  ) : null}
                  <h3 className={t.cardTitle}>{e.name}</h3>
                  <p className={`${t.meta} flex items-center justify-center gap-2`}>
                    <CalendarDays className="size-4 shrink-0" aria-hidden />
                    {formatLongDate(e.date)}
                  </p>
                  <p className={`${t.meta} flex items-center justify-center gap-2`}>
                    <Clock className="size-4 shrink-0" aria-hidden />
                    {formatTime(e.startTime)}
                    {e.endTime ? ` – ${formatTime(e.endTime)}` : ""}
                  </p>
                  {e.dressCode ? (
                    <p className={`${t.meta} flex items-center justify-center gap-2`}>
                      <Shirt className="size-4 shrink-0" aria-hidden />
                      {e.dressCode}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="venues" className={t.section}>
            <h2 id="venues" className={t.sectionTitle}>
              Where to find us
            </h2>
            {orn}
            <ul className="mt-8 grid gap-5 sm:grid-cols-2">
              {site.events.map((e) => (
                <li key={e.id} className={t.card}>
                  <h3 className={t.cardTitle}>{e.name}</h3>
                  <p className={`${t.meta} flex items-center justify-center gap-2`}>
                    <MapPin className="size-4 shrink-0" aria-hidden />
                    {e.venueName ?? "Venue to be announced"}
                  </p>
                  {e.address ? <p className={t.meta}>{e.address}</p> : null}
                  {e.mapsUrl ? (
                    <p className="mt-3">
                      <a
                        href={e.mapsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={t.link}
                      >
                        Open in Google Maps
                      </a>
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>
        </>
      ) : null}

      {site.live ? (
        <section aria-labelledby="live" className={t.section}>
          <h2 id="live" className={t.sectionTitle}>
            {afterWedding ? "Watch the wedding" : "Watch the wedding live"}
          </h2>
          {orn}
          <div className="mt-8 aspect-video w-full overflow-hidden rounded-lg bg-black">
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
          <p className={t.note}>
            Can&rsquo;t see it?{" "}
            <a
              href={site.live.watchUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={t.link}
            >
              Open it on YouTube
            </a>
          </p>
        </section>
      ) : null}

      {site.galleryUrl ? (
        <section aria-labelledby="gallery" className={t.section}>
          <h2 id="gallery" className={t.sectionTitle}>
            Photo gallery
          </h2>
          {orn}
          <p className={t.body}>See the photos from the wedding, and add your own.</p>
          <p className="mt-4">
            <a href={site.galleryUrl} target="_blank" rel="noopener noreferrer" className={t.link}>
              Open the photo gallery
            </a>
          </p>
        </section>
      ) : null}

      <footer className={t.footer}>
        {site.brideName} &amp; {site.groomName} · {formatLongDate(site.date)}
      </footer>
    </div>
  );
}
