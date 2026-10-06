import { Bell, Clock, Search, User, Zap } from "lucide-react";

export function Topbar() {
  return (
    <header className="fixed top-0 right-0 left-0 z-40 flex h-16 items-center justify-between bg-blush/85 px-6 shadow-[0_1px_8px_rgba(0,0,0,0.04)] backdrop-blur-xl lg:left-64">
      <div className="flex items-center gap-4">
        <button
          type="button"
          className="flex items-center gap-1 rounded-xl bg-rose-50 px-2 py-1 text-ink-2 transition-colors hover:bg-rose-100 hover:text-ink"
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
          <span>Thursday, Oct 24</span>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <button
          type="button"
          className="flex items-center gap-1 rounded-xl bg-rose-100 px-2 py-1.5 text-xs font-semibold text-ink transition-colors hover:bg-rose-200"
        >
          <Zap className="size-4 text-bronze" />
          Quick Action
        </button>
        <button
          type="button"
          aria-label="Notifications"
          className="relative p-1 text-ink-2 transition-colors hover:text-ink"
        >
          <Bell className="size-5" />
          <span className="absolute top-1 right-1 size-2 rounded-full bg-bronze" />
        </button>
        <div className="flex size-8 items-center justify-center rounded-full bg-plum">
          <User className="size-[18px] text-white" />
        </div>
      </div>
    </header>
  );
}
