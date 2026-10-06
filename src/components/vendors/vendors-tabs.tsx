import Link from "next/link";

// The three parts of Vendors: the couple's own list, the marketplace, and their booking requests.
export function VendorsTabs({ active }: { active: "mine" | "marketplace" | "bookings" }) {
  const tab = (key: typeof active, href: string, label: string) => (
    <Link
      href={href}
      aria-current={active === key ? "page" : undefined}
      className={`rounded-full px-4 py-1.5 text-[13px] font-semibold transition-colors ${
        active === key ? "bg-plum text-white" : "bg-white text-ink-2 hover:bg-rose-200"
      }`}
    >
      {label}
    </Link>
  );
  return (
    <nav aria-label="Vendor pages" className="mt-5 flex flex-wrap gap-2">
      {tab("mine", "/vendors", "My vendors")}
      {tab("marketplace", "/vendors/marketplace", "Marketplace")}
      {tab("bookings", "/vendors/bookings", "Bookings")}
    </nav>
  );
}
