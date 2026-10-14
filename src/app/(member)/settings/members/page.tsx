import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { MembersManager } from "@/components/members/members-manager";
import { hasPermission } from "@/lib/authz";
import { requirePagePermission } from "@/lib/page-guard";
import { listRoles } from "@/modules/members/roles";
import { listTeam } from "@/modules/members/service";

export const metadata: Metadata = { title: "Members — Make My Marriage" };

// Only for people who can manage the team: to anyone else this page does not exist (PRD 3).
export default async function MembersPage() {
  const ctx = await requirePagePermission("member.manage");
  const [team, roles] = await Promise.all([listTeam(ctx.weddingId), listRoles(ctx.weddingId)]);

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
        Each person has one or more roles. Roles decide what they can see and change.{" "}
        {hasPermission(ctx, "role.manage") ? (
          <Link href="/settings/roles" className="font-semibold text-bronze hover:underline">
            Manage roles
          </Link>
        ) : null}{" "}
        <Link href="/settings/activity" className="font-semibold text-bronze hover:underline">
          See activity
        </Link>
      </p>
      <MembersManager
        members={team.members}
        invites={team.invites}
        currentUserId={ctx.userId}
        roles={roles.map(({ id, name, description }) => ({ id, name, description }))}
      />
    </main>
  );
}
