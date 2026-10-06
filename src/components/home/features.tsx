import Image from "next/image";
import { BedDouble, MapPin, Printer, Send, SlidersHorizontal } from "lucide-react";
import { containerClass, FeatureRow, MonoTag, Pill } from "./ui";

const cardClass = "rounded-2xl bg-white shadow-md";

function CardHeader({ title, tag }: { title: string; tag: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 pb-4">
      <p className="text-sm leading-5 font-semibold tracking-[-0.07px] text-ink">{title}</p>
      {tag}
    </div>
  );
}

// 01 — Multi-event dashboard
const eventCards = [
  {
    name: "Haldi Ceremony",
    guests: "85 Guests",
    guestClass: "bg-honey text-amber-deep",
    place: "Poolside Deck • The Oberoi Udaivilas",
    left: "10:30 AM – 01:30 PM",
    lead: "Lead: Masi / Pooja",
    cardClass: "bg-rose-50/60",
    leadClass: "text-bronze",
  },
  {
    name: "Grand Sangeet",
    guests: "340 Guests",
    guestClass: "bg-rose-200 text-ink",
    place: "Royal Courtyard Lawn • 07:00 PM",
    left: "12 Performances Queued",
    lead: "Lead: Arjun & Rohan",
    cardClass: "bg-white shadow-hair",
    leadClass: "text-plum",
  },
  {
    name: "Vedic Pheras",
    guests: "210 Guests",
    guestClass: "bg-honey text-amber-deep",
    place: "Mandap on Water Pavilion • 04:30 PM",
    left: "Pandit Ji Confirmed",
    lead: "Lead: Uncle Rajesh",
    cardClass: "bg-white",
    leadClass: "text-bronze",
  },
  {
    name: "Reception Dinner",
    guests: "550 Guests",
    guestClass: "bg-rose-200 text-ink",
    place: "Grand Ballroom • 08:30 PM",
    left: "Seated Banquet 4-course",
    lead: "Lead: Hotel GM",
    cardClass: "bg-rose-50/60",
    leadClass: "text-bronze",
  },
];

function DashboardVisual() {
  return (
    <div className={`${cardClass} p-6`}>
      <CardHeader
        title="Ceremony Navigation Architecture"
        tag={<MonoTag>5 Events Configured</MonoTag>}
      />
      <div className="grid gap-3 sm:grid-cols-2">
        {eventCards.map((e) => (
          <div key={e.name} className={`flex flex-col gap-2 rounded-lg p-4 ${e.cardClass}`}>
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm leading-5 font-semibold tracking-[-0.07px] text-black">
                {e.name}
              </p>
              <Pill className={`rounded-xl ${e.guestClass}`}>{e.guests}</Pill>
            </div>
            <p className="text-[13px] leading-[18px] text-ink-2">{e.place}</p>
            <div className="flex items-start justify-between gap-3 pt-1 font-mono text-xs leading-4">
              <span className="text-ink-2">{e.left}</span>
              <span className={`text-right font-medium ${e.leadClass}`}>{e.lead}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// 02 — Event-wise guest list
const guestFilters = ["All (482)", "Bride's Family (194)", "Groom's Friends (112)"];
const guestRows = [
  {
    name: "Dr. Vikramaditya Sethi",
    party: "+3 (4 total)",
    events: "All 4 Events",
    diet: "Pure Vegetarian",
    dietClass: "font-medium text-bronze",
    status: "Confirmed",
    statusClass: "bg-rose-200 text-forest",
  },
  {
    name: "Ayesha Malik & Farhan",
    party: "+1 (2 total)",
    events: "Sangeet • Reception",
    diet: "Halal Specified",
    dietClass: "text-ink-2",
    status: "Confirmed",
    statusClass: "bg-rose-200 text-forest",
  },
  {
    name: "Nikhil & Tara Chandran",
    party: "+0 (2 total)",
    events: "Muhurtham • Reception",
    diet: "Standard",
    dietClass: "text-ink-2",
    status: "Pending RSVP",
    statusClass: "bg-rose-100 text-amber-ink",
  },
];

function GuestListVisual() {
  return (
    <div className={`${cardClass} p-6`}>
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4">
        <div className="flex flex-wrap items-center gap-2">
          {guestFilters.map((f, i) => (
            <span
              key={f}
              className={`rounded-md px-2.5 py-1 text-[11px] font-medium tracking-[0.33px] whitespace-nowrap ${
                i === 0 ? "bg-plum text-white" : "bg-rose-100 text-ink-2"
              }`}
            >
              {f}
            </span>
          ))}
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-md bg-[#25d366]/10 px-3 py-1 text-sm font-semibold tracking-[-0.07px] text-[#128c7e]">
          <Send className="size-3" aria-hidden /> WhatsApp Sync
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-left">
          <thead>
            <tr className="bg-rose-50 text-[11px] font-bold tracking-[0.55px] text-ink-2 uppercase">
              {["Guest name", "Party", "Events invited", "Dietary", "Status"].map((h) => (
                <th key={h} className="px-3 py-2.5 font-bold">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {guestRows.map((r) => (
              <tr key={r.name}>
                <td className="px-3 py-3 text-[13px] font-semibold whitespace-nowrap text-black">
                  {r.name}
                </td>
                <td className="px-3 py-3 text-[13px] whitespace-nowrap text-ink-2">{r.party}</td>
                <td className="px-3 py-3">
                  <span className="rounded-sm bg-rose-100 px-2 text-[11px] leading-[18px] font-medium whitespace-nowrap text-ink">
                    {r.events}
                  </span>
                </td>
                <td className={`px-3 py-3 text-[13px] whitespace-nowrap ${r.dietClass}`}>
                  {r.diet}
                </td>
                <td className="px-3 py-3">
                  <span
                    className={`rounded-xl px-2 text-[11px] leading-[18px] font-semibold whitespace-nowrap ${r.statusClass}`}
                  >
                    {r.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// 03 — Expense and budget tracker
const budgetBar = [
  { label: "Catering (38%)", width: "38%", color: "bg-plum" },
  { label: "Decor & Floral (24%)", width: "24%", color: "bg-gold-ring" },
  { label: "Venue Lease (20%)", width: "20%", color: "bg-bronze" },
  { label: "Photo & Misc (18%)", width: "18%", color: "bg-rose-300" },
];
const ledger = [
  {
    vendor: "Saffron & Sage Catering (Delhi)",
    note: "Sangeet Live Counters (Advance 2 of 3)",
    amount: "₹6,50,000",
    status: "Paid • IMPS #4829",
    statusClass: "text-forest",
  },
  {
    vendor: "The Regal Marquee & Floral Design",
    note: "Vedic Mandap structure + Fresh Rajnigandha",
    amount: "₹3,20,000",
    status: "Due in 4 Days (Cash)",
    statusClass: "text-amber-ink",
  },
  {
    vendor: "Studio 9 Stories (Cinematography)",
    note: "Full team flight tickets + 50% Booking",
    amount: "₹2,80,000",
    status: "Paid • Contract Locked",
    statusClass: "text-forest",
  },
];

function BudgetVisual() {
  return (
    <div className={`${cardClass} flex flex-col gap-4 p-6`}>
      <div className="flex items-center justify-between gap-3 pb-4">
        <div>
          <p className="text-[11px] leading-[14px] font-medium tracking-[0.55px] text-ink-2 uppercase">
            Grand wedding ledger
          </p>
          <p className="flex flex-wrap items-baseline gap-x-1">
            <span className="font-serif text-xl leading-7 font-medium text-black">₹38,20,000 </span>
            <span className="text-[13px] leading-[18px] text-ink-2">Disbursed • ₹4,30,000 Due</span>
          </p>
        </div>
        <span className="rounded-sm bg-honey px-3 py-1 text-sm leading-5 font-medium tracking-[-0.07px] whitespace-nowrap text-amber-deep">
          + Add Payment
        </span>
      </div>
      <div className="flex flex-col gap-2">
        <div className="hidden justify-between text-[13px] leading-[18px] text-ink-2 sm:flex">
          {budgetBar.map((b) => (
            <span key={b.label}>{b.label}</span>
          ))}
        </div>
        <div className="flex h-3 overflow-hidden rounded-xl bg-rose-100">
          {budgetBar.map((b) => (
            <span key={b.label} className={`h-full ${b.color}`} style={{ width: b.width }} />
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-2 pt-2">
        {ledger.map((l) => (
          <div
            key={l.vendor}
            className="flex items-center justify-between gap-3 rounded bg-rose-50/40 p-3"
          >
            <div className="min-w-0">
              <p className="text-[13px] leading-[18px] font-semibold text-black">{l.vendor}</p>
              <p className="text-[13px] leading-[18px] text-ink-2">{l.note}</p>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-[13px] leading-[18px] font-semibold text-black">{l.amount}</p>
              <p className={`text-[11px] leading-[18px] font-semibold ${l.statusClass}`}>
                {l.status}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// 04 — QR suite and live media hub
function MediaVisual() {
  return (
    <div className={`${cardClass} flex flex-col gap-6 p-6 sm:p-8`}>
      <div className="flex flex-col gap-3 border-b border-line pb-2.5">
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-2">
            <span className="size-2 rounded-full bg-mint" />
            <p className="text-sm leading-5 font-semibold tracking-[-0.07px] text-black">
              Smart Table QR Engine & Media Stream
            </p>
          </div>
          <p className="text-[13px] leading-[18px] text-ink-2">
            1,418 memories uploaded across 36 tables • Zero guest login
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-sm bg-plum px-2.5 py-1 font-mono text-xs leading-4 font-medium text-white">
            Live Projector Beam Active
          </span>
          <span className="inline-flex items-center gap-1 rounded-sm bg-rose-100 px-3 py-1 text-sm leading-5 font-semibold tracking-[-0.07px] text-ink">
            <Printer className="size-3" aria-hidden /> Export PDF Kit
          </span>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="relative flex flex-col items-center justify-between overflow-hidden rounded-lg border border-line bg-warm p-4">
          <span className="absolute top-2 right-2 rounded-sm bg-honey px-1.5 py-0.5 text-[10px] leading-[15px] font-semibold tracking-[0.5px] text-amber-deep uppercase">
            A6 tent card
          </span>
          <div className="pt-2">
            <div className="flex size-24 items-center justify-center rounded bg-white p-2 ring-1 ring-gold-ring/30">
              <Image src="/images/qr-small.svg" alt="" width={80} height={80} unoptimized />
            </div>
          </div>
          <div className="flex flex-col items-center gap-[1.3px] pt-[11px] text-center">
            <p className="font-serif text-[15px] leading-[22.5px] font-medium text-plum">
              Priya & Arjun
            </p>
            <p className="text-[11px] leading-[16.5px] font-medium tracking-[0.55px] text-bronze uppercase">
              Table 14 • Grand Ballroom
            </p>
            <p className="pt-[2.7px] font-mono text-[10px] leading-[15px] text-ink-2">
              Scan: Upload Photos & WiFi Access
            </p>
          </div>
        </div>
        {[
          {
            src: "/images/gallery-photo-1.jpg",
            who: "Table 04 • Rohan",
            state: "Beam to Screen",
            kind: "4K Original",
          },
          {
            src: "/images/gallery-photo-2.jpg",
            who: "Table 09 • Ananya",
            state: "Sync Complete",
            kind: "RAW Clip",
          },
        ].map((p) => (
          <div key={p.who} className="relative h-48 overflow-hidden rounded-lg bg-rose-100">
            <Image
              src={p.src}
              alt={`Guest photo uploaded from ${p.who}`}
              width={512}
              height={279}
              className="absolute inset-0 h-full w-full object-cover"
            />
            <span className="absolute top-2 left-2 rounded-sm bg-plum/85 px-2 py-0.5 text-[10px] leading-[15px] font-medium text-white backdrop-blur-[2px]">
              {p.who}
            </span>
            <div className="absolute inset-x-2 bottom-2 flex items-center justify-between rounded-sm bg-white/90 px-2.5 py-1.5 backdrop-blur-[6px]">
              <span className="flex items-center gap-1 text-xs leading-4 font-semibold text-forest">
                <span className="size-1.5 rounded-full bg-forest" />
                {p.state}
              </span>
              <span className="text-[11px] leading-4 text-ink-2">{p.kind}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-3 rounded-lg bg-rose-50/50 p-3.5">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="size-[15px] text-plum" aria-hidden />
          <p className="text-[13px] leading-[18px] font-medium text-black">
            Custom Stationery Monogram & Formats
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {["A6 Table Tent", "Round Acrylic Coaster", "Entrance Easel Poster"].map((t) => (
            <span
              key={t}
              className="rounded-xl bg-white px-2 py-0.5 text-[11px] leading-[18px] font-medium whitespace-nowrap text-ink"
            >
              {t}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

// 05 — Wedding website
function WebsiteVisual() {
  const cards = [
    {
      dress: "Dress code: Festive pastels",
      title: "The Daytime Mehendi",
      where: "Oberoi Udaivilas Lake Deck • 11:00 AM",
      icon: MapPin,
      link: "View Google Maps Pin",
    },
    {
      dress: "Dress code: Formal black tie / Sherwani",
      title: "Grand Reception",
      where: "Taj Aravali Crystal Ballroom • 08:00 PM",
      icon: BedDouble,
      link: "Room Accommodations Info",
    },
  ];
  return (
    <div className={`${cardClass} p-6`}>
      <div className="flex items-center justify-between gap-3 pb-3">
        <p className="text-sm leading-5 font-semibold tracking-[-0.07px] text-ink">
          Responsive Couple Space
        </p>
        <span className="flex items-center gap-1 font-mono text-xs text-forest">
          <span className="size-1.5 rounded-full bg-forest" /> Published Live
        </span>
      </div>
      <div className="flex flex-col items-center gap-1 overflow-hidden rounded-lg bg-warm p-4 sm:p-6">
        <p className="text-center text-[11px] leading-[14px] font-semibold tracking-[1.1px] text-bronze uppercase">
          Udaipur, Rajasthan • December 18–20, 2025
        </p>
        <p className="text-center font-serif text-4xl leading-11 font-normal tracking-[-0.54px] text-black">
          Priya & Arjun
        </p>
        <p className="max-w-md pt-1 text-center text-[13px] leading-[18px] text-ink-2">
          We invite you to celebrate our union across three days of music, sacred vows, and joy.
        </p>
        <div className="grid w-full gap-3 pt-5 sm:grid-cols-2">
          {cards.map(({ dress, title, where, icon: Icon, link }) => (
            <div key={title} className="flex flex-col gap-1 rounded bg-white px-3 py-4">
              <p className="text-[10px] leading-[15px] font-semibold text-bronze uppercase">
                {dress}
              </p>
              <p className="text-sm leading-5 font-semibold tracking-[-0.07px] text-black">
                {title}
              </p>
              <p className="text-xs leading-[18px] text-ink-2">{where}</p>
              <p className="flex items-center gap-1.5 pt-0.5 text-[11px] leading-[16.5px] font-medium text-plum">
                <Icon className="size-3" aria-hidden /> {link}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// 06 — Vendor coordination hub
const vendors = [
  {
    name: "House of Makeup by Shreya",
    chip: "Advance Paid",
    chipClass: "bg-rose-200 text-forest",
    where: "Bridal Suite Room 204 • Call time: 02:00 PM sharp",
    deliverable: "Deliverable: Bride + Mother + 2 Bridesmaids",
    amount: "₹1,20,000",
    state: "Final settled",
    stateClass: "text-forest",
  },
  {
    name: "Soundscape DJ & Lights",
    chip: "Sound Check 04:00 PM",
    chipClass: "bg-honey text-amber-deep",
    where: "Ballroom Stage • Generator diesel sync checked",
    deliverable: "Deliverable: PA System + 6 Wireless Mics + Console",
    amount: "₹95,000",
    state: "50% Cash on arrival",
    stateClass: "text-amber-ink",
  },
  {
    name: "Artisan Florals Jaipur",
    chip: "Setup Cleared",
    chipClass: "bg-rose-200 text-forest",
    where: "Mandap flower canopy • Cold storage van unloaded",
    deliverable: "Deliverable: 400kg Rajnigandha + Marigold curtain",
    amount: "₹4,10,000",
    state: "Receipt Attached",
    stateClass: "text-forest",
  },
];

function VendorVisual() {
  return (
    <div className={`${cardClass} p-6`}>
      <CardHeader
        title="Vendor Deliverable & Ingress Hub"
        tag={<MonoTag>14 Active Vendors</MonoTag>}
      />
      <div className="flex flex-col gap-3">
        {vendors.map((v) => (
          <div
            key={v.name}
            className="flex items-center justify-between gap-3 rounded-lg bg-rose-50/50 p-3.5"
          >
            <div className="flex min-w-0 flex-col gap-0.5">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm leading-5 font-semibold tracking-[-0.07px] text-black">
                  {v.name}
                </p>
                <Pill className={`rounded-xl font-semibold ${v.chipClass}`}>{v.chip}</Pill>
              </div>
              <p className="text-[13px] leading-[18px] text-ink-2">{v.where}</p>
              <p className="pt-0.5 font-mono text-[11px] leading-[16.5px] text-ink-2">
                {v.deliverable}
              </p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-0.5 pt-0.5 text-right">
              <p className="text-sm leading-5 font-semibold tracking-[-0.07px] text-black">
                {v.amount}
              </p>
              <p className={`font-mono text-[11px] leading-[16.5px] ${v.stateClass}`}>{v.state}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function Features() {
  return (
    <section id="features" className="bg-blush py-24">
      <div className={`${containerClass} flex flex-col gap-20 lg:gap-28`}>
        <FeatureRow
          index="01"
          tag="Multi-event hierarchy"
          title="Multi-Event Dashboard"
          body="Every ceremony has its own guest count, venue coordinates, itinerary, and team leads. Keep the Haldi intimate and the Sangeet expansive without mixing up logistics."
          bullets={[
            "Isolated sub-timelines for morning ritual vs evening party",
            "Designated point-of-contact phone cards per event",
          ]}
          visual={<DashboardVisual />}
        />
        <FeatureRow
          index="02"
          tag="Guest segmentation"
          title="Event-Wise Guest List & RSVP"
          body="Assign guests to specific events with one tap. Granular plus-ones, meal preferences, and flight details without awkward phone calls."
          bullets={[
            "Family side tagging: Groom, Bride, Diaspora, Colleagues",
            "Dietary filters export directly to the catering executive",
          ]}
          visual={<GuestListVisual />}
          visualFirst
        />
        <FeatureRow
          index="03"
          tag="Financial control"
          title="Real-Time Expense & Budget Tracker"
          body="Track every rupee from florist advances to shagun lifafas. Real-time budget breakdown by ceremony and vendor, with instant payment due alerts."
          bullets={[
            "Milestone payment reminders to prevent vendor disputes",
            "Cash envelope checklist for the morning of each ceremony",
          ]}
          visual={<BudgetVisual />}
        />
        <FeatureRow
          index="04"
          tag="QR suite & live media hub"
          title="Smart QR Code Suite & Live Media Hub"
          body="Every guest table receives an elegantly stylized, print-ready QR tent card. One scan allows guests to view the evening runsheet, access venue WiFi, and drop full-resolution memories directly to the ballroom live-beam projector without downloading an app."
          bullets={[
            "Dual-purpose QR: Runsheet, dietary menu & instant memory drop in one scan",
            "Real-time live projector beam display for ballroom stage screens",
            "One-click batch vector PDF generator for table tents and acrylic coasters",
          ]}
          extra={
            <div className="flex flex-wrap gap-2 pt-1">
              <Pill className="bg-plum/10 px-2.5 py-1 font-semibold text-plum">
                Vector Print Ready
              </Pill>
              <Pill className="bg-honey/50 px-2.5 py-1 font-semibold text-bronze">
                Auto-Organized by Ceremony
              </Pill>
              <Pill className="bg-forest/10 px-2.5 py-1 font-semibold text-forest">
                Zero App Download
              </Pill>
            </div>
          }
          visual={<MediaVisual />}
          visualFirst
        />
        <FeatureRow
          index="05"
          tag="Guest touchpoint"
          title="Bespoke Digital Wedding Website"
          body="Publish a refined, ad-free couple website in 5 minutes with live Google Maps pins, dress codes, luggage suggestions, and countdowns."
          bullets={[
            "Personalized domain (priya-arjun.wedos.in)",
            "Password protected or direct WhatsApp token link",
          ]}
          visual={<WebsiteVisual />}
        />
        <FeatureRow
          index="06"
          tag="Operations control"
          title="Vendor Coordination Hub"
          body="Keep your photographer, makeup artist, caterer, and DJ aligned with contract attachments, payment schedules, and arrival run-sheets."
          bullets={[
            "Read-only runsheets shareable via one single web link",
            "No vendor calling the bride while she is getting ready",
          ]}
          visual={<VendorVisual />}
          visualFirst
        />
      </div>
    </section>
  );
}
