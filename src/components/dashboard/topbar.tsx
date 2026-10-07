import { Clock, Search, User, Zap } from "lucide-react";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { MobileNav } from "./mobile-nav";
import type { SidebarUser, SidebarWedding } from "./sidebar";

// Today, as the people planning the wedding read it (India time), e.g. "Wednesday, 7 Oct".
const today = () =>
  new Intl.DateTimeFormat("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "short",
    timeZone: "Asia/Kolkata",
  }).format(new Date());

export function Topbar({ user, wedding }: { user: SidebarUser; wedding: SidebarWedding }) {
  return (
    <header className="fixed top-0 right-0 left-0 z-40 flex h-16 items-center justify-between bg-blush/85 px-4 shadow-[0_1px_8px_rgba(0,0,0,0.04)] backdrop-blur-xl sm:px-6 lg:left-64 print:hidden">
      <div className="flex items-center gap-2 sm:gap-4">
        <MobileNav user={user} wedding={wedding} />
        <button
          type="button"
          className="hidden items-center gap-1 rounded-xl bg-rose-50 px-2 py-1 text-ink-2 transition-colors hover:bg-rose-100 hover:text-ink sm:flex"
        >
          <Search className="size-[18px]" />
          <span className="hidden text-[13px] sm:inline">
            Search ceremonies, guests, contracts...
          </span>
          <kbd className="ml-2 hidden rounded bg-white px-1 font-mono text-xs text-ink-2/60 sm:inline">
            ⌘K
          </kbd>
        </button>
        <div className="hidden items-center gap-1 font-mono text-xs text-ink-2 xl:flex">
          <Clock className="size-4" />
          <span>{today()}</span>
        </div>
      </div>
      <div className="flex items-center gap-3 sm:gap-4">
        <button
          type="button"
          className="hidden items-center gap-1 rounded-xl bg-rose-100 px-2 py-1.5 text-xs font-semibold text-ink transition-colors hover:bg-rose-200 sm:flex"
        >
          <Zap className="size-4 text-bronze" />
          Quick Action
        </button>
        <NotificationBell />
        <div className="flex size-8 items-center justify-center rounded-full bg-plum">
          <User className="size-[18px] text-white" />
        </div>
      </div>
    </header>
  );
}
