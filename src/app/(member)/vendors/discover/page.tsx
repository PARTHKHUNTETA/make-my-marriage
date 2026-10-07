import type { Metadata } from "next";
import { DiscoverSearch } from "@/components/vendors/discover-search";
import { VendorsTabs } from "@/components/vendors/vendors-tabs";
import { requireMember } from "@/lib/authz";
import { getWedding } from "@/modules/wedding/service";

export const metadata: Metadata = { title: "Discover vendors — Make My Marriage" };

export default async function DiscoverPage() {
  const ctx = await requireMember();
  const wedding = await getWedding(ctx.weddingId);
  return (
    <main className="mx-auto w-full max-w-4xl pt-6">
      <p className="text-xs font-semibold tracking-[0.6px] text-bronze uppercase">Vendors</p>
      <h1 className="mt-1 font-serif text-4xl leading-11 tracking-tight text-plum">Discover</h1>
      <p className="mt-1 text-sm text-ink-2">
        Find wedding vendors near you on Google, then add the ones you like to My vendors.
      </p>
      <VendorsTabs active="discover" />
      <div className="mt-6">
        <DiscoverSearch defaultCity={wedding?.city ?? ""} />
      </div>
    </main>
  );
}
