import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { SidePanel } from "./side-panel";

// Shared frame for the sign-in and sign-up screens: the form on the left and, on large screens,
// the plum "wedding workspace" panel on the right, inside one rounded container.
export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-blush">
      <header className="mx-auto flex w-full max-w-[1440px] items-center justify-between px-4 pt-6 md:px-10">
        <Link
          href="/"
          className="group flex items-center gap-2 text-sm font-semibold text-ink-2 hover:text-ink"
        >
          <ArrowLeft
            className="size-[18px] transition-transform group-hover:-translate-x-0.5"
            aria-hidden
          />
          Return to Home
        </Link>
        <span className="text-[11px] font-medium tracking-widest text-ink-2/80 uppercase">
          Secure Access
        </span>
      </header>

      <main className="flex flex-1 flex-col justify-center">
        <div className="flex min-h-[calc(100vh-140px)] w-full flex-col items-stretch overflow-hidden rounded-xl bg-white shadow-xl lg:flex-row">
          <section className="flex w-full flex-col items-center justify-center bg-blush px-4 py-10 sm:px-10 lg:w-7/12 xl:w-1/2">
            {children}
          </section>
          <SidePanel />
        </div>
      </main>

      <footer className="mx-auto w-full max-w-[1440px] px-4 pt-4 pb-6 md:px-10">
        <div className="flex flex-col items-center justify-between gap-2 text-[11px] font-medium text-ink-2 sm:flex-row">
          <nav aria-label="Legal" className="flex items-center gap-6">
            <span>Privacy Policy</span>
            <span>Terms of Service</span>
            <span>Support Concierge</span>
          </nav>
          <span className="font-mono text-xs text-ink-2/60">
            © Make My Marriage. All rights reserved.
          </span>
        </div>
      </footer>
    </div>
  );
}
