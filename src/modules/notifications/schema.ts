import { z } from "zod";

// Zod schemas and types for the notification centre (PRD 5.15).

export const MEMBER_TYPES = [
  "rsvp",
  "photo_pending",
  "task_assigned",
  "task_due",
  "payment_due",
  "budget_alert",
  "booking",
  "member_change",
] as const;
export const VENDOR_TYPES = ["booking_request", "review", "booking_update"] as const;
export type MemberNotificationType = (typeof MEMBER_TYPES)[number];
export type VendorNotificationType = (typeof VENDOR_TYPES)[number];

// What a member sees when choosing which to mute.
export const MEMBER_TYPE_LABELS: Record<MemberNotificationType, string> = {
  rsvp: "Guest replies (new or changed)",
  photo_pending: "Guest photos waiting for approval",
  task_assigned: "A task is assigned to me",
  task_due: "My task is due tomorrow or overdue",
  payment_due: "A vendor payment is due soon or overdue",
  budget_alert: "Spending passes 90% or 100% of a budget",
  booking: "A vendor answers a booking request",
  member_change: "A member joins or is removed (admins)",
};

export const PANEL_LIMIT = 20;
export const KEEP_DAYS = 90;

export type NotificationItem = {
  id: string;
  type: string;
  message: string;
  link?: string;
  read: boolean;
  createdAt: string;
};

export const notificationIdSchema = z.object({
  id: z.string().regex(/^[0-9a-fA-F]{24}$/, "Not a valid id"),
});
export const muteSchema = z.object({
  types: z.array(z.enum(MEMBER_TYPES)).max(MEMBER_TYPES.length),
});
