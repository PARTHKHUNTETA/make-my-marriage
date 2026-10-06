import type { Metadata } from "next";
import { PagePlaceholder } from "@/components/page-placeholder";

export const metadata: Metadata = {
  title: "Bookings — Make My Marriage",
  robots: { index: false },
};

export default function BookingsPage() {
  return <PagePlaceholder title="Bookings" phase="Coming next" />;
}
