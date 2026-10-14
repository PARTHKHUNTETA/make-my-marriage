import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { RoleEditor } from "@/components/settings/role-editor";
import { requirePagePermission } from "@/lib/page-guard";
import { getRole } from "@/modules/members/roles";

export const metadata: Metadata = { title: "New role — Make My Marriage" };
export const dynamic = "force-dynamic";

// A new custom role, empty or copied from another (?from=<role id>).
export default async function NewRolePage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>;
}) {
  const ctx = await requirePagePermission("role.manage");
  const { from } = await searchParams;
  const source = from ? await getRole(ctx.weddingId, from) : null;
  return (
    <main className="mx-auto w-full max-w-3xl pt-6">
      <Link
        href="/settings/roles"
        className="mb-4 inline-flex items-center gap-2 text-[13px] font-semibold text-ink-2 hover:text-ink"
      >
        <ArrowLeft className="size-4" aria-hidden /> Roles
      </Link>
      <h1 className="mb-6 font-serif text-4xl leading-11 tracking-tight text-plum">New role</h1>
      <RoleEditor
        initial={{
          name: source ? `${source.name} (copy)` : "",
          description: undefined, // a copy usually does something different; describe it afresh
          grants: source?.grants ?? [],
        }}
      />
    </main>
  );
}
