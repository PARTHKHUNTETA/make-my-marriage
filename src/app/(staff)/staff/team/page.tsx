import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { StaffRolesForm } from "@/components/staff/staff-roles-form";
import { requirePlatform } from "@/lib/authz";
import { getStaffEmails } from "@/lib/env";
import { listStaff } from "@/modules/members/service";

export const metadata: Metadata = { title: "Staff — Make My Marriage", robots: { index: false } };
export const dynamic = "force-dynamic";

// Who is on the Make My Marriage team and what each may do. Super admins only.
export default async function StaffTeamPage() {
  let me;
  try {
    me = await requirePlatform("staff.manage");
  } catch {
    notFound();
  }
  const staff = await listStaff();
  const bootstrap = getStaffEmails();
  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <Link href="/staff" className="text-[13px] font-semibold text-ink-2 hover:text-ink">
        ← Team screen
      </Link>
      <h1 className="mt-2 font-serif text-4xl text-plum">Staff and their roles</h1>
      <p className="mt-1 mb-6 text-sm text-ink-2">
        Super admins can do everything here. Moderators approve listings and remove reviews. Support
        can read the activity log. Everyone on the STAFF_EMAILS setting is always a super admin (
        {bootstrap.length} {bootstrap.length === 1 ? "address" : "addresses"}).
      </p>
      <ul className="mb-8 flex flex-col gap-3">
        {staff.map((s) => (
          <li key={s.userId}>
            <p className="mb-1 text-sm font-semibold text-ink">
              {s.name} {s.userId === me.userId ? "(you)" : ""}
            </p>
            {s.userId === me.userId ? (
              <p className="text-[13px] text-ink-2">
                {s.email}: {s.roles.join(", ")}
              </p>
            ) : (
              <StaffRolesForm email={s.email} roles={s.roles} />
            )}
          </li>
        ))}
      </ul>
      <h2 className="mb-2 font-serif text-2xl text-plum">Add someone</h2>
      <StaffRolesForm />
    </main>
  );
}
