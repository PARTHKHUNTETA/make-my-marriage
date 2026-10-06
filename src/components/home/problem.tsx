import { CalendarCheck, Banknote, MessageSquare, ShieldCheck, Table2 } from "lucide-react";
import { containerClass, Eyebrow, SectionHeading } from "./ui";

const pains = [
  {
    icon: MessageSquare,
    title: "The 15 WhatsApp Groups",
    body: "Endless pinging, buried Google Drive PDFs, conflicting suggestions from distant relatives, and crucial logistical notes lost inside muted family threads.",
  },
  {
    icon: Table2,
    title: "Spreadsheet v24_FINAL_v2.xlsx",
    body: "Duplicate rows, outdated phone numbers, three family members editing conflicting offline files, and zero live sync when someone brings an unannounced plus-two.",
  },
  {
    icon: CalendarCheck,
    title: "Who's invited to which event?",
    body: "Awkward overlaps when the intimate Mehendi is capped at 80 guests but the Grand Reception expects 600. Confusion over venue gates and morning timings.",
  },
  {
    icon: Banknote,
    title: "Untracked Envelopes & Advances",
    body: "Frantic calls on the wedding morning asking if the dhol crew received their 50% deposit, where the sound engineer's cash envelope is, and who signed the caterer chit.",
  },
];

export function Problem() {
  return (
    <section className="bg-canvas py-20">
      <div className={`${containerClass} flex flex-col gap-10`}>
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div className="flex max-w-xl flex-col gap-1">
            <Eyebrow>The friction we solve</Eyebrow>
            <SectionHeading>The chaos before the celebration</SectionHeading>
          </div>
          <p className="max-w-md text-sm leading-[22px] text-ink-2">
            Indian weddings have 400 guests across 5 rituals over 3 days. Managing them on consumer
            chat apps is a recipe for anxiety.
          </p>
        </div>

        <div className="grid gap-6 pt-2 sm:grid-cols-2 lg:grid-cols-4">
          {pains.map(({ icon: Icon, title, body }) => (
            <article key={title} className="flex flex-col gap-2 rounded-lg bg-white p-6">
              <span className="flex size-10 items-center justify-center rounded bg-rose-50">
                <Icon className="size-[18px] text-plum" aria-hidden />
              </span>
              <h3 className="pt-2 font-serif text-xl leading-7 font-medium text-black">{title}</h3>
              <p className="text-[13px] leading-[21px] text-ink-2">{body}</p>
            </article>
          ))}
        </div>

        <div className="flex flex-col gap-3 rounded-lg bg-rose-50/70 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <ShieldCheck className="size-5 shrink-0 text-plum" aria-hidden />
            <p className="text-sm leading-[22px] font-medium text-black">
              Make My Marriage replaces the spreadsheets and WhatsApp clutter with a single shared
              source of truth.
            </p>
          </div>
          <Eyebrow className="whitespace-nowrap">Engineered for calm</Eyebrow>
        </div>
      </div>
    </section>
  );
}
