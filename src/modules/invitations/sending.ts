import "server-only";
import { absoluteUrl } from "@/lib/app-url";
import { toIstYmd } from "@/lib/dates";
import { deliverJob, queueEmail } from "@/lib/email";
import { AppError } from "@/lib/errors";
import { drainEmailQueue, listEmailLog } from "@/lib/queue";
import { eventStartsAt, formatTime, type EventItem } from "@/modules/events/schema";
import { listEvents } from "@/modules/events/service";
import type { GuestItem } from "@/modules/guests/schema";
import {
  getGuestByToken,
  getGuestsByIds,
  listEveryGuest,
  recordInviteEmailed,
  setGuestUnsubscribed,
} from "@/modules/guests/service";
import { getWedding, listRemindingWeddings } from "@/modules/wedding/service";
import { planAutomaticReminders } from "./reminders";
import type { LogRow, SendResult } from "./types";

// Sending invitations and reminders by email (PRD 5.6). Emails go through the MongoDB queue; a
// one-per-guest-per-day key in the queue means a double click, a retry or a repeated cron run can
// never email the same person twice in a day.

const MAX_PER_SEND = 1000;
const whenFormat = new Intl.DateTimeFormat("en-IN", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "Asia/Kolkata",
});

export function describeEvent(event: EventItem, qrUrl?: string) {
  const place = [event.venueName, event.address].filter(Boolean).join(", ");
  return {
    name: event.name,
    when: `${whenFormat.format(event.date)} at ${formatTime(event.startTime)}`,
    ...(event.venueName ? { venue: event.venueName } : {}),
    ...(event.address ? { address: event.address } : {}),
    ...(event.dressCode ? { dressCode: event.dressCode } : {}),
    ...(place
      ? { mapUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place)}` }
      : {}),
    ...(qrUrl ? { qrUrl } : {}),
  };
}

type Wanted = { guestIds: string[] } | { all: true } | { nonResponders: true };

const empty = (): SendResult => ({
  queued: 0,
  noEmail: 0,
  unsubscribed: 0,
  nothingToSend: 0,
  alreadyToday: 0,
});

async function context(weddingId: string, wanted: Wanted) {
  const [wedding, events] = await Promise.all([getWedding(weddingId), listEvents(weddingId)]);
  if (!wedding) throw new AppError("NOT_FOUND", "We couldn't find your wedding.");
  const guests =
    "guestIds" in wanted
      ? await getGuestsByIds(weddingId, wanted.guestIds.slice(0, MAX_PER_SEND))
      : await listEveryGuest(weddingId);
  if (guests.length > MAX_PER_SEND)
    throw new AppError("VALIDATION_FAILED", `Send to up to ${MAX_PER_SEND} guests at a time.`);
  return { couple: `${wedding.brideName} & ${wedding.groomName}`, events, guests };
}

const guestUrl = (guest: GuestItem) => absoluteUrl(`/i/${guest.token}`);

// A few go out straight away so the sender sees it work; the cron drains the rest.
async function flush() {
  await drainEmailQueue(deliverJob, 50).catch(() => undefined);
}

export async function sendInvitationEmails(
  weddingId: string,
  wanted: { guestIds: string[] } | { all: true },
  now: Date = new Date(),
): Promise<SendResult> {
  const { couple, events, guests } = await context(weddingId, wanted);
  const byId = new Map(events.map((e) => [e.id, e]));
  const result = empty();
  const sent: string[] = [];
  for (const guest of guests) {
    if (!guest.email) {
      result.noEmail++;
      continue;
    }
    const invited = guest.invitations
      .map((i) => byId.get(i.eventId))
      .filter((e): e is EventItem => Boolean(e));
    if (invited.length === 0) {
      result.nothingToSend++;
      continue;
    }
    const queued = await queueEmail(
      {
        type: "invitation",
        toEmail: guest.email,
        weddingId,
        payload: {
          guestName: guest.name,
          couple,
          url: guestUrl(guest),
          events: JSON.stringify(invited.map((e) => describeEvent(e))),
        },
        meta: { guestId: guest.id, kind: "invitation" },
        dedupeKey: `invite:${guest.id}:${toIstYmd(now)}`,
      },
      { immediate: false },
    );
    if (queued) {
      result.queued++;
      sent.push(guest.id);
    } else result.alreadyToday++;
  }
  await recordInviteEmailed(weddingId, sent);
  await flush();
  return result;
}

// Manual reminder: everyone who has not replied to an event that has not started, or just the
// chosen guests. Guests who unsubscribed are left out, even when picked by hand.
export async function sendRsvpReminderEmails(
  weddingId: string,
  wanted: { guestIds: string[] } | { nonResponders: true },
  now: Date = new Date(),
): Promise<SendResult> {
  const { couple, events, guests } = await context(weddingId, wanted);
  const upcoming = new Map(events.filter((e) => eventStartsAt(e) > now).map((e) => [e.id, e]));
  const result = empty();
  for (const guest of guests) {
    const waiting = guest.invitations
      .filter((i) => i.rsvpStatus === "pending" && upcoming.has(i.eventId))
      .map((i) => upcoming.get(i.eventId)!);
    if (waiting.length === 0) {
      if ("guestIds" in wanted) result.nothingToSend++;
      continue;
    }
    if (!guest.email) {
      result.noEmail++;
      continue;
    }
    if (guest.remindersUnsubscribed) {
      result.unsubscribed++;
      continue;
    }
    const queued = await queueEmail(
      {
        type: "rsvp_reminder",
        toEmail: guest.email,
        weddingId,
        payload: {
          guestName: guest.name,
          couple,
          url: guestUrl(guest),
          events: JSON.stringify(waiting.map((e) => describeEvent(e))),
          unsubscribeUrl: absoluteUrl(`/unsubscribe/${guest.token}`),
        },
        meta: { guestId: guest.id, kind: "rsvp_reminder", by: "member" },
        dedupeKey: `remind:${guest.id}:${toIstYmd(now)}`,
      },
      { immediate: false },
    );
    if (queued) result.queued++;
    else result.alreadyToday++;
  }
  await flush();
  return result;
}

// The daily run (cron): for every wedding with automatic reminders on, queue what is due today.
export async function runAutomaticReminders(
  now: Date = new Date(),
): Promise<{ weddings: number; queued: number }> {
  const weddings = await listRemindingWeddings();
  let queued = 0;
  for (const wedding of weddings) {
    const [events, guests] = await Promise.all([
      listEvents(wedding.id),
      listEveryGuest(wedding.id),
    ]);
    const plan = planAutomaticReminders({
      now,
      events,
      guests,
      rsvpDays: wedding.reminders.rsvpDays,
    });
    const byGuest = new Map(guests.map((g) => [g.id, g]));
    const byEvent = new Map(events.map((e) => [e.id, e]));
    for (const item of plan) {
      const guest = byGuest.get(item.guestId);
      if (!guest?.email) continue;
      const shown = item.eventIds.flatMap((id) => byEvent.get(id) ?? []);
      const ok = await queueEmail(
        {
          type: item.kind,
          toEmail: guest.email,
          weddingId: wedding.id,
          payload: {
            guestName: guest.name,
            couple: wedding.couple,
            url: guestUrl(guest),
            // The day-before reminder carries each event's entry code, so the guest has it ready.
            events: JSON.stringify(
              shown.map((e) =>
                describeEvent(
                  e,
                  item.kind === "event_reminder"
                    ? absoluteUrl(`/api/i/${guest.token}/entry/${e.id}`)
                    : undefined,
                ),
              ),
            ),
            unsubscribeUrl: absoluteUrl(`/unsubscribe/${guest.token}`),
          },
          meta: { guestId: guest.id, kind: item.kind, by: "auto" },
          // One automatic email per guest per day, whatever the run or retry.
          dedupeKey: `auto:${guest.id}:${toIstYmd(now)}`,
        },
        { immediate: false },
      );
      if (ok) queued++;
    }
  }
  return { weddings: weddings.length, queued };
}

// Every invitation and reminder email sent for this wedding, newest first (PRD 5.6).
export async function getEmailLog(weddingId: string): Promise<LogRow[]> {
  const rows = await listEmailLog(
    weddingId,
    ["invitation", "rsvp_reminder", "event_reminder"],
    100,
  );
  const guests = new Map(
    (
      await getGuestsByIds(
        weddingId,
        rows.map((r) => r.meta.guestId ?? ""),
      )
    ).map((g) => [g.id, g]),
  );
  return rows.map((r) => ({
    id: r.id,
    kind: r.type as LogRow["kind"],
    guestName: guests.get(r.meta.guestId ?? "")?.name ?? "A guest who was removed",
    toEmail: r.toEmail,
    automatic: r.meta.by === "auto",
    status: r.status,
    at: r.sentAt ?? r.createdAt,
  }));
}

// ---- unsubscribe (one click, from the email) ----

export async function getUnsubscribeState(
  token: string,
): Promise<{ guestName: string; couple: string; unsubscribed: boolean } | null> {
  const found = await getGuestByToken(token);
  if (!found) return null;
  const wedding = await getWedding(found.weddingId);
  if (!wedding) return null;
  return {
    guestName: found.guest.name,
    couple: `${wedding.brideName} & ${wedding.groomName}`,
    unsubscribed: found.guest.remindersUnsubscribed,
  };
}

export async function setUnsubscribed(token: string, unsubscribed: boolean): Promise<void> {
  if (!(await setGuestUnsubscribed(token, unsubscribed)))
    throw new AppError("LINK_INVALID", "This link is not valid any more.");
}
