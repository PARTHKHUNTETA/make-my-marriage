import type { Metadata } from "next";
import Link from "next/link";
import { Mail, Phone, Plus } from "lucide-react";
import { VendorFilters } from "@/components/vendors/vendor-filters";
import { VendorsTabs } from "@/components/vendors/vendors-tabs";
import { requireMember } from "@/lib/authz";
import { formatRupees } from "@/lib/money";
import { listEvents } from "@/modules/events/service";
import { VENDOR_CATEGORY_LABELS, parseVendorQuery } from "@/modules/vendors/schema";
import { listVendors } from "@/modules/vendors/service";

export const metadata: Metadata = { title: "Vendors — Make My Marriage" };

export default async function VendorsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const ctx = await requireMember();
  const query = parseVendorQuery(await searchParams);
  const [events, list] = await Promise.all([
    listEvents(ctx.weddingId),
    listVendors(ctx.weddingId, query),
  ]);
  const eventNames = new Map(events.map((e) => [e.id, e.name]));
  const filtered = Boolean(query.category || query.eventId);
  const link =
    "inline-flex items-center gap-1.5 rounded-lg bg-rose-100 px-3 py-1.5 text-xs font-semibold text-ink hover:bg-rose-200";

  return (
    <main className="mx-auto w-full max-w-4xl pt-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold tracking-[0.6px] text-bronze uppercase">Vendors</p>
          <h1 className="mt-1 font-serif text-4xl leading-11 tracking-tight text-plum">
            My vendors
          </h1>
          <p className="mt-1 text-sm text-ink-2">
            The photographer, caterer, decorator and everyone else you have chosen.
          </p>
        </div>
        <Link
          href="/vendors/new"
          className="inline-flex h-11 items-center gap-2 rounded-lg bg-bronze px-5 text-sm font-semibold text-white hover:bg-bronze/90"
        >
          <Plus className="size-4" aria-hidden /> Add vendor
        </Link>
      </div>

      <VendorsTabs active="mine" />

      <div className="mt-6">
        <VendorFilters events={events.map((e) => ({ id: e.id, name: e.name }))} />
      </div>

      {list.length === 0 ? (
        <div className="mt-6 rounded-xl bg-white p-8 text-center shadow-[0_1px_3px_rgba(35,31,32,0.04)]">
          <p className="font-serif text-xl text-ink">
            {filtered ? "No vendors match" : "No vendors yet"}
          </p>
          <p className="mt-1 text-sm text-ink-2">
            {filtered
              ? "Try different filters."
              : "Add your vendors to keep their contacts, costs and payments together."}
          </p>
        </div>
      ) : (
        <ul className="mt-6 flex flex-col gap-3">
          {list.map(({ vendor, spent }) => (
            <li
              key={vendor.id}
              className="rounded-xl bg-white p-5 shadow-[0_1px_3px_rgba(35,31,32,0.04)]"
            >
              <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
                <div className="min-w-0">
                  <span className="rounded-full bg-rose-200 px-2.5 py-0.5 text-[11px] font-semibold text-ink-2">
                    {VENDOR_CATEGORY_LABELS[vendor.category]}
                  </span>
                  <h2 className="mt-2 font-serif text-xl text-ink">
                    <Link href={`/vendors/${vendor.id}`} className="hover:underline">
                      {vendor.name}
                    </Link>
                  </h2>
                  {vendor.eventIds.length > 0 ? (
                    <p className="mt-0.5 text-[13px] text-ink-2">
                      {vendor.eventIds
                        .map((id) => eventNames.get(id))
                        .filter(Boolean)
                        .join(", ")}
                    </p>
                  ) : null}
                </div>
                <div className="text-right text-[13px] text-ink-2">
                  <p>
                    Spent so far <strong className="text-ink">{formatRupees(spent)}</strong>
                  </p>
                  {vendor.totalCost !== undefined ? (
                    <p>
                      of {formatRupees(vendor.totalCost)}
                      {vendor.totalCost - spent >= 0
                        ? ` · ${formatRupees(vendor.totalCost - spent)} to pay`
                        : ` · ${formatRupees(spent - vendor.totalCost)} over`}
                    </p>
                  ) : null}
                </div>
              </div>
              {vendor.phone || vendor.email ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {vendor.phone ? (
                    <a href={`tel:${vendor.phone}`} className={link}>
                      <Phone className="size-3.5" aria-hidden /> {vendor.phone}
                    </a>
                  ) : null}
                  {vendor.email ? (
                    <a href={`mailto:${vendor.email}`} className={link}>
                      <Mail className="size-3.5" aria-hidden /> {vendor.email}
                    </a>
                  ) : null}
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
