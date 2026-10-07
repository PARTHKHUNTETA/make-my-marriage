import { Clock, User } from "lucide-react";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { CommandPalette } from "./command-palette";
import { MobileNav } from "./mobile-nav";
import { QuickActions } from "./quick-actions";
import type { SidebarUser, SidebarWedding } from "./sidebar";

// Today, as the people planning the wedding read it (India time), e.g. "Wednesday, 7 Oct".
const today = () =>
  new Intl.DateTimeFormat("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "short",
    timeZone: "Asia/Kolkata",
  }).format(new Date());

export function Topbar({
  user,
  wedding,
  isAdmin,
}: {
  user: SidebarUser;
  wedding: SidebarWedding;
  isAdmin: boolean;
}) {
  return (
    <header className="fixed top-0 right-0 left-0 z-40 flex h-16 items-center justify-between bg-blush/85 px-4 shadow-[0_1px_8px_rgba(0,0,0,0.04)] backdrop-blur-xl sm:px-6 lg:left-64 print:hidden">
      <div className="flex items-center gap-2 sm:gap-4">
        <MobileNav user={user} wedding={wedding} />
        <CommandPalette isAdmin={isAdmin} />
        <div className="hidden items-center gap-1 font-mono text-xs text-ink-2 xl:flex">
          <Clock className="size-4" />
          <span>{today()}</span>
        </div>
      </div>
      <div className="flex items-center gap-3 sm:gap-4">
        <QuickActions />
        <NotificationBell />
        <div className="flex size-8 items-center justify-center rounded-full bg-plum">
          <User className="size-[18px] text-white" />
        </div>
      </div>
    </header>
  );
}
