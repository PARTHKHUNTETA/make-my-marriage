"use client";

import * as React from "react";
import Link from "next/link";
import { Plus, Zap } from "lucide-react";
import { QUICK_ACTIONS } from "./nav-data";

// The "Quick Action" button: the things people do most, one click from any page. A plain list of
// links that opens below the button and closes on a choice, on Escape, or a click elsewhere.
export function QuickActions() {
  const [open, setOpen] = React.useState(false);
  const box = React.useRef<HTMLDivElement>(null);
  const button = React.useRef<HTMLButtonElement>(null);

  React.useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        button.current?.focus();
      }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={box} className="relative">
      <button
        ref={button}
        type="button"
        aria-haspopup="true"
        aria-expanded={open}
        aria-label="Quick actions"
        onClick={() => setOpen((o) => !o)}
        className="flex h-11 items-center gap-1 rounded-xl bg-rose-100 px-3 text-xs font-semibold text-ink transition-colors hover:bg-rose-200 sm:h-auto sm:px-2 sm:py-1.5"
      >
        <Zap className="size-4 text-bronze sm:block" aria-hidden />
        <span className="hidden sm:inline">Quick Action</span>
        <Plus className="size-4 sm:hidden" aria-hidden />
      </button>
      {open ? (
        <ul className="absolute right-0 z-50 mt-2 w-56 overflow-hidden rounded-xl bg-white py-1 shadow-xl ring-1 ring-line">
          {QUICK_ACTIONS.map(({ label, href, icon: Icon }) => (
            <li key={href + label}>
              <Link
                href={href}
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 px-4 py-2.5 text-sm text-ink hover:bg-rose-50"
              >
                <Icon className="size-4 text-plum" aria-hidden />
                {label}
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
