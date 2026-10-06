import { z } from "zod";

// The three account emails (system-design §9). Pure functions: data in, subject/html/text out.
// Every value that came from a person (names, wedding titles) is HTML-escaped, and subjects
// are flattened to one line so a name can never inject headers or markup.

const https = (value: string) => {
  const url = new URL(value);
  return url.protocol === "https:" || url.protocol === "http:";
};
const link = z.string().refine((v) => {
  try {
    return https(v);
  } catch {
    return false;
  }
}, "Not an http(s) link");

// One event as shown in a guest email.
const eventDetail = z.object({
  name: z.string(),
  when: z.string(), // "Saturday, 13 February 2027 at 7:00 PM"
  venue: z.string().optional(),
  address: z.string().optional(),
  dressCode: z.string().optional(),
  mapUrl: link.optional(),
});
export type EmailEvent = z.infer<typeof eventDetail>;
const eventList = z
  .string()
  .transform((value, ctx) => {
    try {
      return JSON.parse(value) as unknown;
    } catch {
      ctx.addIssue({ code: "custom", message: "events is not valid JSON" });
      return z.NEVER;
    }
  })
  .pipe(z.array(eventDetail).min(1));

export const emailPayloadSchemas = {
  verify: z.object({ name: z.string(), url: link }),
  reset: z.object({ name: z.string(), url: link }),
  member_invite: z.object({
    inviterName: z.string(),
    weddingTitle: z.string(),
    url: link,
    expiresInDays: z.string(),
  }),
  // Guest emails (PRD 5.6). Dates and times are already formatted when queued, so rendering needs
  // no date logic; the events travel as JSON because queue payloads are flat strings.
  invitation: z.object({
    guestName: z.string(),
    couple: z.string(),
    url: link,
    events: eventList,
  }),
  rsvp_reminder: z.object({
    guestName: z.string(),
    couple: z.string(),
    url: link,
    events: eventList,
    unsubscribeUrl: link,
  }),
  event_reminder: z.object({
    guestName: z.string(),
    couple: z.string(),
    url: link,
    events: eventList,
    unsubscribeUrl: link,
  }),
} as const;

export type EmailType = keyof typeof emailPayloadSchemas;
export type EmailPayload<T extends EmailType> = z.infer<(typeof emailPayloadSchemas)[T]>;
export type RenderedEmail = { subject: string; html: string; text: string };

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Collapses every run of whitespace, including any kind of line break, to a single space.
const oneLine = (value: string) => value.split(/\s+/).join(" ").trim();

type Block = { title: string; lines: string[]; link?: { label: string; url: string } };

type Layout = {
  heading: string;
  paragraphs: string[];
  // Event cards shown between the text and the button.
  blocks?: Block[];
  cta: { label: string; url: string };
  footnote: string;
  unsubscribeUrl?: string;
};

function layout({ heading, paragraphs, blocks = [], cta, footnote, unsubscribeUrl }: Layout): {
  html: string;
  text: string;
} {
  const cards = blocks
    .map(
      (b) =>
        `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 12px;background:#fdfbf7;border:1px solid #e8e2d8;border-radius:8px"><tr><td style="padding:14px 16px"><div style="font-family:Georgia,serif;font-size:18px;color:#2d1226">${escapeHtml(b.title)}</div>${b.lines
          .map(
            (line) =>
              `<div style="margin-top:4px;font-size:14px;line-height:20px;color:#4e4449">${escapeHtml(line)}</div>`,
          )
          .join("")}${
          b.link
            ? `<div style="margin-top:6px;font-size:13px"><a href="${escapeHtml(b.link.url)}" style="color:#775a19">${escapeHtml(b.link.label)}</a></div>`
            : ""
        }</td></tr></table>`,
    )
    .join("");
  const unsubscribeHtml = unsubscribeUrl
    ? `<br><a href="${escapeHtml(unsubscribeUrl)}" style="color:#775a19">Unsubscribe from these reminders</a>`
    : "";
  const body = paragraphs
    .map(
      (p) =>
        `<p style="margin:0 0 16px;font-size:15px;line-height:24px;color:#4e4449">${escapeHtml(p)}</p>`,
    )
    .join("");
  const html = `<!doctype html>
<html lang="en"><body style="margin:0;background:#fdfbf7;font-family:Helvetica,Arial,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fdfbf7"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border:1px solid #e8e2d8;border-radius:12px">
<tr><td style="padding:28px 32px 4px;font-family:Georgia,serif;font-size:20px;color:#2d1226">Make My Marriage</td></tr>
<tr><td style="padding:16px 32px 8px">
<h1 style="margin:0 0 16px;font-family:Georgia,serif;font-size:26px;line-height:32px;font-weight:normal;color:#1e1b1c">${escapeHtml(heading)}</h1>
${body}${cards}
<p style="margin:24px 0"><a href="${escapeHtml(cta.url)}" style="display:inline-block;background:#775a19;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 24px;border-radius:8px">${escapeHtml(cta.label)}</a></p>
<p style="margin:0 0 8px;font-size:12px;line-height:18px;color:#4e4449">If the button does not work, copy this link into your browser:<br><a href="${escapeHtml(cta.url)}" style="color:#775a19;word-break:break-all">${escapeHtml(cta.url)}</a></p>
</td></tr>
<tr><td style="padding:16px 32px 28px;font-size:12px;line-height:18px;color:#4e4449;border-top:1px solid #e8e2d8">${escapeHtml(footnote)}${unsubscribeHtml}</td></tr>
</table></td></tr></table></body></html>`;
  const text = [
    heading,
    "",
    ...paragraphs.flatMap((p) => [p, ""]),
    ...blocks.flatMap((b) => [
      b.title,
      ...b.lines.map((line) => `  ${line}`),
      ...(b.link ? [`  ${b.link.label}: ${b.link.url}`] : []),
      "",
    ]),
    `${cta.label}: ${cta.url}`,
    "",
    footnote,
    ...(unsubscribeUrl ? ["", `Unsubscribe from these reminders: ${unsubscribeUrl}`] : []),
  ].join("\n");
  return { html, text };
}

const renderers: { [T in EmailType]: (p: EmailPayload<T>) => RenderedEmail } = {
  verify: ({ name, url }) => ({
    subject: "Confirm your email for Make My Marriage",
    ...layout({
      heading: "Confirm your email address",
      paragraphs: [
        `Hi ${name}, welcome to Make My Marriage.`,
        "Please confirm that this is your email address so we can reach you about your wedding.",
      ],
      cta: { label: "Confirm email", url },
      footnote:
        "This link works for 24 hours. If you did not create an account, you can ignore this email.",
    }),
  }),
  reset: ({ name, url }) => ({
    subject: "Reset your Make My Marriage password",
    ...layout({
      heading: "Reset your password",
      paragraphs: [
        `Hi ${name}, we received a request to reset your password.`,
        "Choose a new one using the button below. For your security, this will sign you out everywhere else.",
      ],
      cta: { label: "Choose a new password", url },
      footnote:
        "This link works for 1 hour and can be used once. If you did not ask for this, you can ignore this email; your password has not changed.",
    }),
  }),
  member_invite: ({ inviterName, weddingTitle, url, expiresInDays }) => ({
    subject: oneLine(`${inviterName} invited you to help plan ${weddingTitle}`),
    ...layout({
      heading: `Help plan ${weddingTitle}`,
      paragraphs: [
        `${inviterName} has invited you to join the planning team for ${weddingTitle} on Make My Marriage.`,
        "You will be able to manage events, guests, the budget and vendors together.",
      ],
      cta: { label: "Join the wedding", url },
      footnote: `This invitation expires in ${expiresInDays} days. If you were not expecting it, you can ignore this email.`,
    }),
  }),
  invitation: ({ guestName, couple, url, events }) => ({
    subject: oneLine(`You're invited: ${couple}`),
    ...layout({
      heading: `${couple} invite you to celebrate`,
      paragraphs: [
        `Dear ${guestName},`,
        `We would love to have you with us. Here ${plural(events.length, "is the event", "are the events")} you are invited to. Please let us know if you can come.`,
      ],
      blocks: eventBlocks(events),
      cta: { label: "View invitation and reply", url },
      footnote: "This link is just for you. Please do not forward it.",
    }),
  }),
  rsvp_reminder: ({ guestName, couple, url, events, unsubscribeUrl }) => ({
    subject: oneLine(
      `Please reply: ${couple}'s ${plural(events.length, events[0]?.name ?? "event", "events")}`,
    ),
    ...layout({
      heading: "We'd love to know if you're coming",
      paragraphs: [
        `Dear ${guestName},`,
        `${couple} haven't heard from you yet about ${plural(events.length, "this event", "these events")}. It only takes a moment, and it helps them plan.`,
      ],
      blocks: eventBlocks(events),
      cta: { label: "Reply now", url },
      footnote: "You can change your reply any time until the event starts.",
      unsubscribeUrl,
    }),
  }),
  event_reminder: ({ guestName, couple, url, events, unsubscribeUrl }) => ({
    subject: oneLine(`Tomorrow: ${events.map((e) => e.name).join(" and ")} — ${couple}`),
    ...layout({
      heading: `See you tomorrow`,
      paragraphs: [
        `Dear ${guestName},`,
        `A reminder that ${plural(events.length, "this event is", "these events are")} tomorrow. ${couple} can't wait to celebrate with you.`,
      ],
      blocks: eventBlocks(events),
      cta: { label: "View your invitation", url },
      footnote: "Need to change your plans? Update your reply from your invitation link.",
      unsubscribeUrl,
    }),
  }),
};

function eventBlocks(events: EmailEvent[]): Block[] {
  return events.map((e) => ({
    title: e.name,
    lines: [
      e.when,
      e.venue ?? "Venue to be announced",
      ...(e.address ? [e.address] : []),
      ...(e.dressCode ? [`Dress code: ${e.dressCode}`] : []),
    ],
    ...(e.mapUrl ? { link: { label: "Open in Maps", url: e.mapUrl } } : {}),
  }));
}

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

// Validates the stored payload before rendering, so a malformed job fails clearly instead of
// sending a half-empty email.
export function renderEmail(type: string, payload: unknown): RenderedEmail {
  if (!(type in emailPayloadSchemas)) throw new Error(`Unknown email type: ${type}`);
  const key = type as EmailType;
  const parsed = emailPayloadSchemas[key].parse(payload);
  return (renderers[key] as (p: unknown) => RenderedEmail)(parsed);
}
