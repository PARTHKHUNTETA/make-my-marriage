import type { Metadata } from "next";
import { PagePlaceholder } from "@/components/page-placeholder";

// Wedding sites are hidden from search engines by default (PRD 5.9).
export const metadata: Metadata = { robots: { index: false } };

// Phase 5: load the wedding by slug and render it in its theme (static with ISR).
// Reached on <slug>.<root domain> through the rewrite in src/proxy.ts.
export default async function WeddingSitePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <PagePlaceholder title={`Wedding site: ${slug}`} phase="Phase 5 · Wedding experience" />;
}
