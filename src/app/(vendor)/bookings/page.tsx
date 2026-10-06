import type { Metadata } from "next";
import { RequestActions } from "@/components/vendor-portal/request-actions";
import { requireVendor } from "@/lib/authz";
import { formatLongDate } from "@/lib/dates";
import { formatRupees } from "@/lib/money";
import { BOOKING_STATUS_LABELS, type BookingStatus } from "@/modules/marketplace/schema";
import { listVendorBookings } from "@/modules/marketplace/service";

export const metadata: Metadata = {
  title: "Bookings — Make My Marriage",
  robots: { index: false },
};

const tone: Record<BookingStatus, string> = {
  sent: "bg-honey/25 text-bronze",
  quoted: "bg-rose-200 text-ink-2",
  accepted: "bg-forest/15 text-forest",
  declined: "bg-destructive/10 text-destructive",
  cancelled: "bg-rose-200 text-ink-2",
};
const stamp = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  timeZone: "Asia/Kolkata",
});

// The vendor's inbox. Each request shows only what the couple chose to send: the events, the city,
// the number of guests, a message and, if they added it, how to reach them.
export default async function VendorBookingsPage() {
  const ctx = await requireVendor();
  const requests = await listVendorBookings(ctx.vendorAccountId);
  const open = requests.filter((r) => r.status === "sent" || r.status === "quoted").length;

  return (
    <main className="pt-8">
      <p className="text-xs font-semibold tracking-[0.6px] text-bronze uppercase">Vendor portal</p>
      <h1 className="mt-1 font-serif text-4xl leading-11 tracking-tight text-plum">
        Booking requests
      </h1>
      <p className="mt-1 mb-6 text-sm text-ink-2">
        {open === 0
          ? "Nothing is waiting for you."
          : `${open} ${open === 1 ? "request is" : "requests are"} waiting for an answer.`}
      </p>
      {requests.length === 0 ? (
        <p className="rounded-xl bg-white p-6 text-sm text-ink-2 shadow-[0_1px_3px_rgba(35,31,32,0.04)]">
          No requests yet. Once your listing is live, couples can ask you for a quote.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {requests.map((r) => (
            <li
              key={r.id}
              className="rounded-xl bg-white p-5 shadow-[0_1px_3px_rgba(35,31,32,0.04)]"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1 basis-64">
                  <p className="text-xs text-ink-2">Received {stamp.format(r.createdAt)}</p>
                  <ul className="mt-1 text-sm text-ink">
                    {r.events.map((e) => (
                      <li key={`${e.name}-${e.date.toISOString()}`}>
                        <strong>{e.name}</strong> · {formatLongDate(e.date)}
                      </li>
                    ))}
                  </ul>
                  <p className="mt-1 text-[13px] text-ink-2">
                    {[r.city, r.expectedHeadcount ? `about ${r.expectedHeadcount} guests` : ""]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                  {r.message ? (
                    <p className="mt-2 text-[13px] whitespace-pre-line text-ink">
                      &ldquo;{r.message}&rdquo;
                    </p>
                  ) : null}
                  {r.contactName || r.contactPhone ? (
                    <p className="mt-2 text-[13px] text-ink-2">
                      Contact: {[r.contactName, r.contactPhone].filter(Boolean).join(" · ")}
                    </p>
                  ) : null}
                </div>
                <div className="text-right">
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${tone[r.status]}`}
                  >
                    {BOOKING_STATUS_LABELS[r.status]}
                  </span>
                  {r.quotedAmount ? (
                    <p className="mt-1 text-sm font-semibold text-ink">
                      {formatRupees(r.quotedAmount)}
                    </p>
                  ) : null}
                </div>
              </div>
              {r.status === "sent" || r.status === "quoted" ? (
                <div className="mt-3">
                  <RequestActions requestId={r.id} quotedAmount={r.quotedAmount} />
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
