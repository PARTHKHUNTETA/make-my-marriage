import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { DeleteWeddingForm } from "@/components/settings/delete-wedding-form";
import { requireAdmin } from "@/lib/authz";
import { PURGE_AFTER_DAYS } from "@/modules/deletion/schema";
import { getWedding } from "@/modules/wedding/service";

export const metadata: Metadata = { title: "Delete wedding — Make My Marriage" };
export const dynamic = "force-dynamic";

// Admins only: requireAdmin turns anyone else away.
export default async function DeleteWeddingPage() {
  const ctx = await requireAdmin();
  const wedding = await getWedding(ctx.weddingId);
  return (
    <main className="mx-auto w-full max-w-3xl pt-6">
      <Link
        href="/settings"
        className="mb-4 inline-flex items-center gap-2 text-[13px] font-semibold text-ink-2 hover:text-ink"
      >
        <ArrowLeft className="size-4" aria-hidden /> Settings
      </Link>
      <p className="text-xs font-semibold tracking-[0.6px] text-bronze uppercase">Settings</p>
      <h1 className="mt-1 font-serif text-4xl leading-11 tracking-tight text-plum">
        Delete wedding
      </h1>
      <p className="mt-1 mb-6 text-sm text-ink-2">This cannot be undone.</p>
      <section className="rounded-xl bg-white p-5 shadow-[0_1px_3px_rgba(35,31,32,0.04)]">
        <h2 className="text-sm font-semibold text-ink">What happens</h2>
        <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm text-ink-2">
          <li>
            The wedding disappears for everyone straight away: your team, your guests&apos; links
            and the wedding website.
          </li>
          <li>
            Guests, events, tasks, expenses, vendors, photos and every other record of this wedding
            are erased for good within {PURGE_AFTER_DAYS} days.
          </li>
          <li>
            Everyone on the team is removed. Their accounts stay, and they can start a new wedding.
          </li>
          <li>Download anything you want to keep first: guest list, expenses, vendors, photos.</li>
        </ul>
        <DeleteWeddingForm title={wedding?.title ?? ""} />
      </section>
    </main>
  );
}
