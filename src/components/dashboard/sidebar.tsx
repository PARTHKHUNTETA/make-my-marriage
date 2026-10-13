"use client";

import Image from "next/image";
import Link from "next/link";
import * as React from "react";
import { usePathname } from "next/navigation";
import { SIDEBAR_COOKIE } from "./sidebar-cookie";
import { SigningOutOverlay, useSignOut } from "@/components/auth/use-sign-out";
import {
  CalendarDays,
  BarChart3,
  CheckCircle2,
  ChevronsLeft,
  ChevronsRight,
  Globe,
  IndianRupee,
  Images,
  LayoutGrid,
  LogOut,
  Radio,
  SlidersHorizontal,
  Store,
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

// The desktop sidebar: always on screen from the lg breakpoint up, and collapsible to a strip of
// icons. Below lg, the same menu opens from the hamburger button in the top bar (MobileNav).
//
// Collapsing is a `data-sidebar` attribute on #app-shell, which the layout's own widths (this
// sidebar, the content's left padding, the top bar) read through `group-data-[sidebar=collapsed]`.
// So nothing re-renders to collapse it and there is no flash on load.
export function Sidebar({ collapsed: initial }: { collapsed: boolean }) {
  const [collapsed, setCollapsed] = React.useState(initial);

  function toggle() {
    const next = !collapsed;
    setCollapsed(next);
    const shell = document.getElementById("app-shell");
    if (shell) shell.dataset.sidebar = next ? "collapsed" : "expanded";
    document.cookie = `${SIDEBAR_COOKIE}=${next ? "collapsed" : "expanded"}; path=/; max-age=31536000; samesite=lax`;
  }

  return (
    <aside className="fixed top-0 left-0 z-50 hidden h-full w-64 flex-col justify-between overflow-x-hidden overflow-y-auto bg-rose-50 shadow-[0_1px_8px_rgba(0,0,0,0.04)] transition-[width] duration-200 group-data-[sidebar=collapsed]/shell:w-16 lg:flex print:!hidden">
      <SidebarContent collapsible onToggle={toggle} collapsed={collapsed} />
    </aside>
  );
}

// The menu itself, shared by the sidebar and the phone drawer. `onNavigate` lets the drawer close
// itself when a link is chosen. Only the desktop sidebar is `collapsible`; the drawer never is.
export function SidebarContent({
  onNavigate,
  collapsible = false,
  collapsed = false,
  onToggle,
}: {
  onNavigate?: () => void;
  collapsible?: boolean;
  collapsed?: boolean;
  onToggle?: () => void;
}) {
  const pathname = usePathname();
  const { signOut, pending, error } = useSignOut();

  return (
    <div className="flex min-h-full flex-col justify-between">
      <div className="flex flex-col">
        <div
          className={`flex items-center justify-between gap-2 px-4 pt-6 pb-4 ${
            collapsible
              ? "group-data-[sidebar=collapsed]/shell:justify-center group-data-[sidebar=collapsed]/shell:px-0"
              : ""
          }`}
        >
          <Image
            src="/images/logo.png"
            alt="Make My Marriage"
            width={320}
            height={64}
            className={`h-8 w-auto ${collapsible ? "group-data-[sidebar=collapsed]/shell:hidden" : ""}`}
          />
          {collapsible ? (
            <button
              type="button"
              onClick={onToggle}
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              aria-expanded={!collapsed}
              title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              className="flex size-8 shrink-0 items-center justify-center rounded-lg text-ink-2 transition-colors hover:bg-rose-100 hover:text-ink"
            >
              {collapsed ? (
                <ChevronsRight className="size-4" aria-hidden />
              ) : (
                <ChevronsLeft className="size-4" aria-hidden />
              )}
            </button>
          ) : null}
        </div>

        <nav aria-label="Workspace" className="flex flex-col gap-1 px-2">
          {sections.map((section) => (
            <div key={section.title} className="flex flex-col gap-1">
              <div
                className={`px-2 pt-4 pb-1 text-[11px] font-medium tracking-wider text-ink-2/60 uppercase first:pt-1 ${
                  collapsible ? "group-data-[sidebar=collapsed]/shell:hidden" : ""
                }`}
              >
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
                    title={label}
                    className={`flex items-center gap-2 rounded-xl px-2 py-3 text-[13px] transition-all lg:py-1.5 ${
                      collapsible
                        ? "group-data-[sidebar=collapsed]/shell:justify-center group-data-[sidebar=collapsed]/shell:px-0"
                        : ""
                    } ${
                      active
                        ? "bg-plum font-semibold text-white shadow-[0_1px_3px_rgba(35,31,32,0.04)]"
                        : "text-ink-2 hover:bg-rose-100 hover:text-ink"
                    }`}
                  >
                    <Icon className="size-[18px]" />
                    {/* sr-only, not hidden, so a collapsed link still has its name for screen readers */}
                    <span
                      className={`flex-1 ${collapsible ? "group-data-[sidebar=collapsed]/shell:sr-only" : ""}`}
                    >
                      {label}
                    </span>
                    {badge && (
                      <span
                        className={`rounded-full bg-rose-200 px-1 py-0.5 text-[10px] font-medium text-ink-2 ${collapsible ? "group-data-[sidebar=collapsed]/shell:hidden" : ""}`}
                      >
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

      <div className={`p-4 ${collapsible ? "group-data-[sidebar=collapsed]/shell:px-2" : ""}`}>
        <button
          type="button"
          onClick={signOut}
          disabled={pending}
          title="Sign out"
          className={`mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-line-soft/60 bg-white px-3 py-2.5 text-[13px] font-semibold text-ink-2 transition-colors hover:bg-rose-100 hover:text-ink disabled:cursor-not-allowed disabled:opacity-60 ${
            collapsible ? "group-data-[sidebar=collapsed]/shell:px-0" : ""
          }`}
        >
          <LogOut className="size-4" aria-hidden />
          <span className={collapsible ? "group-data-[sidebar=collapsed]/shell:sr-only" : ""}>
            Sign out
          </span>
        </button>
        {error ? (
          <p role="alert" className="mt-2 text-xs text-destructive">
            {error}
          </p>
        ) : null}
      </div>
      <SigningOutOverlay show={pending} />
    </div>
  );
}
