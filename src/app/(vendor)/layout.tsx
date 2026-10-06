import type { Metadata } from "next";

export const metadata: Metadata = { robots: { index: false } };

// Phase 4: call requireVendor() here. Vendors use a separate account space and cookie.
export default function VendorLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <>{children}</>;
}
