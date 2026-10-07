import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { VendorForm } from "@/components/vendors/vendor-form";
import { requireMember } from "@/lib/authz";
import { prefillFromQuery } from "@/modules/vendors/schema";
import { listEvents } from "@/modules/events/service";

export const metadata: Metadata = { title: "Add vendor — Make My Marriage" };

export default async function NewVendorPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const prefill = prefillFromQuery(await searchParams);
  const ctx = await requireMember();
  const events = await listEvents(ctx.weddingId);
  return (
    <main className="mx-auto w-full max-w-3xl pt-6">
      <Link
        href="/vendors"
        className="mb-4 inline-flex items-center gap-2 text-[13px] font-semibold text-ink-2 hover:text-ink"
      >
        <ArrowLeft className="size-4" aria-hidden /> Vendors
      </Link>
      <h1 className="mb-6 font-serif text-4xl leading-11 tracking-tight text-plum">Add vendor</h1>
      <VendorForm
        initial={{
          name: prefill.name ?? "",
          category: prefill.category ?? "photographer",
          phone: prefill.phone ?? "",
          email: "",
          address: prefill.address ?? "",
          totalCost: "",
          eventIds: [],
          notes: "",
        }}
        events={events.map((e) => ({ id: e.id, name: e.name }))}
      />
    </main>
  );
}
