import {
  CalendarPlus,
  CheckSquare,
  ImagePlus,
  IndianRupee,
  Send,
  Store,
  UserPlus,
  type LucideIcon,
} from "lucide-react";
import type { Entry } from "@/lib/command-search";

// The app's pages and the things people do most, for the search box and the Quick Action menu.
// Kept in one place so both always offer the same, and so a new page is added once.

export type QuickAction = Entry & { icon: LucideIcon };

export const QUICK_ACTIONS: QuickAction[] = [
  {
    label: "Add guest",
    keywords: "invite person people party",
    href: "/guests/new",
    icon: UserPlus,
  },
  {
    label: "Add event",
    keywords: "ceremony function sangeet haldi mehndi",
    href: "/events/new",
    icon: CalendarPlus,
  },
  { label: "Add task", keywords: "todo checklist reminder", href: "/tasks/new", icon: CheckSquare },
  {
    label: "Add expense",
    keywords: "spend cost money bill pay",
    href: "/money/new",
    icon: IndianRupee,
  },
  {
    label: "Add vendor",
    keywords: "photographer caterer decorator",
    href: "/vendors/new",
    icon: Store,
  },
  {
    label: "Send invitations",
    keywords: "email remind reminders rsvp",
    href: "/guests/reminders",
    icon: Send,
  },
  { label: "Add photos", keywords: "upload pictures gallery", href: "/photos", icon: ImagePlus },
];

export type PageEntry = Entry & { adminOnly?: boolean };

export const PAGES: PageEntry[] = [
  { label: "Dashboard", keywords: "home overview", href: "/dashboard" },
  { label: "Events & Itinerary", keywords: "ceremonies schedule", href: "/events" },
  { label: "Tasks & Milestones", keywords: "todo checklist", href: "/tasks" },
  { label: "Expenses & Budget", keywords: "money spending costs", href: "/money" },
  { label: "Payments", keywords: "installments vendor due", href: "/money/payments" },
  { label: "Budget", keywords: "limit category overall", href: "/money/budget" },
  { label: "Who paid", keywords: "split families contribution", href: "/money/splits" },
  { label: "Guest List & RSVPs", keywords: "people invitees", href: "/guests" },
  { label: "Replies", keywords: "rsvp attending responses", href: "/guests/rsvp" },
  { label: "Seating", keywords: "tables chart", href: "/guests/seating" },
  { label: "Check-in", keywords: "scan arrival gate qr", href: "/guests/checkin" },
  { label: "Emails and reminders", keywords: "invitations send log", href: "/guests/reminders" },
  { label: "Import guests", keywords: "csv excel upload", href: "/guests/import" },
  { label: "Vendor Operations", keywords: "my vendors", href: "/vendors" },
  { label: "Marketplace", keywords: "find vendors browse", href: "/vendors/marketplace" },
  { label: "Discover vendors", keywords: "google search near me find", href: "/vendors/discover" },
  { label: "Vendor bookings", keywords: "quotes requests", href: "/vendors/bookings" },
  { label: "Wedding Website", keywords: "site theme address", href: "/website" },
  { label: "Photos & QR Stream", keywords: "pictures gallery", href: "/photos" },
  { label: "Photos to review", keywords: "approve guest uploads", href: "/photos/review" },
  { label: "Share photos and QR", keywords: "poster gallery link", href: "/photos/share" },
  { label: "Live Stream", keywords: "youtube video broadcast", href: "/live" },
  { label: "Analytics", keywords: "charts insights reports", href: "/analytics" },
  { label: "Settings", keywords: "account preferences", href: "/settings" },
  { label: "Wedding details", keywords: "names date city venue cover", href: "/settings/wedding" },
  { label: "Appearance", keywords: "colour color theme palette", href: "/settings/appearance" },
  {
    label: "Notifications settings",
    keywords: "alerts mute bell",
    href: "/settings/notifications",
  },
  {
    label: "Team members",
    keywords: "invite admin manager roles",
    href: "/settings/members",
    adminOnly: true,
  },
];

export function pagesFor(isAdmin: boolean): PageEntry[] {
  return PAGES.filter((p) => isAdmin || !p.adminOnly);
}
