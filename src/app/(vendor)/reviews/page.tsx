import type { Metadata } from "next";
import { PagePlaceholder } from "@/components/page-placeholder";

export const metadata: Metadata = { title: "Reviews — Make My Marriage", robots: { index: false } };

export default function ReviewsPage() {
  return <PagePlaceholder title="Reviews" phase="Coming next" />;
}
