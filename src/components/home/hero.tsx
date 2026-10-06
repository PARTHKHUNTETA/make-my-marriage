import {
  ArrowRight,
  BadgeCheck,
  Banknote,
  Clock,
  Download,
  Search,
  ShieldCheck,
  UserCheck,
} from "lucide-react";
import { containerClass, MonoTag, Pill, START_HREF } from "./ui";

const kpis = [
  {
    label: "Total RSVPs confirmed",
    value: "482 ",
    note: "/ 520 (92%)",
    icon: UserCheck,
    iconBg: "bg-honey/40",
  },
  {
    label: "Budget committed",
    value: "₹38.2L ",
    note: "of ₹42.5L pool",
    icon: Banknote,
    iconBg: "bg-rose-100",
  },
  {
    label: "Runsheet status",
    value: "4 Events ",
    note: "• 48 Days to go",
    icon: Clock,
    iconBg: "bg-honey/40",
  },
];

const eventTabs = ["Sangeet & Mehendi", "Haldi", "Pheras / Muhurtham", "Reception"];

const runsheet = [
  {
    time: "04:00 PM – 05:15 PM",
    chip: "Vendor Ingress",
    chipClass: "bg-rose-300 text-ink-2",
    title: "Sound Check & Console Audio Balancing",
    body: "DJ Sahil + Royal Sound Engineers on Ballroom Stage. Power backup test complete.",
    timeClass: "text-bronze",
    cardClass: "bg-rose-50/50",
    dotClass: "bg-white",
    innerDot: "size-2 bg-bronze",
  },
  {
    time: "05:30 PM – 06:45 PM",
    chip: "Lead: Sameer (Brother)",
    chipClass: "bg-honey text-amber-deep",
    title: "Baraat Assembly & Dhol Procession",
    body: "North Gate courtyard entrance. 4 Nagada drummers lined up. Safa tying counter active.",
    timeClass: "text-plum",
    cardClass: "bg-white shadow-hair",
    dotClass: "bg-plum",
    innerDot: "size-1.5 bg-white",
  },
  {
    time: "07:15 PM – 08:00 PM",
    chip: "Terrace Deck",
    chipClass: "bg-rose-300 text-ink-2",
    title: "Varmala & Cold Sparkler Pyrotechnics",
    body: "Drones cleared with Taj security desk. Rose petal baskets distributed to frontline cousins.",
    timeClass: "text-ink-2",
    cardClass: "bg-rose-50/50",
    dotClass: "bg-white",
    innerDot: "size-2 bg-[#7f747a]",
  },
];

const rsvps = [
  {
    name: "Meera Kapoor + 3",
    status: "Attending (4)",
    statusClass: "text-forest",
    events: "Mehendi • Sangeet • Reception",
    chip: { text: "Jain Meal (2)", className: "bg-honey/50 text-bronze" },
    meta: "Del Flight UK812",
  },
  {
    name: "Kabir Singhania & Family",
    status: "Attending (2)",
    statusClass: "text-forest",
    events: "Sangeet • Pheras",
    chip: { text: "Room Assigned: 412", className: "bg-rose-100 text-ink-2" },
    meta: "Shuttle Booked",
  },
  {
    name: "Ananya Verma",
    status: "Waitlist +1",
    statusClass: "text-amber-ink",
    events: "Cocktail • Reception",
  },
];

function Kpi({ k }: { k: (typeof kpis)[number] }) {
  const Icon = k.icon;
  return (
    <div className="flex items-center justify-between rounded bg-white p-3.5 shadow-hair">
      <div className="flex flex-col gap-0.5">
        <p className="text-[11px] font-medium tracking-[0.55px] whitespace-nowrap text-ink-2 uppercase">
          {k.label}
        </p>
        <p className="flex items-baseline gap-1 whitespace-nowrap">
          <span className="font-serif text-xl leading-7 font-medium text-black">{k.value}</span>
          <span className="text-[13px] leading-[18px] text-ink-2">{k.note}</span>
        </p>
      </div>
      <span className={`flex size-9 shrink-0 items-center justify-center rounded-xl ${k.iconBg}`}>
        <Icon className="size-[18px] text-plum" aria-hidden />
      </span>
    </div>
  );
}

function ProductMockup() {
  return (
    <div className="relative w-full max-w-[1152px]">
      <div
        aria-hidden
        className="absolute -inset-4 rounded-2xl bg-gradient-to-r from-[#ffd7ef]/20 via-[#fed488]/20 to-[#e6bad5]/20 blur-[20px]"
      />
      <div
        className="relative overflow-hidden rounded-lg bg-white text-left shadow-xl"
        role="img"
        aria-label="Wedding dashboard: a live Sangeet run sheet beside incoming guest RSVPs"
      >
        <div className="flex h-11 items-center justify-between gap-4 bg-sand px-4">
          <div className="flex items-center gap-2">
            <span className="size-3 rounded-full bg-[#e58282]" />
            <span className="size-3 rounded-full bg-gold" />
            <span className="size-3 rounded-full bg-mint" />
            <span className="hidden pl-3 font-mono text-xs text-ink-2 sm:block">
              wedding_os_priya_arjun.mmw
            </span>
          </div>
          <div className="hidden w-64 items-center gap-2 rounded-md bg-white px-3 py-1 shadow-hair md:flex">
            <Search className="size-3 shrink-0 text-ink-2" aria-hidden />
            <span className="min-w-0 flex-1 truncate font-mono text-xs text-ink-2">
              Search guest, task, budget...
            </span>
            <kbd className="rounded-sm bg-rose-100 px-1.5 py-0.5 font-mono text-[10px] text-ink-2">
              Cmd K
            </kbd>
          </div>
          <div className="hidden items-center gap-1 rounded bg-rose-200/60 p-0.5 lg:flex">
            {eventTabs.map((t, i) => (
              <span
                key={t}
                className={`rounded-md px-2.5 py-1 text-[11px] tracking-[0.33px] whitespace-nowrap ${
                  i === 0 ? "bg-white font-semibold text-ink" : "font-medium text-ink-2"
                }`}
              >
                {t}
              </span>
            ))}
          </div>
        </div>

        <div className="grid gap-3 bg-rose-50/40 p-4 md:grid-cols-3">
          {kpis.map((k) => (
            <Kpi key={k.label} k={k} />
          ))}
        </div>

        <div className="grid md:min-h-[420px] md:grid-cols-12">
          <div className="flex flex-col gap-4 bg-white p-5 pb-8 md:col-span-7 md:pb-20">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="size-2 shrink-0 rounded-full bg-bronze" />
                <p className="text-sm leading-5 font-semibold tracking-[-0.07px] text-ink">
                  Grand Sangeet — Day-of Master Runsheet
                </p>
              </div>
              <MonoTag className="hidden sm:inline-block">Live Sync: On</MonoTag>
            </div>
            <div className="relative flex flex-col gap-3 pl-6">
              <span aria-hidden className="absolute top-2 bottom-2 left-2 w-0.5 bg-rose-300" />
              {runsheet.map((n) => (
                <div
                  key={n.title}
                  className={`relative flex flex-col gap-0.5 rounded p-3 ${n.cardClass}`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className={`font-mono text-xs leading-4 font-medium ${n.timeClass}`}>
                      {n.time}
                    </p>
                    <Pill className={`rounded-xl ${n.chipClass}`}>{n.chip}</Pill>
                  </div>
                  <p className="pt-0.5 text-sm leading-5 font-semibold tracking-[-0.07px] text-ink">
                    {n.title}
                  </p>
                  <p className="text-[13px] leading-[18px] text-ink-2">{n.body}</p>
                  <span
                    aria-hidden
                    className={`absolute top-4 -left-[23px] flex size-3.5 items-center justify-center rounded-full ${n.dotClass}`}
                  >
                    <span className={`rounded-full ${n.innerDot}`} />
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-7 bg-rose-50/30 p-5 md:col-span-5">
            <div className="flex flex-col gap-3.5">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm leading-5 font-semibold tracking-[-0.07px] text-ink">
                  Live RSVP Inflow
                </p>
                <p className="text-[11px] font-medium tracking-[0.33px] whitespace-nowrap text-bronze">
                  WhatsApp Sync Active
                </p>
              </div>
              <div className="flex flex-col gap-2.5">
                {rsvps.map((g) => (
                  <div key={g.name} className="flex flex-col gap-1 rounded bg-white p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm leading-5 font-semibold tracking-[-0.07px] text-ink">
                        {g.name}
                      </p>
                      <span
                        className={`rounded-sm bg-rose-200 px-2 py-0.5 text-[11px] font-semibold tracking-[0.33px] whitespace-nowrap ${g.statusClass}`}
                      >
                        {g.status}
                      </span>
                    </div>
                    <p className="text-[13px] leading-[18px] text-ink-2">{g.events}</p>
                    {g.chip && (
                      <div className="flex flex-wrap items-center gap-1.5 pt-1">
                        <span
                          className={`rounded-sm px-2 py-0.5 text-[11px] font-medium tracking-[0.33px] whitespace-nowrap ${g.chip.className}`}
                        >
                          {g.chip.text}
                        </span>
                        <span className="font-mono text-[11px] text-ink-2">{g.meta}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-auto flex items-center justify-between gap-3 pt-3">
              <div className="flex items-center gap-2">
                <span className="size-2 rounded-full bg-mint" />
                <span className="font-mono text-xs text-ink-2">Last ping 3m ago</span>
              </div>
              <span className="inline-flex items-center gap-1 text-sm font-medium tracking-[-0.07px] whitespace-nowrap text-plum">
                Export Run-of-Show <Download className="size-[11px]" aria-hidden />
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function Hero() {
  return (
    <section
      id="top"
      className="bg-gradient-to-b from-warm via-canvas via-50% to-blush pt-10 pb-16 md:pb-24"
    >
      <div className={`${containerClass} flex flex-col items-center`}>
        <div className="pb-6">
          <span className="inline-flex items-center gap-1 rounded-xl bg-white px-3.5 py-1 shadow-hair">
            <span className="size-2 rounded-full bg-plum" />
            <span className="text-xs leading-4 font-medium tracking-[0.6px] text-ink-2 uppercase">
              The Indian Wedding OS • V2.4 Released
            </span>
          </span>
        </div>
        <h1 className="max-w-4xl text-center font-serif text-[36px] leading-[44px] font-normal tracking-[-0.9px] text-black md:text-[54px] md:leading-[62px] md:tracking-[-1.35px]">
          Your whole wedding, in one calm place.
        </h1>
        <p className="mt-4 max-w-2xl text-center text-base leading-[26px] text-ink-2">
          Plan every event, manage your guests, track every rupee, and share the day — without the
          fifteen WhatsApp groups.
        </p>
        <div className="flex flex-col items-stretch gap-4 pt-10 sm:flex-row sm:items-center">
          <a
            href={START_HREF}
            className="inline-flex items-center justify-center rounded-xl bg-plum px-7 py-3.5 text-sm font-semibold tracking-[-0.07px] text-white shadow-md transition-colors hover:bg-plum-hover"
          >
            Start planning free
          </a>
          <a
            href="#features"
            className="inline-flex items-center justify-center gap-1 rounded-xl bg-white px-6 py-3.5 text-sm font-semibold tracking-[-0.07px] text-ink shadow-hair transition-colors hover:bg-rose-50"
          >
            See how it works <ArrowRight className="size-3" aria-hidden />
          </a>
        </div>
        <ul className="flex flex-col items-center gap-2 pt-6 text-[13px] leading-[18px] text-ink-2 sm:flex-row sm:gap-6">
          <li className="flex items-center gap-2">
            <BadgeCheck className="size-3.5 shrink-0 text-bronze" aria-hidden />
            <span>
              Trusted by 2,400+ couples across Delhi, Mumbai, Bengaluru, Chennai & Diaspora
            </span>
          </li>
          <li aria-hidden className="hidden text-base text-line-soft sm:block">
            •
          </li>
          <li className="flex items-center gap-1.5">
            <ShieldCheck className="size-3.5 shrink-0 text-bronze" aria-hidden />
            <span>100% Guest-app free</span>
          </li>
        </ul>
        <div className="flex w-full justify-center pt-14">
          <ProductMockup />
        </div>
      </div>
    </section>
  );
}
