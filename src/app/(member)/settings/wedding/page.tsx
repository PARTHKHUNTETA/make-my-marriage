import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { EditWeddingForm } from "@/components/wedding/edit-wedding-form";
import { requireMember } from "@/lib/authz";
import { toIstYmd } from "@/lib/dates";
import { getWedding } from "@/modules/wedding/service";

export const metadata: Metadata = { title: "Wedding details — Make My Marriage" };

// Open to Admins and Managers alike (PRD 3).
export default async function WeddingDetailsPage() {
  const ctx = await requireMember();
  const wedding = await getWedding(ctx.weddingId);
  if (!wedding) notFound();

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
        Wedding details
      </h1>
      <p className="mt-1 mb-6 text-sm text-ink-2">
        The names, date and place shown across your dashboard, invitations and wedding website.
      </p>
      <EditWeddingForm
        initial={{
          brideName: wedding.brideName,
          groomName: wedding.groomName,
          title: wedding.title,
          date: toIstYmd(wedding.date),
          city: wedding.city,
          venue: wedding.venue ?? "",
          description: wedding.description ?? "",
        }}
      />
    </main>
  );
}
