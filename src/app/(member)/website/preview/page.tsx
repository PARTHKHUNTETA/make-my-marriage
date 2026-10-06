import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteView } from "@/components/site/site-view";
import { requireMember } from "@/lib/authz";
import { getSitePreview } from "@/modules/website/service";

export const metadata: Metadata = { title: "Preview — Make My Marriage", robots: { index: false } };
export const dynamic = "force-dynamic";

// The couple's own website as guests will see it, shown even while the site is off.
export default async function PreviewPage() {
  const ctx = await requireMember();
  const site = await getSitePreview(ctx.weddingId);
  if (!site) notFound();
  return (
    <div className="-mx-4 -mt-6 sm:-mx-6 lg:-mx-8">
      <div className="bg-white px-4 py-2 text-[13px]">
        <Link href="/website" className="font-semibold text-bronze hover:underline">
          ← Back to website settings
        </Link>
      </div>
      <SiteView site={site} />
    </div>
  );
}
