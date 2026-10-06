import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SiteView } from "@/components/site/site-view";
import { getPublicSite } from "@/modules/website/service";

// Rebuilt at most once a minute, and straight away when the couple changes anything. Wedding sites
// are hidden from search engines (PRD 5.9). Reached at /<slug>, and on <slug>.<root domain>
// through the rewrite in src/proxy.ts.
export const revalidate = 60;

// No sites are built ahead of time; each is built on its first visit and then kept for a minute.
export function generateStaticParams() {
  return [];
}

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const site = await getPublicSite((await params).slug);
  return {
    title: site ? `${site.brideName} & ${site.groomName}` : "Wedding",
    robots: { index: false, follow: false },
  };
}

export default async function WeddingSitePage({ params }: Props) {
  const site = await getPublicSite((await params).slug);
  if (!site) notFound();
  return <SiteView site={site} />;
}
