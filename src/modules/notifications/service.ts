import "server-only";
import { ObjectId } from "mongodb";
import { getMembership, getProfile, listRecipients } from "@/modules/members/service";
import {
  countUnread,
  insertMany,
  listFor,
  markAllRead,
  markRead,
  type NotificationDoc,
} from "./repository";
import {
  PANEL_LIMIT,
  type MemberNotificationType,
  type NotificationItem,
  type VendorNotificationType,
} from "./schema";

// Business rules for the notification centre (PRD 5.15). Telling someone is never allowed to break
// the thing that caused it: a failed notification is logged and dropped, never thrown.

export type MemberNotice = {
  type: MemberNotificationType;
  message: string;
  link?: string;
  // The same key for the same person is only ever stored once (daily alerts, hourly groups).
  dedupeKey?: string;
  audience?: "all" | "admins" | { memberId: string };
  // The person who did it needs no alert about their own action.
  exceptMemberId?: string;
};

export async function notifyMembers(weddingId: string, notice: MemberNotice): Promise<void> {
  try {
    const audience = notice.audience ?? "all";
    const recipients = (await listRecipients(weddingId)).filter((r) => {
      if (r.muted.includes(notice.type)) return false;
      if (notice.exceptMemberId === r.memberId) return false;
      if (audience === "all") return true;
      if (audience === "admins") return r.role === "admin";
      return r.memberId === audience.memberId;
    });
    await insertMany(
      recipients.map((r) => ({
        weddingId: new ObjectId(weddingId),
        recipientType: "member" as const,
        recipientId: new ObjectId(r.memberId),
        type: notice.type,
        message: notice.message,
        ...(notice.link ? { link: notice.link } : {}),
        ...(notice.dedupeKey ? { dedupeKey: notice.dedupeKey } : {}),
      })),
    );
  } catch (err) {
    console.error("notification failed", err instanceof Error ? err.name : "unknown");
  }
}

export async function notifyVendor(
  vendorAccountId: string,
  notice: { type: VendorNotificationType; message: string; link?: string; dedupeKey?: string },
): Promise<void> {
  try {
    await insertMany([
      {
        recipientType: "vendor",
        recipientId: new ObjectId(vendorAccountId),
        type: notice.type,
        message: notice.message,
        ...(notice.link ? { link: notice.link } : {}),
        ...(notice.dedupeKey ? { dedupeKey: notice.dedupeKey } : {}),
      },
    ]);
  } catch (err) {
    console.error("notification failed", err instanceof Error ? err.name : "unknown");
  }
}

const toItem = (d: NotificationDoc): NotificationItem => ({
  id: d._id.toHexString(),
  type: d.type,
  message: d.message,
  ...(d.link ? { link: d.link } : {}),
  read: Boolean(d.readAt),
  createdAt: d.createdAt.toISOString(),
});

export type Who = { type: "member" | "vendor"; id: string };

export async function getPanel(who: Who): Promise<{ unread: number; items: NotificationItem[] }> {
  const [unread, docs] = await Promise.all([countUnread(who), listFor(who, PANEL_LIMIT)]);
  return { unread, items: docs.map(toItem) };
}

export async function readOne(who: Who, id: string): Promise<void> {
  await markRead(who, id);
}

export async function readAll(who: Who): Promise<void> {
  await markAllRead(who);
}

// Tells the admins that someone has just joined (from an invitation).
export async function announceMemberJoined(userId: string): Promise<void> {
  try {
    const [membership, profile] = await Promise.all([getMembership(userId), getProfile(userId)]);
    if (!membership || !profile) return;
    await notifyMembers(membership.weddingId, {
      type: "member_change",
      message: `${profile.name} joined the wedding team.`,
      link: "/settings/members",
      audience: "admins",
      exceptMemberId: membership.memberId,
    });
  } catch (err) {
    console.error("notification failed", err instanceof Error ? err.name : "unknown");
  }
}
