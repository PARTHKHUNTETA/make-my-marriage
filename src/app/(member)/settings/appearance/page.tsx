import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PalettePicker } from "@/components/settings/palette-picker";
import { requireMember } from "@/lib/authz";

export const metadata: Metadata = { title: "Appearance — Make My Marriage" };
export const dynamic = "force-dynamic";

// Every member chooses their own colours; this never changes what anyone else sees.
export default async function AppearancePage() {
  const ctx = await requireMember();
  return (
    <main className="mx-auto w-full max-w-5xl pt-6">
      <Link
        href="/settings"
        className="mb-4 inline-flex items-center gap-2 text-[13px] font-semibold text-ink-2 hover:text-ink"
      >
        <ArrowLeft className="size-4" aria-hidden /> Settings
      </Link>
      <p className="text-xs font-semibold tracking-[0.6px] text-bronze uppercase">Settings</p>
      <h1 className="mt-1 font-serif text-4xl leading-11 tracking-tight text-plum">Appearance</h1>
      <p className="mt-1 mb-6 text-sm text-ink-2">
        Pick the colours you want to work in. It changes how the planning screens look for you only:
        other team members keep their own choice, and your guests, wedding website and emails look
        the same as before.
      </p>
      <PalettePicker current={ctx.palette} />
    </main>
  );
}
