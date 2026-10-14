import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { AuditList } from "@/components/audit/audit-list";
import { listWeddingAudit } from "@/lib/audit";
import { requirePagePermission } from "@/lib/page-guard";
import { listRoles } from "@/modules/members/roles";
import { namesByUserId } from "@/modules/members/service";

export const metadata: Metadata = { title: "Activity — Make My Marriage" };
export const dynamic = "force-dynamic";

// Who changed the team, its roles, or did something that cannot be undone, and when.
export default async function ActivityPage() {
  const ctx = await requirePagePermission("member.manage");
  const [entries, roles] = await Promise.all([
    listWeddingAudit(ctx.weddingId),
    listRoles(ctx.weddingId),
  ]);
  const names = await namesByUserId(entries.map((e) => e.actorUserId));
  return (
    <main className="mx-auto w-full max-w-3xl pt-6">
      <Link
        href="/settings"
        className="mb-4 inline-flex items-center gap-2 text-[13px] font-semibold text-ink-2 hover:text-ink"
      >
        <ArrowLeft className="size-4" aria-hidden /> Settings
      </Link>
      <p className="text-xs font-semibold tracking-[0.6px] text-bronze uppercase">Settings</p>
      <h1 className="mt-1 font-serif text-4xl leading-11 tracking-tight text-plum">Activity</h1>
      <p className="mt-1 mb-6 text-sm text-ink-2">
        Changes to the team and its roles, and anything that cannot be undone. Kept for two years.
      </p>
      <AuditList
        entries={entries}
        names={names}
        roleNames={new Map(roles.map((r) => [r.id, r.name]))}
      />
    </main>
  );
}
