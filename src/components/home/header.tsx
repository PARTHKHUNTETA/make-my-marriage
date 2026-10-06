import Image from "next/image";
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
        <a href="#top" aria-label="Make My Marriage, home">
          <Image
            src="/images/logo.png"
            alt="Make My Marriage"
            width={320}
            height={64}
            className="h-8 w-auto"
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
        <a
          href={START_HREF}
          className="inline-flex h-9 items-center rounded-xl bg-plum px-4 text-sm font-semibold text-white transition-colors hover:bg-plum-hover"
        >
          Start planning free
        </a>
      </div>
    </header>
  );
}
