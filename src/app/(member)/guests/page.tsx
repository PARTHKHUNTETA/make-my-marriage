import type { Metadata } from "next";
import Link from "next/link";
import { UserPlus } from "lucide-react";
import { GuestFilters } from "@/components/guests/guest-filters";
import { GuestRow } from "@/components/guests/guest-row";
import { GuestsHeader, StatCard } from "@/components/guests/guests-header";
import { WhatsappMessageForm } from "@/components/guests/whatsapp-message-form";
import { requireMember } from "@/lib/authz";
import { absoluteUrl } from "@/lib/app-url";
import { listEvents } from "@/modules/events/service";
import { parseGuestQuery } from "@/modules/guests/schema";
import { getStats, listGuests } from "@/modules/guests/service";
import {
  DEFAULT_WHATSAPP_MESSAGE,
  renderWhatsappMessage,
  whatsappLink,
} from "@/modules/guests/whatsapp";
import { getWedding } from "@/modules/wedding/service";

export const metadata: Metadata = { title: "Guests — Make My Marriage" };

export default async function GuestsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const ctx = await requireMember();
  const raw = await searchParams;
  const query = parseGuestQuery(raw);
  const [wedding, events, stats, list] = await Promise.all([
    getWedding(ctx.weddingId),
    listEvents(ctx.weddingId),
    getStats(ctx.weddingId),
    listGuests(ctx.weddingId, query),
  ]);
  const eventNames = Object.fromEntries(events.map((e) => [e.id, e.name]));
  const couple = wedding ? `${wedding.brideName} & ${wedding.groomName}` : "";
  const template = wedding?.whatsappMessage ?? DEFAULT_WHATSAPP_MESSAGE;
  const filtered = Boolean(query.search || query.eventId || query.status);
  const pages = Math.max(1, Math.ceil(list.total / list.pageSize));

  const pageHref = (page: number) => {
    const next = new URLSearchParams();
    for (const key of ["search", "eventId", "status"] as const) {
      const value = raw[key];
      if (typeof value === "string" && value) next.set(key, value);
    }
    if (page > 1) next.set("page", String(page));
    const q = next.toString();
    return q ? `/guests?${q}` : "/guests";
  };

  return (
    <main className="mx-auto w-full max-w-4xl pt-6">
      <GuestsHeader
        active="guests"
        action={
          <Link
            href="/guests/new"
            className="inline-flex h-11 items-center gap-2 rounded-lg bg-bronze px-5 text-sm font-semibold text-white hover:bg-bronze/90"
          >
            <UserPlus className="size-4" aria-hidden /> Add guest
          </Link>
        }
      />

      <section aria-label="Totals" className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Parties invited" value={stats.parties} />
        <StatCard label="Replied" value={stats.responded} />
        <StatCard label="Waiting for a reply" value={stats.pending} />
        <StatCard label="People expected" value={stats.headcount} />
      </section>

      <div className="mt-6">
        <GuestFilters events={events.map((e) => ({ id: e.id, name: e.name }))} />
      </div>

      {list.items.length === 0 ? (
        <div className="mt-6 rounded-xl bg-white p-8 text-center shadow-[0_1px_3px_rgba(35,31,32,0.04)]">
          <p className="font-serif text-xl text-ink">
            {filtered ? "No guests match" : "No guests yet"}
          </p>
          <p className="mt-1 text-sm text-ink-2">
            {filtered
              ? "Try a different search or clear the filters."
              : events.length === 0
                ? "Add your events first, then invite guests to them."
                : "Add your first guest, then share their personal invitation link."}
          </p>
        </div>
      ) : (
        <>
          <p className="mt-4 text-[13px] text-ink-2">
            {list.total} {list.total === 1 ? "guest" : "guests"}
            {filtered ? " match" : ""}
          </p>
          <ul className="mt-2 divide-y divide-line rounded-xl bg-white shadow-[0_1px_3px_rgba(35,31,32,0.04)]">
            {list.items.map((guest) => {
              const inviteUrl = absoluteUrl(`/i/${guest.token}`);
              return (
                <GuestRow
                  key={guest.id}
                  guest={guest}
                  eventNames={eventNames}
                  inviteUrl={inviteUrl}
                  whatsappUrl={whatsappLink(
                    guest.phone,
                    renderWhatsappMessage(template, { name: guest.name, link: inviteUrl, couple }),
                  )}
                />
              );
            })}
          </ul>
          {pages > 1 ? (
            <nav aria-label="Pages" className="mt-4 flex items-center justify-between text-[13px]">
              {list.page > 1 ? (
                <Link
                  href={pageHref(list.page - 1)}
                  className="font-semibold text-bronze hover:underline"
                >
                  Previous
                </Link>
              ) : (
                <span />
              )}
              <span className="text-ink-2">
                Page {list.page} of {pages}
              </span>
              {list.page < pages ? (
                <Link
                  href={pageHref(list.page + 1)}
                  className="font-semibold text-bronze hover:underline"
                >
                  Next
                </Link>
              ) : (
                <span />
              )}
            </nav>
          ) : null}
        </>
      )}

      <details className="mt-8 rounded-xl bg-white p-5 shadow-[0_1px_3px_rgba(35,31,32,0.04)]">
        <summary className="cursor-pointer font-serif text-lg text-ink">WhatsApp message</summary>
        <div className="mt-3">
          <WhatsappMessageForm initial={template} />
        </div>
      </details>
    </main>
  );
}
