import Link from "next/link";
import { getSupportEmail } from "@/lib/env";

// The shared frame for the Privacy, Terms and Support pages: a plain, readable column with the three
// pages linked at the foot. No sign-in needed, and nothing here is personal.
export const LEGAL_UPDATED = "7 October 2026";

export function ContactLine() {
  const email = getSupportEmail();
  return email ? (
    <a href={`mailto:${email}`} className="font-semibold text-bronze underline">
      {email}
    </a>
  ) : (
    <span>the contact address given on our website</span>
  );
}

export function LegalPage({
  title,
  intro,
  updated = true,
  children,
}: {
  title: string;
  intro: string;
  updated?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-blush">
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <Link href="/" className="font-serif text-lg text-plum">
            Make My Marriage
          </Link>
          <Link href="/login" className="text-sm font-semibold text-bronze hover:underline">
            Sign in
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 pt-10 pb-16">
        <h1 className="font-serif text-4xl leading-tight tracking-tight text-plum">{title}</h1>
        {updated ? <p className="mt-1 text-xs text-ink-2">Last updated {LEGAL_UPDATED}</p> : null}
        <p className="mt-4 text-[15px] leading-relaxed text-ink">{intro}</p>
        <div className="mt-8 flex flex-col gap-8 text-[15px] leading-relaxed text-ink [&_h2]:mb-2 [&_h2]:font-serif [&_h2]:text-2xl [&_h2]:text-plum [&_li]:mt-1.5 [&_p+p]:mt-3 [&_ul]:list-disc [&_ul]:pl-5">
          {children}
        </div>
      </main>
      <footer className="border-t border-line bg-white">
        <nav
          aria-label="Legal"
          className="mx-auto flex max-w-3xl flex-wrap gap-x-6 gap-y-1 px-4 py-4 text-[13px] font-medium text-ink-2"
        >
          <Link href="/privacy" className="hover:text-ink hover:underline">
            Privacy Policy
          </Link>
          <Link href="/terms" className="hover:text-ink hover:underline">
            Terms of Service
          </Link>
          <Link href="/support" className="hover:text-ink hover:underline">
            Support
          </Link>
        </nav>
      </footer>
    </div>
  );
}
