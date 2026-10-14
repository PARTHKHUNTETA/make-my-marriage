import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AuditList } from "@/components/audit/audit-list";
import { listAllAudit } from "@/lib/audit";
import { requirePlatform } from "@/lib/authz";
import { namesByUserId } from "@/modules/members/service";

export const metadata: Metadata = {
  title: "Activity log — Make My Marriage",
  robots: { index: false },
};
export const dynamic = "force-dynamic";

// Everything in the audit log, across weddings and the team's own actions. Staff with audit.view.
export default async function StaffActivityPage() {
  try {
    await requirePlatform("audit.view");
  } catch {
    notFound();
  }
  const entries = await listAllAudit();
  const names = await namesByUserId(entries.map((e) => e.actorUserId));
  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <Link href="/staff" className="text-[13px] font-semibold text-ink-2 hover:text-ink">
        ← Team screen
      </Link>
      <h1 className="mt-2 mb-6 font-serif text-4xl text-plum">Activity log</h1>
      <AuditList entries={entries} names={names} />
    </main>
  );
}
