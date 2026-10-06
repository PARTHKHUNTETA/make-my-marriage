import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { MuteForm } from "@/components/notifications/mute-form";
import { requireMember } from "@/lib/authz";
import { getMutedTypes } from "@/modules/members/service";

export const metadata: Metadata = { title: "Notifications — Make My Marriage" };
export const dynamic = "force-dynamic";

// Every member chooses their own alerts; this never changes what anyone else sees.
export default async function NotificationSettingsPage() {
  const ctx = await requireMember();
  const muted = await getMutedTypes(ctx.weddingId, ctx.memberId);
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
        Notifications
      </h1>
      <p className="mt-1 mb-6 text-sm text-ink-2">
        Choose which alerts appear in your bell. They show in the app only; nothing is emailed.
      </p>
      <MuteForm muted={muted} />
    </main>
  );
}
