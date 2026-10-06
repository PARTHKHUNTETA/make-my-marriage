import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { MembersManager } from "@/components/members/members-manager";
import { canManageMembers, requireMember } from "@/lib/authz";
import { listTeam } from "@/modules/members/service";

export const metadata: Metadata = { title: "Members — Make My Marriage" };

// Hidden from Managers entirely (PRD 3): to them this page does not exist.
export default async function MembersPage() {
  const ctx = await requireMember();
  if (!canManageMembers(ctx)) notFound();
  const team = await listTeam(ctx.weddingId);

  return (
    <main className="mx-auto w-full max-w-3xl pt-6">
      <Link
        href="/settings"
        className="mb-4 inline-flex items-center gap-2 text-[13px] font-semibold text-ink-2 hover:text-ink"
      >
        <ArrowLeft className="size-4" aria-hidden /> Settings
      </Link>
      <p className="text-xs font-semibold tracking-[0.6px] text-bronze uppercase">Settings</p>
      <h1 className="mt-1 font-serif text-4xl leading-11 tracking-tight text-plum">Members</h1>
      <p className="mt-1 mb-6 text-sm text-ink-2">
        Admins can do everything, including managing members. Managers can do everything else.
      </p>
      <MembersManager members={team.members} invites={team.invites} currentUserId={ctx.userId} />
    </main>
  );
}
