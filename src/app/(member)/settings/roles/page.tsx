import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Plus } from "lucide-react";
import { requirePagePermission } from "@/lib/page-guard";
import { listRoles } from "@/modules/members/roles";

export const metadata: Metadata = { title: "Roles — Make My Marriage" };
export const dynamic = "force-dynamic";

const card = "rounded-xl bg-white p-4 shadow-[0_1px_3px_rgba(35,31,32,0.04)]";

export default async function RolesPage() {
  const ctx = await requirePagePermission("role.manage");
  const roles = await listRoles(ctx.weddingId);
  return (
    <main className="mx-auto w-full max-w-3xl pt-6">
      <Link
        href="/settings"
        className="mb-4 inline-flex items-center gap-2 text-[13px] font-semibold text-ink-2 hover:text-ink"
      >
        <ArrowLeft className="size-4" aria-hidden /> Settings
      </Link>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold tracking-[0.6px] text-bronze uppercase">Settings</p>
          <h1 className="mt-1 font-serif text-4xl leading-11 tracking-tight text-plum">Roles</h1>
          <p className="mt-1 text-sm text-ink-2">
            A role is a set of things a person may do. Give people roles under Members.
          </p>
        </div>
        <Link
          href="/settings/roles/new"
          className="inline-flex h-11 items-center gap-2 rounded-lg bg-bronze px-5 text-sm font-semibold text-white hover:bg-bronze/90"
        >
          <Plus className="size-4" aria-hidden /> New role
        </Link>
      </div>
      <ul className="mt-6 flex flex-col gap-3">
        {roles.map((r) => (
          <li key={r.id} className={`${card} flex flex-wrap items-center gap-3`}>
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-2 text-sm font-semibold text-ink">
                {r.name}
                {r.builtIn ? (
                  <span className="rounded-full bg-rose-200 px-2 py-0.5 text-[10px] font-medium text-ink-2">
                    Built in
                  </span>
                ) : null}
              </p>
              {r.description ? <p className="text-[13px] text-ink-2">{r.description}</p> : null}
              <p className="mt-0.5 font-mono text-xs text-ink-2">
                {r.grants.length} permissions · {r.memberCount}{" "}
                {r.memberCount === 1 ? "person" : "people"}
              </p>
            </div>
            <Link
              href={`/settings/roles/${r.id}`}
              className="rounded-lg bg-rose-100 px-3 py-1.5 text-xs font-semibold text-ink hover:bg-rose-200"
            >
              {r.builtIn ? "View" : "Edit"}
            </Link>
            <Link
              href={`/settings/roles/new?from=${r.id}`}
              className="rounded-lg px-3 py-1.5 text-xs font-semibold text-ink-2 hover:bg-rose-100"
            >
              Make a copy
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
