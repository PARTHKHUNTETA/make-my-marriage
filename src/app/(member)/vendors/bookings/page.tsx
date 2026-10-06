import type { Metadata } from "next";
import Link from "next/link";
import { BookingActions } from "@/components/marketplace/booking-actions";
import { VendorsTabs } from "@/components/vendors/vendors-tabs";
import { requireMember } from "@/lib/authz";
import { formatLongDate } from "@/lib/dates";
import { formatRupees } from "@/lib/money";
import { BOOKING_STATUS_LABELS, type BookingStatus } from "@/modules/marketplace/schema";
import { listBookings } from "@/modules/marketplace/service";

export const metadata: Metadata = { title: "Bookings — Make My Marriage" };

const tone: Record<BookingStatus, string> = {
  sent: "bg-rose-200 text-ink-2",
  quoted: "bg-honey/25 text-bronze",
  accepted: "bg-forest/15 text-forest",
  declined: "bg-destructive/10 text-destructive",
  cancelled: "bg-rose-200 text-ink-2",
};

export default async function BookingsPage() {
  const ctx = await requireMember();
  const bookings = await listBookings(ctx.weddingId);

  return (
    <main className="mx-auto w-full max-w-4xl pt-6">
      <p className="text-xs font-semibold tracking-[0.6px] text-bronze uppercase">Vendors</p>
      <h1 className="mt-1 font-serif text-4xl leading-11 tracking-tight text-plum">Bookings</h1>
      <p className="mt-1 text-sm text-ink-2">
        Your requests to marketplace vendors and their replies.
      </p>
      <VendorsTabs active="bookings" />

      {bookings.length === 0 ? (
        <div className="mt-6 rounded-xl bg-white p-8 text-center shadow-[0_1px_3px_rgba(35,31,32,0.04)]">
          <p className="font-serif text-xl text-ink">No requests yet</p>
          <p className="mt-1 text-sm text-ink-2">
            Find a vendor in the{" "}
            <Link href="/vendors/marketplace" className="font-semibold text-bronze hover:underline">
              marketplace
            </Link>{" "}
            and ask for a quote.
          </p>
        </div>
      ) : (
        <ul className="mt-6 flex flex-col gap-3">
          {bookings.map((b) => (
            <li
              key={b.id}
              className="rounded-xl bg-white p-5 shadow-[0_1px_3px_rgba(35,31,32,0.04)]"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="font-serif text-xl text-ink">
                    <Link href={`/vendors/marketplace/${b.listingId}`} className="hover:underline">
                      {b.businessName}
                    </Link>
                  </h2>
                  <p className="mt-1 text-[13px] text-ink-2">
                    {b.events.map((e) => `${e.name} (${formatLongDate(e.date)})`).join(" · ")}
                  </p>
                  {b.city || b.expectedHeadcount ? (
                    <p className="text-[13px] text-ink-2">
                      {[b.city, b.expectedHeadcount ? `${b.expectedHeadcount} guests` : ""]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  ) : null}
                </div>
                <div className="text-right">
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${tone[b.status]}`}
                  >
                    {BOOKING_STATUS_LABELS[b.status]}
                  </span>
                  {b.quotedAmount ? (
                    <p className="mt-1 text-sm font-semibold text-ink">
                      Quote: {formatRupees(b.quotedAmount)}
                    </p>
                  ) : null}
                </div>
              </div>
              <div className="mt-3">
                <BookingActions
                  requestId={b.id}
                  status={b.status}
                  quotedAmount={b.quotedAmount}
                  quoteLabel={b.quotedAmount ? formatRupees(b.quotedAmount) : undefined}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
