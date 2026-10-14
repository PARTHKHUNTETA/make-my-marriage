import type { Permission } from "@/lib/permissions";

// Which permission opens each page of the member area. One list, used by the pages' own guards
// (a test checks they agree), by the sidebar, the search box and the Quick Action menu, so a link
// is shown only to people who can open it. Pages not listed are open to every member.
export const ROUTE_PERMISSIONS: Record<string, Permission> = {
  "/analytics": "analytics.view",
  "/events": "event.view",
  "/events/new": "event.edit",
  "/guests": "guest.view",
  "/guests/new": "guest.edit",
  "/guests/import": "guest.edit",
  "/guests/rsvp": "guest.view",
  "/guests/checkin": "checkin.use",
  "/guests/reminders": "invitation.send",
  "/guests/seating": "seating.view",
  "/live": "wedding.update",
  "/website": "wedding.update",
  "/money": "expense.view",
  "/money/new": "expense.edit",
  "/money/budget": "expense.view",
  "/money/payments": "vendor.view",
  "/money/splits": "expense.view",
  "/photos": "photo.view",
  "/photos/review": "photo.manage",
  "/photos/share": "gallery.share",
  "/settings/delete-wedding": "wedding.delete",
  "/settings/members": "member.manage",
  "/settings/roles": "role.manage",
  "/settings/activity": "member.manage",
  "/settings/wedding": "wedding.update",
  "/tasks": "task.view",
  "/tasks/new": "task.edit",
  "/vendors": "vendor.view",
  "/vendors/new": "vendor.edit",
  "/vendors/bookings": "marketplace.book",
  "/vendors/discover": "marketplace.book",
  "/vendors/marketplace": "marketplace.book",
};

// The permission for a path: its own entry, or the nearest listed parent ("/events/123" → "/events").
export function permissionForPath(href: string): Permission | undefined {
  const path = href.split(/[?#]/)[0]!.replace(/\/$/, "");
  for (let p = path; p; p = p.slice(0, p.lastIndexOf("/")))
    if (ROUTE_PERMISSIONS[p]) return ROUTE_PERMISSIONS[p];
  return undefined;
}

export const canOpen = (href: string, holds: (p: Permission) => boolean): boolean => {
  const needed = permissionForPath(href);
  return needed === undefined || holds(needed);
};
