import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { RoleEditor } from "@/components/settings/role-editor";
import { requirePagePermission } from "@/lib/page-guard";
import { getRole } from "@/modules/members/roles";

export const metadata: Metadata = { title: "Role — Make My Marriage" };
export const dynamic = "force-dynamic";

export default async function RolePage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requirePagePermission("role.manage");
  const role = await getRole(ctx.weddingId, (await params).id);
  if (!role) notFound();
  return (
    <main className="mx-auto w-full max-w-3xl pt-6">
      <Link
        href="/settings/roles"
        className="mb-4 inline-flex items-center gap-2 text-[13px] font-semibold text-ink-2 hover:text-ink"
      >
        <ArrowLeft className="size-4" aria-hidden /> Roles
      </Link>
      <h1 className="mb-6 font-serif text-4xl leading-11 tracking-tight text-plum">{role.name}</h1>
      <RoleEditor
        roleId={role.builtIn ? undefined : role.id}
        readOnly={role.builtIn}
        inUse={role.memberCount}
        initial={role}
      />
    </main>
  );
}
