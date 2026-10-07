import {
  CalendarDays,
  CreditCard,
  Lock,
  MonitorSmartphone,
  PartyPopper,
  TrendingUp,
  UserPlus,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { containerClass, Eyebrow, SectionHeading, START_HREF } from "./ui";

const steps = [
  {
    n: "01",
    icon: CalendarDays,
    title: "Create your wedding workspace",
    body: "Pick your dates, add your ceremonies, invite your partner, siblings, or parents as co-planners with custom permissions.",
  },
  {
    n: "02",
    icon: UserPlus,
    title: "Import guests & segment",
    body: "Bulk import from phone contacts or Excel, tag by ceremony access, and generate custom invite tokens with zero effort.",
  },
  {
    n: "03",
    icon: TrendingUp,
    title: "Track RSVPs & budgets live",
    body: "Live dashboard updates as responses roll in. Automated subtle reminders dispatch without manual awkward calls.",
  },
  {
    n: "04",
    icon: PartyPopper,
    title: "Celebrate & share memories",
    body: "Smooth vendor runsheet handoff on the day, with shared guest photo streams ready before hotel checkout next morning.",
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="bg-blush py-24">
      <div className={`${containerClass} flex flex-col items-center gap-16`}>
        <div className="flex max-w-2xl flex-col items-center gap-1.5 pt-1.5 text-center">
          <Eyebrow>Process</Eyebrow>
          <SectionHeading>Four deliberate steps to wedding serenity</SectionHeading>
          <p className="pt-1.5 text-base leading-[26px] text-ink-2">
            From the first auspicious date announcement to post-reception thank you notes.
          </p>
        </div>
        <ol className="grid w-full gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map(({ n, icon: Icon, title, body }) => (
            <li key={n} className="flex flex-col gap-2 rounded-lg bg-white p-6">
              <div className="flex items-center justify-between">
                <span className="font-serif text-2xl leading-8 font-medium tracking-[-0.24px] text-bronze">
                  {n}
                </span>
                <Icon className="size-[17px] text-ink-2" aria-hidden />
              </div>
              <h3 className="pt-2 text-base leading-6 font-semibold tracking-[-0.16px] text-black">
                {title}
              </h3>
              <p className="text-[13px] leading-[21px] text-ink-2">{body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

const traditions = [
  "Sangeet & Mehendi",
  "Haldi & Tel Baan",
  "Anand Karaj Lavan",
  "Vedic Saptapadi",
  "South Indian Muhurtham",
  "Bengali Gaye Holud",
  "Christian Nuptial Mass",
  "Nikah & Walima",
  "Roce Ceremony",
  "Snanam & Vratham",
  "Cocktail Gala",
  "Varmala Terrace",
  "Grand Reception Banquet",
];

export function Traditions() {
  return (
    <section className="bg-warm py-20">
      <div className={`${containerClass} flex flex-col items-center gap-1.5 pt-1.5 text-center`}>
        <Eyebrow>Cultural breadth</Eyebrow>
        <SectionHeading className="max-w-2xl">
          Built for every ritual, tradition, and celebration.
        </SectionHeading>
        <p className="max-w-3xl pt-1.5 text-base leading-[26px] text-ink-2">
          From Anand Karaj and Vedic Pheras to Nikah, Bengali Bibaho, South Indian Muhurtham,
          Christian Nuptials, interfaith unions, and intimate destination gatherings.
        </p>
        <ul className="flex max-w-4xl flex-wrap justify-center gap-x-3 gap-y-[26px] pt-[26px]">
          {traditions.map((t) => (
            <li
              key={t}
              className="rounded-xl bg-white px-4 py-2 text-[13px] leading-[18px] font-medium text-black"
            >
              {t}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

const trust = [
  {
    icon: Lock,
    title: "Bank-Grade Data Privacy",
    body: "Your family phone numbers and guest lists are strictly private. Never shared, never sold to vendor directories, and zero spam ads.",
  },
  {
    icon: MonitorSmartphone,
    title: "Zero Friction for Guests",
    body: "Works instantly in Safari, Chrome, and WhatsApp webview. No App Store download or account creation required for your invited loved ones.",
  },
  {
    icon: CreditCard,
    title: "Free to Start",
    body: "Set up your entire wedding space, guest lists, and first two ceremonies without entering a credit card or signing a contract.",
  },
];

export function Trust() {
  return (
    <section className="bg-blush px-4 py-16 sm:px-6">
      <div className="mx-auto grid max-w-[1280px] gap-8 md:grid-cols-3">
        {trust.map(({ icon: Icon, title, body }) => (
          <div key={title} className="flex flex-col gap-2 rounded-lg bg-rose-50/50 p-6">
            <span className="flex size-10 items-center justify-center rounded bg-white">
              <Icon className="size-[18px] text-bronze" aria-hidden />
            </span>
            <h3 className="pt-1 text-base leading-6 font-semibold tracking-[-0.16px] text-black">
              {title}
            </h3>
            <p className="text-[13px] leading-[21px] text-ink-2">{body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

export function FinalCta() {
  return (
    <section id="start" className="bg-plum px-4 py-20 sm:px-6 md:py-24 lg:px-48">
      <div className="mx-auto flex max-w-4xl flex-col items-center gap-6 px-0 pt-1.5 text-center sm:px-6">
        <p className="text-xs leading-4 font-semibold tracking-[0.6px] text-gold uppercase">
          The calm path forward
        </p>
        <h2 className="max-w-3xl font-serif text-[36px] leading-[44px] font-normal tracking-[-0.9px] text-white md:text-[52px] md:leading-[60px] md:tracking-[-1.3px]">
          Bring peace to your wedding planning today.
        </h2>
        <p className="max-w-2xl text-base leading-[26px] text-[#f5eced]/80">
          Your celebration deserves presence, joy, and laughter — not spreadsheet anxiety. Start
          setting up your ceremonies in less than two minutes.
        </p>
        <div className="pt-4">
          <a
            href={START_HREF}
            className="inline-flex items-center justify-center rounded-xl bg-gold px-8 py-4 text-base leading-6 font-bold tracking-[-0.16px] text-plum shadow-lg transition-colors hover:bg-[#d9b566]"
          >
            Start planning free — it&apos;s effortless
          </a>
        </div>
        <p className="pt-2 text-[13px] leading-[18px] text-[#f5eced]/60">
          No credit card required • Invite your partner with one click • 100% guest-app free
        </p>
      </div>
    </section>
  );
}

export function SignOff() {
  return (
    <div className="bg-rose-50/40 px-6 py-8 text-center">
      <p className="text-[13px] leading-[18px] font-medium text-ink-2">
        Make My Marriage — Designed with calm intention for Indian weddings everywhere.
      </p>
    </div>
  );
}

const footerColumns = [
  {
    title: "Product",
    links: [
      "Ceremony Run-of-Show",
      "Guest Registry & RSVPs",
      "Vendor Escrow Manager",
      "Tiered Plans",
      "Smart QR & Live Media Hub",
    ],
  },
  {
    title: "Platform",
    links: ["Architecture", "Multi-Event Sync", "Data Confidentiality", "Concierge Desk"],
  },
  {
    title: "Assurance",
    links: ["Privacy Promise", "Terms of Service", "Strict Non-Monetization"],
  },
];

// The footer lines that lead somewhere; the rest are descriptions of the product.
const FOOTER_LINKS: Record<string, string> = {
  "Privacy Promise": "/privacy",
  "Terms of Service": "/terms",
  "Concierge Desk": "/support",
};

export function Footer() {
  return (
    <footer className="border-t border-line bg-canvas">
      <div className={`${containerClass} flex flex-col gap-10 py-10`}>
        <div className="grid gap-10 lg:grid-cols-12">
          <div className="flex flex-col items-start gap-2 pb-3 lg:col-span-5">
            <div className="flex items-center gap-2">
              <Image
                src="/images/logo.png"
                alt=""
                width={320}
                height={64}
                className="h-7 w-[140px] object-contain object-left"
              />
              <span className="font-serif text-xl leading-7 font-medium tracking-[-0.5px] text-ink">
                Make My Marriage
              </span>
            </div>
            <p className="max-w-sm pt-1 text-[13px] leading-[18px] text-ink-2">
              The computational command center for modern Indian wedding orchestration. Calm
              logistics, elegant registries, and serene multi-event timelines.
            </p>
            <span className="mt-2 inline-flex items-center gap-1 rounded-xl border border-line-soft/40 bg-rose-100 px-[9px] py-[5px]">
              <span className="size-1.5 rounded-full bg-bronze" />
              <span className="text-[11px] leading-[14px] font-medium tracking-[0.55px] text-ink-2 uppercase">
                Made with care across India
              </span>
            </span>
          </div>
          <div className="grid gap-6 sm:grid-cols-3 lg:col-span-7">
            {footerColumns.map((c) => (
              <div key={c.title} className="flex flex-col gap-2">
                <p className="text-xs leading-4 font-semibold tracking-[0.6px] text-ink uppercase">
                  {c.title}
                </p>
                {c.links.map((l) =>
                  FOOTER_LINKS[l] ? (
                    <Link
                      key={l}
                      href={FOOTER_LINKS[l]}
                      className="text-[13px] leading-[18px] text-ink-2 hover:text-ink hover:underline"
                    >
                      {l}
                    </Link>
                  ) : (
                    <p key={l} className="text-[13px] leading-[18px] text-ink-2">
                      {l}
                    </p>
                  ),
                )}
              </div>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-3 border-t border-line pt-[25px] text-[13px] leading-[18px] text-ink-2 sm:flex-row sm:items-center sm:justify-between">
          <p>© 2025 Make My Marriage Technologies Private Limited. All rights reserved.</p>
          <div className="flex items-center gap-6">
            <Link href="/privacy" className="hover:text-ink hover:underline">
              Privacy
            </Link>
            <Link href="/terms" className="hover:text-ink hover:underline">
              Terms
            </Link>
            <Link href="/support" className="hover:text-ink hover:underline">
              Support
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
