import Image from "next/image";
import Link from "next/link";
import { containerClass, START_HREF } from "./ui";

const navLinks = [
  { href: "#features", label: "Features" },
  { href: "#guests", label: "Guest experience" },
  { href: "#how-it-works", label: "How it works" },
];

// The Figma header frame could not be fetched (tool-call limit), so this follows the
// visual language of the rest of the page: logo left, anchors centre, primary action right.
export function Header() {
  return (
    <header className="sticky top-0 z-20 border-b border-line bg-canvas/90 backdrop-blur-md">
      <div className={`${containerClass} flex h-16 items-center justify-between`}>
        <a href="#top" aria-label="Make My Marriage, home" className="shrink-0">
          <Image
            src="/images/logo.png"
            alt="Make My Marriage"
            width={320}
            height={64}
            className="h-7 w-auto sm:h-8"
            priority
          />
        </a>
        <nav aria-label="Primary" className="hidden items-center gap-8 md:flex">
          {navLinks.map((l) => (
            <a key={l.href} href={l.href} className="text-sm font-medium text-ink-2 hover:text-ink">
              {l.label}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-1 sm:gap-3">
          <Link
            href="/login"
            className="inline-flex h-9 items-center rounded-xl px-3 text-sm font-semibold whitespace-nowrap text-plum transition-colors hover:bg-rose-100"
          >
            Sign in
          </Link>
          <a
            href={START_HREF}
            className="inline-flex h-9 items-center rounded-xl bg-plum px-3 text-sm font-semibold whitespace-nowrap text-white transition-colors hover:bg-plum-hover sm:px-4"
          >
            <span className="sm:hidden">Get started</span>
            <span className="hidden sm:inline">Start planning free</span>
          </a>
        </div>
      </div>
    </header>
  );
}
