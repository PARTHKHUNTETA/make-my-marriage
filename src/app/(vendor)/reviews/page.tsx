import type { Metadata } from "next";
import { Stars } from "@/components/marketplace/stars";
import { ReplyForm } from "@/components/vendor-portal/reply-form";
import { requireVendor } from "@/lib/authz";
import { formatLongDate } from "@/lib/dates";
import { getMyListing, listMyReviews } from "@/modules/marketplace/service";

export const metadata: Metadata = { title: "Reviews — Make My Marriage", robots: { index: false } };

export default async function VendorReviewsPage() {
  const ctx = await requireVendor();
  const [listing, reviews] = await Promise.all([
    getMyListing(ctx.vendorAccountId),
    listMyReviews(ctx.vendorAccountId),
  ]);

  return (
    <main className="pt-8">
      <p className="text-xs font-semibold tracking-[0.6px] text-bronze uppercase">Vendor portal</p>
      <h1 className="mt-1 font-serif text-4xl leading-11 tracking-tight text-plum">Reviews</h1>
      <p className="mt-1 mb-6 text-sm text-ink-2">
        {listing && listing.ratingCount > 0 && listing.ratingAvg
          ? `${listing.ratingAvg.toFixed(1)} out of 5 from ${listing.ratingCount} ${listing.ratingCount === 1 ? "review" : "reviews"}.`
          : "Couples can review you after the last event you worked on."}
      </p>
      {reviews.length === 0 ? (
        <p className="rounded-xl bg-white p-6 text-sm text-ink-2 shadow-[0_1px_3px_rgba(35,31,32,0.04)]">
          No reviews yet.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {reviews.map((r) => (
            <li
              key={r.id}
              className="rounded-xl bg-white p-5 shadow-[0_1px_3px_rgba(35,31,32,0.04)]"
            >
              <div className="flex items-center gap-3">
                <Stars rating={r.rating} />
                <span className="text-xs text-ink-2">{formatLongDate(r.createdAt)}</span>
              </div>
              {r.text ? (
                <p className="mt-2 text-[15px] whitespace-pre-line text-ink">{r.text}</p>
              ) : null}
              {r.vendorReply ? (
                <div className="mt-3 rounded-lg bg-rose-50 p-3 text-[13px]">
                  <p className="font-semibold text-ink">Your reply</p>
                  <p className="mt-1 whitespace-pre-line text-ink-2">{r.vendorReply}</p>
                </div>
              ) : (
                <ReplyForm reviewId={r.id} />
              )}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
