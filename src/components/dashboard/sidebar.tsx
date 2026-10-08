"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { SigningOutOverlay, useSignOut } from "@/components/auth/use-sign-out";
import {
  CalendarDays,
  BarChart3,
  CheckCircle2,
  ChevronsUpDown,
  Globe,
  IndianRupee,
  Images,
  LayoutGrid,
  LogOut,
  Radio,
  SlidersHorizontal,
  Store,
  User,
  Users,
  type LucideIcon,
} from "lucide-react";

type NavItem = { href: string; label: string; icon: LucideIcon; badge?: string };

const sections: { title: string; items: NavItem[] }[] = [
  { title: "Main", items: [{ href: "/dashboard", label: "Dashboard", icon: LayoutGrid }] },
  {
    title: "Planning",
    items: [
      { href: "/events", label: "Events & Itinerary", icon: CalendarDays },
      { href: "/tasks", label: "Tasks & Milestones", icon: CheckCircle2 },
      { href: "/money", label: "Expenses & Budget", icon: IndianRupee },
    ],
  },
  {
    title: "Guests & RSVPs",
    items: [{ href: "/guests", label: "Guest List & RSVPs", icon: Users }],
  },
  { title: "Vendors", items: [{ href: "/vendors", label: "Vendor Operations", icon: Store }] },
  {
    title: "Experience & Media",
    items: [
      { href: "/website", label: "Wedding Website", icon: Globe },
      { href: "/photos", label: "Photos & QR Stream", icon: Images },
      { href: "/live", label: "Live Stream", icon: Radio },
      { href: "/analytics", label: "Analytics", icon: BarChart3 },
    ],
  },
  {
    title: "Preferences",
    items: [{ href: "/settings", label: "OS Settings", icon: SlidersHorizontal }],
  },
];

export type SidebarUser = { name: string };
export type SidebarWedding = { couple: string; place: string; countdown: string };

// The desktop sidebar: always on screen from the lg breakpoint up. Below that, the same menu opens
// from the hamburger button in the top bar (MobileNav).
export function Sidebar({ user, wedding }: { user: SidebarUser; wedding: SidebarWedding }) {
  return (
    <aside className="fixed top-0 left-0 z-50 hidden h-full w-64 flex-col justify-between overflow-y-auto bg-rose-50 shadow-[0_1px_8px_rgba(0,0,0,0.04)] lg:flex print:!hidden">
      <SidebarContent user={user} wedding={wedding} />
    </aside>
  );
}

// The menu itself, shared by the sidebar and the phone drawer. `onNavigate` lets the drawer close
// itself when a link is chosen.
export function SidebarContent({
  user,
  wedding,
  onNavigate,
}: {
  user: SidebarUser;
  wedding: SidebarWedding;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const { signOut, pending } = useSignOut();

  return (
    <div className="flex min-h-full flex-col justify-between">
      <div className="flex flex-col">
        <div className="px-4 pt-6 pb-4">
          <Image
            src="/images/logo.png"
            alt="Make My Marriage"
            width={320}
            height={64}
            className="h-8 w-auto"
          />
          <div className="mt-4 flex items-center justify-between rounded-xl bg-white p-2 shadow-[0_1px_3px_rgba(35,31,32,0.04)]">
            <div className="flex min-w-0 flex-col pr-1">
              <span className="truncate text-sm font-semibold text-ink">{wedding.couple}</span>
              <span className="truncate font-mono text-xs text-ink-2">{wedding.place}</span>
            </div>
            <ChevronsUpDown className="size-4 shrink-0 text-ink-2" />
          </div>
        </div>

        <nav aria-label="Workspace" className="flex flex-col gap-1 px-2">
          {sections.map((section) => (
            <div key={section.title} className="flex flex-col gap-1">
              <div className="px-2 pt-4 pb-1 text-[11px] font-medium tracking-wider text-ink-2/60 uppercase first:pt-1">
                {section.title}
              </div>
              {section.items.map(({ href, label, icon: Icon, badge }) => {
                const active = pathname === href || pathname.startsWith(`${href}/`);
                return (
                  <Link
                    key={href}
                    href={href}
                    aria-current={active ? "page" : undefined}
                    onClick={onNavigate}
                    className={`flex items-center gap-2 rounded-xl px-2 py-3 text-[13px] transition-all lg:py-1.5 ${
                      active
                        ? "bg-plum font-semibold text-white shadow-[0_1px_3px_rgba(35,31,32,0.04)]"
                        : "text-ink-2 hover:bg-rose-100 hover:text-ink"
                    }`}
                  >
                    <Icon className="size-[18px]" />
                    <span className="flex-1">{label}</span>
                    {badge && (
                      <span className="rounded-full bg-rose-200 px-1 py-0.5 text-[10px] font-medium text-ink-2">
                        {badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>
      </div>

      <div className="p-4">
        <div className="flex items-center justify-between rounded-xl bg-white p-2 shadow-[0_1px_3px_rgba(35,31,32,0.04)]">
          <div className="flex min-w-0 items-center gap-2">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-plum">
              <User className="size-[18px] text-white" />
            </div>
            <div className="flex min-w-0 flex-col">
              <span className="truncate text-sm font-semibold text-ink">{user.name}</span>
              <span className="truncate font-mono text-xs text-bronze">{wedding.countdown}</span>
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={signOut}
          disabled={pending}
          className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-line-soft/60 bg-white px-3 py-2.5 text-[13px] font-semibold text-ink-2 transition-colors hover:bg-rose-100 hover:text-ink disabled:cursor-not-allowed disabled:opacity-60"
        >
          <LogOut className="size-4" aria-hidden />
          Sign out
        </button>
      </div>
      <SigningOutOverlay show={pending} />
    </div>
  );
}
