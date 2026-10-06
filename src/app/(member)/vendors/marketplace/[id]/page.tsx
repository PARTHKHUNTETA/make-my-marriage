import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Globe, Star } from "lucide-react";
import { ReviewForm } from "@/components/marketplace/review-form";
import { Stars } from "@/components/marketplace/stars";
import { BookingActions } from "@/components/marketplace/booking-actions";
import { BookingRequestForm } from "@/components/marketplace/booking-request-form";
import { requireMember } from "@/lib/authz";
import { formatLongDate } from "@/lib/dates";
import { formatRupees } from "@/lib/money";
import { listEvents } from "@/modules/events/service";
import { getStats } from "@/modules/guests/service";
import { BOOKING_STATUS_LABELS, reviewEligibility } from "@/modules/marketplace/schema";
import { listingPhotoUrls } from "@/modules/marketplace/photos";
import {
  getListingReviews,
  getLiveListing,
  getMyReview,
  getOpenBooking,
} from "@/modules/marketplace/service";
import { VENDOR_CATEGORY_LABELS } from "@/modules/vendors/schema";
import { getVendorByListing } from "@/modules/vendors/service";
import { getWedding } from "@/modules/wedding/service";
import { getProfile } from "@/modules/members/service";

export const metadata: Metadata = { title: "Vendor — Make My Marriage" };

export default async function ListingPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireMember();
  const { id } = await params;
  const listing = await getLiveListing(id);
  if (!listing) notFound();
  const photos = await listingPhotoUrls(listing.photoKeys);

  const [events, wedding, stats, open, mine, profile, reviews, myReview] = await Promise.all([
    listEvents(ctx.weddingId),
    getWedding(ctx.weddingId),
    getStats(ctx.weddingId),
    getOpenBooking(ctx.weddingId, id),
    getVendorByListing(ctx.weddingId, id),
    getProfile(ctx.userId),
    getListingReviews(id),
    getMyReview(ctx.weddingId, id),
  ]);
  // A couple can review once the last event this vendor is linked to is over.
  const eligibility = reviewEligibility(
    mine !== null,
    events.filter((e) => mine?.eventIds.includes(e.id)).map((e) => e.date),
  );
  const headcounts = stats.perEvent.map((e) => e.headcount);
  const biggest = headcounts.length > 0 ? Math.max(...headcounts) : 0;

  return (
    <main className="mx-auto w-full max-w-3xl pt-6">
      <Link
        href="/vendors/marketplace"
        className="mb-4 inline-flex items-center gap-2 text-[13px] font-semibold text-ink-2 hover:text-ink"
      >
        <ArrowLeft className="size-4" aria-hidden /> Marketplace
      </Link>

      <section className="rounded-xl bg-white p-6 shadow-[0_1px_3px_rgba(35,31,32,0.04)]">
        <span className="rounded-full bg-rose-200 px-2.5 py-0.5 text-[11px] font-semibold text-ink-2">
          {VENDOR_CATEGORY_LABELS[listing.category]}
        </span>
        <h1 className="mt-2 font-serif text-4xl leading-11 tracking-tight text-plum">
          {listing.businessName}
        </h1>
        <p className="mt-1 text-sm text-ink-2">Serves {listing.cities.join(", ")}</p>
        <p className="mt-3 flex flex-wrap items-center gap-x-4 text-sm">
          <strong className="text-ink">
            {listing.startingPrice !== undefined
              ? `From ${formatRupees(listing.startingPrice)}`
              : "Ask for a quote"}
          </strong>
          {listing.ratingCount > 0 && listing.ratingAvg ? (
            <span className="inline-flex items-center gap-1 text-ink-2">
              <Star className="size-4 fill-honey text-honey" aria-hidden />
              {listing.ratingAvg.toFixed(1)} ({listing.ratingCount}{" "}
              {listing.ratingCount === 1 ? "review" : "reviews"})
            </span>
          ) : (
            <span className="text-ink-2">No reviews yet</span>
          )}
        </p>
        {photos.length > 0 ? (
          <ul className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {photos.map((p, i) => (
              <li key={p.id} className={i === 0 ? "col-span-2 sm:col-span-3" : ""}>
                <a href={p.url} target="_blank" rel="noopener noreferrer">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={p.url}
                    alt={`${listing.businessName} photo ${i + 1}`}
                    loading={i === 0 ? "eager" : "lazy"}
                    className={`w-full rounded-lg object-cover ${i === 0 ? "aspect-[16/9]" : "aspect-[4/3]"}`}
                  />
                </a>
              </li>
            ))}
          </ul>
        ) : null}
        <p className="mt-4 text-[15px] whitespace-pre-line text-ink">{listing.description}</p>
        {listing.website || listing.instagram ? (
          <p className="mt-4 flex flex-wrap gap-3 text-[13px]">
            {listing.website ? (
              <a
                href={listing.website}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="inline-flex items-center gap-1.5 font-semibold text-bronze hover:underline"
              >
                <Globe className="size-4" aria-hidden /> Website
              </a>
            ) : null}
            {listing.instagram ? (
              <a
                href={listing.instagram}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="font-semibold text-bronze hover:underline"
              >
                Instagram
              </a>
            ) : null}
          </p>
        ) : null}
      </section>

      <section className="mt-6 rounded-xl bg-white p-6 shadow-[0_1px_3px_rgba(35,31,32,0.04)]">
        {mine ? (
          <>
            <h2 className="font-serif text-xl text-ink">This vendor is in your list</h2>
            <p className="mt-1 text-sm text-ink-2">
              Their contact details and payment schedule are on their{" "}
              <Link
                href={`/vendors/${mine.id}`}
                className="font-semibold text-bronze hover:underline"
              >
                My Vendors page
              </Link>
              .
            </p>
          </>
        ) : open ? (
          <>
            <h2 className="font-serif text-xl text-ink">Your request</h2>
            <p className="mt-1 text-sm text-ink-2">
              {BOOKING_STATUS_LABELS[open.status]}
              {open.events.length > 0 ? ` · ${open.events.map((e) => e.name).join(", ")}` : ""}
              {open.quotedAmount ? ` · Quote: ${formatRupees(open.quotedAmount)}` : ""}
            </p>
            <div className="mt-3">
              <BookingActions
                requestId={open.id}
                status={open.status}
                quotedAmount={open.quotedAmount}
                quoteLabel={open.quotedAmount ? formatRupees(open.quotedAmount) : undefined}
              />
            </div>
          </>
        ) : (
          <>
            <h2 className="font-serif text-xl text-ink">Ask for a quote</h2>
            <p className="mt-1 mb-4 text-sm text-ink-2">
              No payment is taken here. The vendor replies with a price, and you decide.
            </p>
            <BookingRequestForm
              listingId={listing.id}
              events={events.map((e) => ({
                id: e.id,
                name: e.name,
                dateLabel: formatLongDate(e.date),
              }))}
              defaultCity={wedding?.city ?? ""}
              defaultHeadcount={biggest > 0 ? biggest : null}
              defaultContactName={profile?.name ?? ""}
            />
          </>
        )}
      </section>

      <section className="mt-6 rounded-xl bg-white p-6 shadow-[0_1px_3px_rgba(35,31,32,0.04)]">
        <h2 className="font-serif text-xl text-ink">Reviews</h2>
        {eligibility.state === "eligible" ? (
          <div className="mt-3 rounded-lg bg-rose-50 p-4">
            <p className="mb-3 text-sm font-semibold text-ink">
              {myReview ? "Your review" : "How was it? Review this vendor"}
            </p>
            <ReviewForm
              key={myReview?.id ?? "new"}
              listingId={listing.id}
              initialRating={myReview?.rating}
              initialText={myReview?.text}
            />
          </div>
        ) : eligibility.state === "not_yet" ? (
          <p className="mt-2 text-[13px] text-ink-2">
            You can review this vendor after your last event with them, on{" "}
            {formatLongDate(eligibility.lastEventOn)}.
          </p>
        ) : null}
        {reviews.length === 0 ? (
          <p className="mt-3 text-sm text-ink-2">No reviews yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-line">
            {reviews.map((r) => (
              <li key={r.id} className="py-4">
                <div className="flex items-center gap-3">
                  <Stars rating={r.rating} />
                  <span className="text-xs text-ink-2">
                    A couple who booked this vendor · {formatLongDate(r.createdAt)}
                  </span>
                </div>
                {r.text ? (
                  <p className="mt-2 text-[15px] whitespace-pre-line text-ink">{r.text}</p>
                ) : null}
                {r.vendorReply ? (
                  <div className="mt-3 rounded-lg bg-rose-50 p-3 text-[13px] text-ink">
                    <p className="font-semibold">Reply from {listing.businessName}</p>
                    <p className="mt-1 whitespace-pre-line text-ink-2">{r.vendorReply}</p>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
