import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SignOutButton } from "@/components/sign-out-button";
import { VerifyEmailBanner } from "@/components/verify-email-banner";
import { resolveVendorContext } from "@/lib/context";
import { getVendorProfile } from "@/modules/marketplace/service";

export const metadata: Metadata = { robots: { index: false } };
export const dynamic = "force-dynamic";

// The vendor portal. Only a vendor session gets in (a wedding member's session never does), and
// nothing here can reach a wedding's data.
export default async function VendorLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const ctx = await resolveVendorContext();
  const profile = ctx ? await getVendorProfile(ctx.vendorAccountId) : null;
  if (!profile) redirect("/vendor/login");

  const nav =
    "rounded-lg px-3 py-1.5 text-sm font-semibold text-ink-2 hover:bg-rose-100 hover:text-ink";
  return (
    <div className="min-h-screen bg-blush">
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-2 px-4 py-3">
          <span className="font-serif text-lg text-plum">{profile.businessName}</span>
          <nav aria-label="Vendor portal" className="flex flex-wrap items-center gap-1">
            <Link href="/listing" className={nav}>
              Listing
            </Link>
            <Link href="/bookings" className={nav}>
              Bookings
            </Link>
            <Link href="/reviews" className={nav}>
              Reviews
            </Link>
            <SignOutButton endpoint="/api/vendor/logout" redirectTo="/vendor/login" />
          </nav>
        </div>
      </header>
      <div className="mx-auto max-w-4xl px-4 pb-16">
        {profile.emailVerified ? null : (
          <div className="pt-4">
            <VerifyEmailBanner email={profile.email} endpoint="/api/vendor/resend-verification" />
          </div>
        )}
        {children}
      </div>
    </div>
  );
}
