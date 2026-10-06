import type { Metadata } from "next";
import { ListingForm } from "@/components/vendor-portal/listing-form";
import { PauseButton } from "@/components/vendor-portal/pause-button";
import { requireVendor } from "@/lib/authz";
import { toRupeeInput } from "@/lib/money";
import { LISTING_STATUS_LABELS, type ListingStatus } from "@/modules/marketplace/schema";
import { getMyListing } from "@/modules/marketplace/service";

export const metadata: Metadata = {
  title: "Your listing — Make My Marriage",
  robots: { index: false },
};

const tone: Record<ListingStatus, string> = {
  pending: "bg-honey/25 text-bronze",
  approved: "bg-forest/15 text-forest",
  rejected: "bg-destructive/10 text-destructive",
  suspended: "bg-destructive/10 text-destructive",
  paused: "bg-rose-200 text-ink-2",
};
const explain: Record<ListingStatus, string> = {
  pending: "The Make My Marriage team is reviewing it. Couples can't see it yet.",
  approved: "Couples can find you on the marketplace.",
  rejected: "It wasn't approved. Update it and send it again.",
  suspended: "It has been taken down by the team. Contact us if you think this is a mistake.",
  paused: "Hidden from couples until you resume it.",
};

export default async function ListingPage() {
  const ctx = await requireVendor();
  const listing = await getMyListing(ctx.vendorAccountId);

  return (
    <main className="pt-8">
      <p className="text-xs font-semibold tracking-[0.6px] text-bronze uppercase">Vendor portal</p>
      <h1 className="mt-1 font-serif text-4xl leading-11 tracking-tight text-plum">Your listing</h1>
      <p className="mt-1 mb-6 text-sm text-ink-2">
        This is what couples see when they browse the marketplace.
      </p>

      {listing ? (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white p-5 shadow-[0_1px_3px_rgba(35,31,32,0.04)]">
          <div>
            <span
              className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${tone[listing.status]}`}
            >
              {LISTING_STATUS_LABELS[listing.status]}
            </span>
            <p className="mt-2 text-[13px] text-ink-2">{explain[listing.status]}</p>
            {listing.reviewNote ? (
              <p className="mt-1 text-[13px] text-ink">
                Note from the team: <em>{listing.reviewNote}</em>
              </p>
            ) : null}
          </div>
          {listing.status === "approved" || listing.status === "paused" ? (
            <PauseButton paused={listing.status === "paused"} />
          ) : null}
        </div>
      ) : (
        <p className="mb-6 rounded-xl bg-white p-5 text-sm text-ink-2 shadow-[0_1px_3px_rgba(35,31,32,0.04)]">
          You don&rsquo;t have a listing yet. Fill in the form to create one.
        </p>
      )}

      <ListingForm
        hasListing={Boolean(listing)}
        initial={{
          category: listing?.category ?? "photographer",
          cities: listing?.cities.join(", ") ?? "",
          description: listing?.description ?? "",
          startingPrice:
            listing?.startingPrice === undefined ? "" : toRupeeInput(listing.startingPrice),
          website: listing?.website ?? "",
          instagram: listing?.instagram ?? "",
        }}
      />
    </main>
  );
}
