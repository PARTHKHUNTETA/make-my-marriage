// Shapes shared with the browser. Kept apart from sending.ts, which is server-only.
export type SendResult = {
  queued: number;
  noEmail: number;
  unsubscribed: number;
  nothingToSend: number;
  alreadyToday: number;
};

export type LogRow = {
  id: string;
  kind: "invitation" | "rsvp_reminder" | "event_reminder";
  guestName: string;
  toEmail: string;
  automatic: boolean;
  status: "pending" | "sending" | "sent" | "failed";
  at: Date;
};
