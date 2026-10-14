import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteView } from "@/components/site/site-view";
import { requirePagePermission } from "@/lib/page-guard";
import { getSitePreview } from "@/modules/website/service";

export const metadata: Metadata = { title: "Preview — Make My Marriage", robots: { index: false } };
export const dynamic = "force-dynamic";

// The couple's own website as guests will see it, shown even while the site is off.
export default async function PreviewPage() {
  const ctx = await requirePagePermission("wedding.update");
  const site = await getSitePreview(ctx.weddingId);
  if (!site) notFound();
  return (
    // Edge to edge inside the member layout (which pads its content by px-6), but never under the
    // fixed top bar: the way back stays pinned just below it while the preview scrolls.
    <div className="-mx-6">
      <div className="sticky top-16 z-30 border-b border-line bg-white px-6 py-2.5 text-[13px] shadow-sm">
        <Link
          href="/website"
          className="inline-flex items-center gap-1 font-semibold text-bronze hover:underline"
        >
          ← Back to website settings
        </Link>
      </div>
      <SiteView site={site} />
    </div>
  );
}
