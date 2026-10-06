import type { Metadata } from "next";
import Link from "next/link";
import { Bell, ChevronRight, Settings2, Trash2, Users } from "lucide-react";
import { canManageMembers, requireMember } from "@/lib/authz";

export const metadata: Metadata = { title: "Settings — Make My Marriage" };

const card =
  "flex items-center gap-4 rounded-xl bg-white p-4 shadow-[0_1px_3px_rgba(35,31,32,0.04)]";

export default async function SettingsPage() {
  const ctx = await requireMember();
  return (
    <main className="mx-auto w-full max-w-3xl pt-6">
      <p className="text-xs font-semibold tracking-[0.6px] text-bronze uppercase">Settings</p>
      <h1 className="mt-1 font-serif text-4xl leading-11 tracking-tight text-plum">
        Wedding settings
      </h1>
      <p className="mt-1 mb-6 text-sm text-ink-2">Things that apply to the whole wedding.</p>

      <div className="flex flex-col gap-3">
        {canManageMembers(ctx) ? (
          <Link href="/settings/members" className={`${card} transition-colors hover:bg-rose-50`}>
            <span className="flex size-10 items-center justify-center rounded-lg bg-rose-100">
              <Users className="size-5 text-plum" aria-hidden />
            </span>
            <span className="flex-1">
              <span className="block text-sm font-semibold text-ink">Members</span>
              <span className="block text-[13px] text-ink-2">
                Invite family and friends to help plan, and manage who can do what.
              </span>
            </span>
            <ChevronRight className="size-4 text-ink-2" aria-hidden />
          </Link>
        ) : null}
        <Link href="/settings/wedding" className={`${card} transition-colors hover:bg-rose-50`}>
          <span className="flex size-10 items-center justify-center rounded-lg bg-rose-100">
            <Settings2 className="size-5 text-plum" aria-hidden />
          </span>
          <span className="flex-1">
            <span className="block text-sm font-semibold text-ink">Wedding details</span>
            <span className="block text-[13px] text-ink-2">
              The couple&rsquo;s names, the date, city and venue, and your welcome message.
            </span>
          </span>
          <ChevronRight className="size-4 text-ink-2" aria-hidden />
        </Link>
        <Link
          href="/settings/notifications"
          className={`${card} transition-colors hover:bg-rose-50`}
        >
          <span className="flex size-10 items-center justify-center rounded-lg bg-rose-100">
            <Bell className="size-5 text-plum" aria-hidden />
          </span>
          <span className="flex-1">
            <span className="block text-sm font-semibold text-ink">Notifications</span>
            <span className="block text-[13px] text-ink-2">
              Choose which alerts show in your bell.
            </span>
          </span>
          <ChevronRight className="size-4 text-ink-2" aria-hidden />
        </Link>
        {canManageMembers(ctx) ? (
          <div className={`${card} opacity-60`}>
            <span className="flex size-10 items-center justify-center rounded-lg bg-rose-100">
              <Trash2 className="size-5 text-plum" aria-hidden />
            </span>
            <span className="flex-1">
              <span className="block text-sm font-semibold text-ink">Delete wedding</span>
              <span className="block text-[13px] text-ink-2">
                Permanently remove the wedding and all its data. Coming soon.
              </span>
            </span>
          </div>
        ) : null}
      </div>
    </main>
  );
}
