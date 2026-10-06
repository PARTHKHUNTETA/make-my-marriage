import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { DeleteVendorButton } from "@/components/vendors/delete-vendor-button";
import { PaymentSchedule } from "@/components/vendors/payment-schedule";
import { VendorForm } from "@/components/vendors/vendor-form";
import { requireMember } from "@/lib/authz";
import { formatRupees, toRupeeInput } from "@/lib/money";
import { listEvents } from "@/modules/events/service";
import { getVendor, getVendorSpend } from "@/modules/vendors/service";

export const metadata: Metadata = { title: "Vendor — Make My Marriage" };

export default async function VendorPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireMember();
  const { id } = await params;
  const [vendor, events, spent] = await Promise.all([
    getVendor(ctx.weddingId, id),
    listEvents(ctx.weddingId),
    getVendorSpend(ctx.weddingId, id),
  ]);
  if (!vendor) notFound();
  const known = new Set(events.map((e) => e.id));
  const paid = vendor.installments
    .filter((i) => i.status === "paid")
    .reduce((s, i) => s + i.amount, 0);
  const planned = vendor.installments.reduce((s, i) => s + i.amount, 0);

  return (
    <main className="mx-auto w-full max-w-3xl pt-6">
      <Link
        href="/vendors"
        className="mb-4 inline-flex items-center gap-2 text-[13px] font-semibold text-ink-2 hover:text-ink"
      >
        <ArrowLeft className="size-4" aria-hidden /> Vendors
      </Link>
      <h1 className="font-serif text-4xl leading-11 tracking-tight text-plum">{vendor.name}</h1>
      <p className="mt-1 mb-6 text-sm text-ink-2">
        Spent so far <strong className="text-ink">{formatRupees(spent)}</strong>
        {vendor.totalCost !== undefined ? ` of ${formatRupees(vendor.totalCost)}` : ""}
        {vendor.installments.length > 0
          ? ` · ${formatRupees(paid)} of ${formatRupees(planned)} scheduled payments made`
          : ""}
      </p>
      <div className="flex flex-col gap-6">
        <VendorForm
          vendorId={vendor.id}
          initial={{
            name: vendor.name,
            category: vendor.category,
            phone: vendor.phone ?? "",
            email: vendor.email ?? "",
            address: vendor.address ?? "",
            totalCost: vendor.totalCost === undefined ? "" : toRupeeInput(vendor.totalCost),
            eventIds: vendor.eventIds.filter((e) => known.has(e)),
            notes: vendor.notes ?? "",
          }}
          events={events.map((e) => ({ id: e.id, name: e.name }))}
        />
        <PaymentSchedule vendorId={vendor.id} installments={vendor.installments} />
        <DeleteVendorButton vendorId={vendor.id} name={vendor.name} />
      </div>
    </main>
  );
}
