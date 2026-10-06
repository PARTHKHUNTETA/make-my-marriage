// Decorative right-hand panel from the sign-in design. The couple and venue shown are sample
// content, not real data.
export function SidePanel() {
  return (
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
  );
}
