import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, Lock } from "lucide-react";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = {
  title: "Sign in — Make My Marriage",
};

export default function LoginPage() {
  return (
    <div className="flex min-h-screen flex-col bg-blush">
      <header className="mx-auto flex w-full max-w-[1440px] items-center justify-between px-4 pt-6 md:px-10">
        <Link
          href="/"
          className="group flex items-center gap-2 text-sm font-semibold text-ink-2 hover:text-ink"
        >
          <ArrowLeft className="size-[18px] transition-transform group-hover:-translate-x-0.5" />
          Return to Home
        </Link>
        <span className="text-[11px] font-medium tracking-widest text-ink-2/80 uppercase">
          Secure Access
        </span>
      </header>

      <main className="flex flex-1 flex-col justify-center">
        <div className="flex min-h-[calc(100vh-140px)] w-full flex-col items-stretch overflow-hidden rounded-xl bg-white shadow-xl lg:flex-row">
          <section className="flex w-full flex-col items-center justify-center bg-blush px-4 py-10 sm:px-10 lg:w-7/12 xl:w-1/2">
            <div className="w-full max-w-[440px] rounded-xl border border-line-soft/30 bg-white p-6 shadow-sm sm:p-10">
              <Image
                src="/images/logo.png"
                alt="Make My Marriage"
                width={320}
                height={64}
                className="mb-4 h-8 w-auto"
                priority
              />
              <h1 className="font-serif text-4xl leading-11 tracking-tight text-plum">
                Welcome back
              </h1>
              <p className="mt-1 mb-4 text-[13px] leading-[18px] text-ink-2">
                Sign in to manage your events, guest lists, and celebration run-sheets.
              </p>

              <LoginForm />

              <div className="relative my-6 flex items-center justify-center">
                <div className="w-full border-t border-line-soft/40" />
                <span className="absolute bg-white px-2 font-mono text-xs tracking-widest text-ink-2/60 uppercase">
                  or
                </span>
              </div>

              <div className="flex flex-col items-center gap-4 text-center">
                <Link
                  href="/signup"
                  className="text-sm font-semibold text-plum transition-colors hover:text-bronze"
                >
                  New here? Create your wedding workspace
                </Link>
                <div className="flex items-center gap-1.5 rounded-full bg-rose-50 px-2 py-1 text-ink-2/80">
                  <Lock className="size-3.5" />
                  <span className="text-[11px] font-medium">
                    256-bit encrypted wedding command center
                  </span>
                </div>
              </div>
            </div>
          </section>

          <aside
            aria-hidden
            className="relative hidden flex-col justify-between overflow-hidden bg-plum p-10 text-white select-none lg:flex lg:w-5/12 xl:w-1/2 xl:p-14"
          >
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-10">
              <svg
                className="size-[720px] text-blush"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 500 500"
              >
                <circle cx="210" cy="250" r="160" strokeDasharray="3 3" strokeWidth="1" />
                <circle cx="290" cy="250" r="160" strokeWidth="1" />
                <circle cx="250" cy="250" r="210" strokeWidth="0.6" />
                <ellipse
                  cx="250"
                  cy="250"
                  rx="190"
                  ry="110"
                  strokeWidth="0.6"
                  transform="rotate(-25 250 250)"
                />
                <ellipse
                  cx="250"
                  cy="250"
                  rx="190"
                  ry="110"
                  strokeWidth="0.6"
                  transform="rotate(25 250 250)"
                />
              </svg>
            </div>
            <div className="pointer-events-none absolute -top-32 -right-32 size-96 rounded-full bg-bronze/15 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-32 -left-32 size-96 rounded-full bg-[#77546b]/20 blur-3xl" />

            <div className="relative z-10 flex items-center justify-between">
              <span className="font-serif text-sm tracking-wide text-blush/70 italic">
                Make My Marriage
              </span>
              <span className="font-mono text-xs tracking-widest text-rose-50/50 uppercase">
                Private Suite
              </span>
            </div>

            <div className="relative z-10 mx-auto my-auto flex max-w-[420px] flex-col items-center gap-6 py-10 text-center">
              <svg className="h-9 w-auto" fill="none" viewBox="0 0 48 36">
                <ellipse cx="18" cy="18" rx="12" ry="12" stroke="#ffdea5" strokeWidth="2" />
                <ellipse cx="30" cy="18" rx="12" ry="12" stroke="#e6bad5" strokeWidth="2" />
                <path
                  d="M 24 10 A 12 12 0 0 1 24 26"
                  stroke="#ffdea5"
                  strokeLinecap="round"
                  strokeWidth="2"
                />
              </svg>
              <div className="flex flex-col gap-1">
                <span className="text-[11px] font-medium tracking-widest text-honey uppercase">
                  Wedding Workspace
                </span>
                <h2 className="font-serif text-5xl leading-14 tracking-tight text-blush">
                  Ananya &amp; Kabir
                </h2>
              </div>
              <div className="my-1 w-12 border-t border-white/20" />
              <div className="flex flex-col gap-1">
                <p className="font-serif text-xl text-blush/90 italic">December 14–17, 2025</p>
                <p className="text-[13px] tracking-wide text-rose-50/70">
                  The Leela Palace &amp; Jagmandir Island • Udaipur
                </p>
              </div>
            </div>

            <div className="relative z-10 flex items-center justify-between border-t border-white/10 pt-4 text-[12px] text-rose-50/50">
              <span className="text-[11px] font-medium tracking-wider text-rose-50/60 uppercase">
                Confidential Access
              </span>
              <span className="font-mono tracking-wider">Suite No. 104</span>
            </div>
          </aside>
        </div>
      </main>

      <footer className="mx-auto w-full max-w-[1440px] px-4 pt-4 pb-6 md:px-10">
        <div className="flex flex-col items-center justify-between gap-2 text-[11px] font-medium text-ink-2 sm:flex-row">
          <div className="flex items-center gap-6">
            <Link href="/privacy" className="hover:text-ink">
              Privacy Policy
            </Link>
            <Link href="/terms" className="hover:text-ink">
              Terms of Service
            </Link>
            <Link href="/support" className="hover:text-ink">
              Support Concierge
            </Link>
          </div>
          <span className="font-mono text-xs text-ink-2/60">
            © Make My Marriage. All rights reserved.
          </span>
        </div>
      </footer>
    </div>
  );
}
