import type { Metadata } from "next";
import Link from "next/link";
import { ReminderSettingsForm } from "@/components/guests/reminder-settings-form";
import { SendPanel } from "@/components/guests/send-panel";
import { GuestsHeader } from "@/components/guests/guests-header";
import { requireMember } from "@/lib/authz";
import { absoluteUrl } from "@/lib/app-url";
import { eventStartsAt } from "@/modules/events/schema";
import { listEvents } from "@/modules/events/service";
import { listEveryGuest } from "@/modules/guests/service";
import {
  DEFAULT_WHATSAPP_MESSAGE,
  renderWhatsappMessage,
  whatsappLink,
} from "@/modules/guests/whatsapp";
import { getEmailLog } from "@/modules/invitations/sending";
import { getWedding } from "@/modules/wedding/service";

export const metadata: Metadata = { title: "Emails and reminders — Make My Marriage" };

const KIND = {
  invitation: "Invitation",
  rsvp_reminder: "Reply reminder",
  event_reminder: "Event reminder",
} as const;
const STATUS = {
  pending: "Queued",
  sending: "Sending",
  sent: "Sent",
  failed: "Failed",
} as const;
const stamp = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "Asia/Kolkata",
});

export default async function RemindersPage() {
  const ctx = await requireMember();
  const [wedding, events, guests, log] = await Promise.all([
    getWedding(ctx.weddingId),
    listEvents(ctx.weddingId),
    listEveryGuest(ctx.weddingId),
    getEmailLog(ctx.weddingId),
  ]);
  const now = new Date();
  const upcoming = new Set(events.filter((e) => eventStartsAt(e) > now).map((e) => e.id));
  const withEmail = guests.filter((g) => g.email);
  const waiting = withEmail.filter(
    (g) =>
      !g.remindersUnsubscribed &&
      g.invitations.some((i) => i.rsvpStatus === "pending" && upcoming.has(i.eventId)),
  );
  const noEmail = guests.filter((g) => !g.email);
  const couple = wedding ? `${wedding.brideName} & ${wedding.groomName}` : "";
  const template = wedding?.whatsappMessage ?? DEFAULT_WHATSAPP_MESSAGE;
  const card = "rounded-xl bg-white p-5 shadow-[0_1px_3px_rgba(35,31,32,0.04)]";

  return (
    <main className="mx-auto w-full max-w-4xl pt-6">
      <GuestsHeader active="reminders" />
      <div className="mt-6 flex flex-col gap-6">
        <SendPanel withEmail={withEmail.length} waiting={waiting.length} />

        <section className={card}>
          <h2 className="font-serif text-xl text-ink">Automatic reminders</h2>
          <div className="mt-3">
            <ReminderSettingsForm
              enabled={wedding?.reminders.enabled ?? false}
              days={wedding?.reminders.rsvpDays ?? [14, 3]}
            />
          </div>
        </section>

        <section className={card}>
          <h2 className="font-serif text-xl text-ink">
            Guests without an email{" "}
            <span className="font-sans text-sm text-ink-2">({noEmail.length})</span>
          </h2>
          {noEmail.length === 0 ? (
            <p className="mt-1 text-[13px] text-ink-2">Every guest has an email address.</p>
          ) : (
            <>
              <p className="mt-1 text-[13px] text-ink-2">
                They can&rsquo;t get emails, so share their invitation on WhatsApp yourself.
              </p>
              <ul className="mt-2 divide-y divide-line">
                {noEmail.map((guest) => {
                  const link = absoluteUrl(`/i/${guest.token}`);
                  return (
                    <li key={guest.id} className="flex flex-wrap items-center gap-3 py-2.5">
                      <Link
                        href={`/guests/${guest.id}`}
                        className="min-w-0 flex-1 text-sm font-semibold text-ink hover:underline"
                      >
                        {guest.name}
                      </Link>
                      <a
                        href={whatsappLink(
                          guest.phone,
                          renderWhatsappMessage(template, { name: guest.name, link, couple }),
                        )}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-lg bg-rose-100 px-3 py-1.5 text-xs font-semibold text-ink hover:bg-rose-200"
                      >
                        WhatsApp
                      </a>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </section>

        <section className={card}>
          <h2 className="font-serif text-xl text-ink">Emails sent</h2>
          {log.length === 0 ? (
            <p className="mt-1 text-[13px] text-ink-2">Nothing has been emailed yet.</p>
          ) : (
            <div className="mt-2 overflow-x-auto">
              <table className="w-full min-w-[34rem] text-left text-[13px]">
                <thead className="border-b border-line text-xs text-ink-2">
                  <tr>
                    <th className="py-2 pr-3 font-semibold">When</th>
                    <th className="py-2 pr-3 font-semibold">Guest</th>
                    <th className="py-2 pr-3 font-semibold">Email</th>
                    <th className="py-2 pr-3 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {log.map((row) => (
                    <tr key={row.id}>
                      <td className="py-2 pr-3 whitespace-nowrap text-ink-2">
                        {stamp.format(row.at)}
                      </td>
                      <td className="py-2 pr-3">
                        <span className="font-semibold text-ink">{row.guestName}</span>
                        <span className="block text-xs text-ink-2">{row.toEmail}</span>
                      </td>
                      <td className="py-2 pr-3">
                        {KIND[row.kind]}
                        {row.automatic ? (
                          <span className="block text-xs text-ink-2">Automatic</span>
                        ) : null}
                      </td>
                      <td
                        className={`py-2 pr-3 font-semibold ${
                          row.status === "failed" ? "text-destructive" : "text-ink"
                        }`}
                      >
                        {STATUS[row.status]}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
