import type { SendResult } from "@/modules/invitations/types";

// Says in plain words what a send did, including who was left out and why.
export function describeSend(result: SendResult, what: "invitation" | "reminder"): string {
  const parts: string[] = [];
  parts.push(
    result.queued > 0
      ? `${result.queued} ${what}${result.queued === 1 ? "" : "s"} on the way.`
      : `No ${what}s were sent.`,
  );
  if (result.alreadyToday > 0)
    parts.push(`${result.alreadyToday} already got one today, so they were skipped.`);
  if (result.noEmail > 0)
    parts.push(`${result.noEmail} ${result.noEmail === 1 ? "has" : "have"} no email address.`);
  if (result.unsubscribed > 0) parts.push(`${result.unsubscribed} unsubscribed from reminders.`);
  if (result.nothingToSend > 0)
    parts.push(
      what === "reminder"
        ? `${result.nothingToSend} ${result.nothingToSend === 1 ? "has" : "have"} nothing left to reply to.`
        : `${result.nothingToSend} ${result.nothingToSend === 1 ? "isn't" : "aren't"} invited to any event.`,
    );
  return parts.join(" ");
}
