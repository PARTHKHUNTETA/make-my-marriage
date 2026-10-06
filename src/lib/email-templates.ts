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

export const emailPayloadSchemas = {
  verify: z.object({ name: z.string(), url: link }),
  reset: z.object({ name: z.string(), url: link }),
  member_invite: z.object({
    inviterName: z.string(),
    weddingTitle: z.string(),
    url: link,
    expiresInDays: z.string(),
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

type Layout = {
  heading: string;
  paragraphs: string[];
  cta: { label: string; url: string };
  footnote: string;
};

function layout({ heading, paragraphs, cta, footnote }: Layout): { html: string; text: string } {
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
${body}
<p style="margin:24px 0"><a href="${escapeHtml(cta.url)}" style="display:inline-block;background:#775a19;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 24px;border-radius:8px">${escapeHtml(cta.label)}</a></p>
<p style="margin:0 0 8px;font-size:12px;line-height:18px;color:#4e4449">If the button does not work, copy this link into your browser:<br><a href="${escapeHtml(cta.url)}" style="color:#775a19;word-break:break-all">${escapeHtml(cta.url)}</a></p>
</td></tr>
<tr><td style="padding:16px 32px 28px;font-size:12px;line-height:18px;color:#4e4449;border-top:1px solid #e8e2d8">${escapeHtml(footnote)}</td></tr>
</table></td></tr></table></body></html>`;
  const text = [
    heading,
    "",
    ...paragraphs.flatMap((p) => [p, ""]),
    `${cta.label}: ${cta.url}`,
    "",
    footnote,
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
};

// Validates the stored payload before rendering, so a malformed job fails clearly instead of
// sending a half-empty email.
export function renderEmail(type: string, payload: unknown): RenderedEmail {
  if (!(type in emailPayloadSchemas)) throw new Error(`Unknown email type: ${type}`);
  const key = type as EmailType;
  const parsed = emailPayloadSchemas[key].parse(payload);
  return (renderers[key] as (p: unknown) => RenderedEmail)(parsed);
}
