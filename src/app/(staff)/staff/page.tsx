import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { StaffListingActions } from "@/components/marketplace/staff-listing-actions";
import { requireStaff } from "@/lib/authz";
import { formatRupees } from "@/lib/money";
import { LISTING_STATUS_LABELS } from "@/modules/marketplace/schema";
import { listForStaff } from "@/modules/marketplace/service";
import { VENDOR_CATEGORY_LABELS } from "@/modules/vendors/schema";

export const metadata: Metadata = { title: "Team — Make My Marriage", robots: { index: false } };
export const dynamic = "force-dynamic";

// The internal admin screen for the Make My Marriage team. To everyone else this page does not
// exist, so it does not reveal that it is there.
export default async function StaffPage() {
  try {
    await requireStaff();
  } catch {
    notFound();
  }
  const listings = await listForStaff();
  const pending = listings.filter((l) => l.status === "pending").length;

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <p className="text-xs font-semibold tracking-[0.6px] text-bronze uppercase">
        Make My Marriage team
      </p>
      <h1 className="mt-1 font-serif text-4xl leading-11 tracking-tight text-plum">
        Marketplace listings
      </h1>
      <p className="mt-1 mb-6 text-sm text-ink-2">
        {pending === 0 ? "Nothing is waiting for approval." : `${pending} waiting for approval.`}
      </p>
      {listings.length === 0 ? (
        <p className="rounded-xl bg-white p-6 text-sm text-ink-2">
          No vendors have created a listing yet.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {listings.map((l) => (
            <li
              key={l.id}
              className="rounded-xl bg-white p-5 shadow-[0_1px_3px_rgba(35,31,32,0.04)]"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1 basis-72">
                  <p className="text-xs text-ink-2">
                    {VENDOR_CATEGORY_LABELS[l.category]} · {l.cities.join(", ")} · {l.vendorEmail}
                  </p>
                  <h2 className="mt-1 font-serif text-xl text-ink">{l.businessName}</h2>
                  <p className="mt-1 text-[13px] whitespace-pre-line text-ink-2">{l.description}</p>
                  <p className="mt-2 text-[13px] text-ink-2">
                    {l.startingPrice !== undefined
                      ? `From ${formatRupees(l.startingPrice)}`
                      : "No price listed"}
                    {l.website ? ` · ${l.website}` : ""}
                    {l.instagram ? ` · ${l.instagram}` : ""}
                  </p>
                  {l.reviewNote ? (
                    <p className="mt-1 text-[13px] text-ink">Note: {l.reviewNote}</p>
                  ) : null}
                </div>
                <div className="flex flex-col items-end gap-2">
                  <span className="rounded-full bg-rose-200 px-2.5 py-0.5 text-[11px] font-semibold text-ink-2">
                    {LISTING_STATUS_LABELS[l.status]}
                  </span>
                  <StaffListingActions listingId={l.id} status={l.status} />
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
