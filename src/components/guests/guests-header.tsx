import Link from "next/link";

// The title and the two tabs shared by the guest list and the RSVP page.
export function GuestsHeader({
  active,
  action,
}: {
  active: "guests" | "rsvps" | "seating" | "reminders";
  action?: React.ReactNode;
}) {
  const tab = (key: "guests" | "rsvps" | "seating" | "reminders", href: string, label: string) => (
    <Link
      href={href}
      aria-current={active === key ? "page" : undefined}
      className={`rounded-full px-4 py-1.5 text-[13px] font-semibold transition-colors ${
        active === key ? "bg-plum text-white" : "bg-white text-ink-2 hover:bg-rose-200"
      }`}
    >
      {label}
    </Link>
  );
  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold tracking-[0.6px] text-bronze uppercase">Guests</p>
          <h1 className="mt-1 font-serif text-4xl leading-11 tracking-tight text-plum">
            {active === "guests"
              ? "Guest list"
              : active === "rsvps"
                ? "Replies"
                : active === "seating"
                  ? "Seating"
                  : "Emails and reminders"}
          </h1>
          <p className="mt-1 text-sm text-ink-2">
            {active === "guests"
              ? "Each entry is one invited party. Choose which events they are invited to."
              : active === "rsvps"
                ? "Who is coming to each event, and who has not answered yet."
                : active === "seating"
                  ? "Seat each party at a table for every event."
                  : "Email invitations, remind guests who have not replied, and see what has been sent."}
          </p>
        </div>
        {action}
      </div>
      <nav aria-label="Guest pages" className="mt-5 flex gap-2">
        {tab("guests", "/guests", "Guest list")}
        {tab("rsvps", "/guests/rsvp", "Replies")}
        {tab("seating", "/guests/seating", "Seating")}
        {tab("reminders", "/guests/reminders", "Emails and reminders")}
      </nav>
    </>
  );
}

export function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-white p-4 shadow-[0_1px_3px_rgba(35,31,32,0.04)]">
      <p className="font-serif text-3xl text-plum">{value}</p>
      <p className="text-[13px] text-ink-2">{label}</p>
    </div>
  );
}
