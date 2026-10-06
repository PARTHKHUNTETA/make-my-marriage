import type { Metadata } from "next";
import Link from "next/link";
import { Star } from "lucide-react";
import { MarketplaceFilters } from "@/components/marketplace/marketplace-filters";
import { VendorsTabs } from "@/components/vendors/vendors-tabs";
import { requireMember } from "@/lib/authz";
import { formatRupees } from "@/lib/money";
import { parseListingQuery } from "@/modules/marketplace/schema";
import { browseListings } from "@/modules/marketplace/service";
import { VENDOR_CATEGORY_LABELS } from "@/modules/vendors/schema";
import { getWedding } from "@/modules/wedding/service";

export const metadata: Metadata = { title: "Marketplace — Make My Marriage" };

export default async function MarketplacePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const ctx = await requireMember();
  const raw = await searchParams;
  const wedding = await getWedding(ctx.weddingId);
  // The wedding's own city is where most people look, so it is the starting point.
  const query = parseListingQuery(raw);
  const effective = { ...query, city: "city" in raw ? query.city : wedding?.city };
  const list = await browseListings(effective);
  const pages = Math.max(1, Math.ceil(list.total / list.pageSize));

  const pageHref = (page: number) => {
    const next = new URLSearchParams();
    for (const key of ["category", "city", "minPrice", "maxPrice", "sort"] as const) {
      const value = raw[key];
      if (typeof value === "string" && value) next.set(key, value);
    }
    if (page > 1) next.set("page", String(page));
    const q = next.toString();
    return q ? `/vendors/marketplace?${q}` : "/vendors/marketplace";
  };

  return (
    <main className="mx-auto w-full max-w-4xl pt-6">
      <p className="text-xs font-semibold tracking-[0.6px] text-bronze uppercase">Vendors</p>
      <h1 className="mt-1 font-serif text-4xl leading-11 tracking-tight text-plum">Marketplace</h1>
      <p className="mt-1 text-sm text-ink-2">
        Vendors who have joined Make My Marriage, approved by our team.
      </p>
      <VendorsTabs active="marketplace" />

      <div className="mt-6">
        <MarketplaceFilters defaultCity={wedding?.city ?? ""} />
      </div>

      {list.items.length === 0 ? (
        <div className="mt-6 rounded-xl bg-white p-8 text-center shadow-[0_1px_3px_rgba(35,31,32,0.04)]">
          <p className="font-serif text-xl text-ink">No vendors found</p>
          <p className="mt-1 text-sm text-ink-2">
            Try another city or category, or clear the price range. New vendors join all the time.
          </p>
        </div>
      ) : (
        <>
          <p className="mt-4 text-[13px] text-ink-2">
            {list.total} {list.total === 1 ? "vendor" : "vendors"}
          </p>
          <ul className="mt-2 grid gap-3 sm:grid-cols-2">
            {list.items.map((l) => (
              <li
                key={l.id}
                className="rounded-xl bg-white p-5 shadow-[0_1px_3px_rgba(35,31,32,0.04)]"
              >
                <span className="rounded-full bg-rose-200 px-2.5 py-0.5 text-[11px] font-semibold text-ink-2">
                  {VENDOR_CATEGORY_LABELS[l.category]}
                </span>
                <h2 className="mt-2 font-serif text-xl text-ink">
                  <Link href={`/vendors/marketplace/${l.id}`} className="hover:underline">
                    {l.businessName}
                  </Link>
                </h2>
                <p className="mt-0.5 text-[13px] text-ink-2">{l.cities.join(", ")}</p>
                <p className="mt-2 line-clamp-2 text-[13px] text-ink-2">{l.description}</p>
                <div className="mt-3 flex items-center justify-between text-[13px]">
                  <span className="font-semibold text-ink">
                    {l.startingPrice !== undefined
                      ? `From ${formatRupees(l.startingPrice)}`
                      : "Ask for a quote"}
                  </span>
                  {l.ratingCount > 0 && l.ratingAvg ? (
                    <span className="inline-flex items-center gap-1 text-ink-2">
                      <Star className="size-3.5 fill-honey text-honey" aria-hidden />
                      {l.ratingAvg.toFixed(1)} ({l.ratingCount})
                    </span>
                  ) : (
                    <span className="text-ink-2">No reviews yet</span>
                  )}
                </div>
              </li>
            ))}
          </ul>
          {pages > 1 ? (
            <nav aria-label="Pages" className="mt-4 flex items-center justify-between text-[13px]">
              {list.page > 1 ? (
                <Link
                  href={pageHref(list.page - 1)}
                  className="font-semibold text-bronze hover:underline"
                >
                  Previous
                </Link>
              ) : (
                <span />
              )}
              <span className="text-ink-2">
                Page {list.page} of {pages}
              </span>
              {list.page < pages ? (
                <Link
                  href={pageHref(list.page + 1)}
                  className="font-semibold text-bronze hover:underline"
                >
                  Next
                </Link>
              ) : (
                <span />
              )}
            </nav>
          ) : null}
        </>
      )}
    </main>
  );
}
