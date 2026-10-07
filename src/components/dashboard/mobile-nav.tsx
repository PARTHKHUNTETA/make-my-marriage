"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { SidebarContent, type SidebarUser, type SidebarWedding } from "./sidebar";

// The menu on phones and tablets, where the sidebar has no room: a hamburger button in the top bar
// that slides the same menu in from the left. It closes when a page is chosen, on Escape, or on a
// tap outside, and while it is open the page behind does not scroll.
export function MobileNav({ user, wedding }: { user: SidebarUser; wedding: SidebarWedding }) {
  const [open, setOpen] = React.useState(false);
  const pathname = usePathname();
  const closeRef = React.useRef<HTMLButtonElement>(null);
  const openRef = React.useRef<HTMLButtonElement>(null);

  // Landing on a new page (including by the browser's back button) always shuts the drawer.
  const [seenPath, setSeenPath] = React.useState(pathname);
  if (seenPath !== pathname) {
    setSeenPath(pathname);
    setOpen(false);
  }

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        openRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [open]);

  return (
    <div className="lg:hidden print:hidden">
      <button
        ref={openRef}
        type="button"
        aria-label="Open menu"
        aria-expanded={open}
        aria-controls="mobile-menu"
        onClick={() => setOpen(true)}
        className="-ml-2 flex size-11 items-center justify-center rounded-xl text-ink-2 transition-colors hover:bg-rose-100 hover:text-ink"
      >
        <Menu className="size-6" aria-hidden />
      </button>
      {open ? (
        <div className="fixed inset-0 z-[60]">
          <button
            type="button"
            tabIndex={-1}
            aria-label="Close menu"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-ink/40"
          />
          <div
            id="mobile-menu"
            role="dialog"
            aria-modal="true"
            aria-label="Menu"
            className="absolute inset-y-0 left-0 w-[min(18rem,85vw)] overflow-y-auto bg-rose-50 shadow-xl"
          >
            <button
              ref={closeRef}
              type="button"
              aria-label="Close menu"
              onClick={() => {
                setOpen(false);
                openRef.current?.focus();
              }}
              className="absolute top-3 right-3 flex size-10 items-center justify-center rounded-xl text-ink-2 hover:bg-rose-100 hover:text-ink"
            >
              <X className="size-5" aria-hidden />
            </button>
            <SidebarContent user={user} wedding={wedding} onNavigate={() => setOpen(false)} />
          </div>
        </div>
      ) : null}
    </div>
  );
}
