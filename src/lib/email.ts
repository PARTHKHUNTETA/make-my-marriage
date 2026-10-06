import "server-only";
import { getEmailEnv } from "@/lib/env";
import { renderEmail } from "@/lib/email-templates";
import { enqueueEmail, sendEmailNow, type EmailJobDoc, type NewEmailJob } from "@/lib/queue";

// Sending (system-design §9). Account emails go through the MongoDB queue so each one is
// retried on its own; `queueEmail` also tries to send straight away so nobody waits a minute
// for a reset link, and the cron route drains whatever failed.

export type OutgoingEmail = {
  to: string;
  subject: string;
  html: string;
  text: string;
  // Lets the provider ignore a duplicate if a retry happens after a crash mid-send.
  idempotencyKey?: string;
  // Extra mail headers, e.g. List-Unsubscribe so mail apps can show an Unsubscribe button.
  headers?: Record<string, string>;
};

// `retryable` tells the queue whether trying again can help (a rate limit or outage) or not
// (a rejected address or a bad API key).
export class EmailSendError extends Error {
  constructor(
    message: string,
    readonly retryable: boolean,
  ) {
    super(message);
    this.name = "EmailSendError";
  }
}

async function sendViaResend(mail: OutgoingEmail, apiKey: string, from: string): Promise<void> {
  let res: Response;
  try {
    res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        ...(mail.idempotencyKey ? { "Idempotency-Key": mail.idempotencyKey } : {}),
      },
      body: JSON.stringify({
        from,
        to: [mail.to],
        subject: mail.subject,
        html: mail.html,
        text: mail.text,
        ...(mail.headers ? { headers: mail.headers } : {}),
      }),
    });
  } catch {
    throw new EmailSendError("Could not reach the email provider", true);
  }
  if (res.ok) return;
  // Status only: the response body can echo the recipient's address.
  throw new EmailSendError(
    `Email provider rejected the message (HTTP ${res.status})`,
    res.status === 429 || res.status >= 500,
  );
}

export async function sendEmail(mail: OutgoingEmail): Promise<void> {
  const { RESEND_API_KEY, EMAIL_FROM } = getEmailEnv();
  if (RESEND_API_KEY) return sendViaResend(mail, RESEND_API_KEY, EMAIL_FROM);

  if (process.env.NODE_ENV === "production") {
    throw new EmailSendError("Email is not configured (set RESEND_API_KEY)", true);
  }
  // Development outbox: the link is right here in the server log. Never runs in production.
  console.log(`\n[email:dev] to=${mail.to}\n[email:dev] subject=${mail.subject}\n${mail.text}\n`);
}

// What the queue calls for each claimed job.
export async function deliverJob(job: EmailJobDoc): Promise<void> {
  const rendered = renderEmail(job.type, job.payload);
  // Reminders carry a one-click unsubscribe link, also offered to the mail app itself (RFC 8058).
  const unsubscribe = job.payload.unsubscribeUrl;
  await sendEmail({
    to: job.toEmail,
    ...rendered,
    idempotencyKey: job._id.toHexString(),
    ...(unsubscribe
      ? {
          headers: {
            "List-Unsubscribe": `<${unsubscribe}>`,
            "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
          },
        }
      : {}),
  });
}

// Queues an email and makes one immediate attempt. A failure to send now is not an error for
// the caller: the job stays queued and the cron retries it with backoff.
// Returns false when an email with the same dedupeKey was already queued (nothing new is sent).
export async function queueEmail(
  job: NewEmailJob,
  options?: { immediate?: boolean },
): Promise<boolean> {
  const id = await enqueueEmail(job);
  if (id && options?.immediate !== false) {
    await sendEmailNow(id, deliverJob).catch((err) => {
      console.error("immediate email send failed", err instanceof Error ? err.name : "unknown");
    });
  }
  return id !== null;
}
