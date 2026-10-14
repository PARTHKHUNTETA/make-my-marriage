import type { AuditAction, AuditEntry } from "@/lib/audit";
import { BUILT_IN_ROLES } from "@/lib/permissions";

const BUILT_IN_NAMES = new Map(Object.entries(BUILT_IN_ROLES).map(([id, r]) => [id, r.name]));

// The activity log as a plain list: when, who, what, and what changed. Role ids are shown by name.

const VERB: Record<AuditAction, string> = {
  "role.create": "created the role",
  "role.update": "changed the role",
  "role.delete": "deleted the role",
  "member.roles": "changed the roles of",
  "member.invite": "invited",
  "member.invite_cancel": "cancelled the invitation to",
  "member.remove": "removed",
  "wedding.delete": "deleted the wedding",
  "gallery.reset_link": "replaced",
  "staff.roles": "changed the staff roles of",
  "listing.decide": "decided on the listing",
  "review.remove": "removed",
};

const when = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "Asia/Kolkata",
});

function describe(value: unknown, roleName: (id: string) => string): string | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  if (Array.isArray(v.roleIds)) return (v.roleIds as string[]).map(roleName).join(", ");
  if (Array.isArray(v.roles)) return (v.roles as string[]).join(", ") || "no staff roles";
  if (Array.isArray(v.grants)) return `${(v.grants as string[]).length} permissions`;
  if (typeof v.decision === "string") return v.decision + (v.note ? ` (${String(v.note)})` : "");
  return null;
}

export function AuditList({
  entries,
  names,
  roleNames = new Map(),
}: {
  entries: AuditEntry[];
  names: Map<string, string>;
  roleNames?: Map<string, string>;
}) {
  const roleName = (id: string) => roleNames.get(id) ?? BUILT_IN_NAMES.get(id) ?? "a custom role";
  if (entries.length === 0)
    return <p className="rounded-xl bg-white p-6 text-sm text-ink-2">Nothing recorded yet.</p>;
  return (
    <ul className="divide-y divide-line rounded-xl bg-white shadow-[0_1px_3px_rgba(35,31,32,0.04)]">
      {entries.map((e) => {
        const before = describe(e.before, roleName);
        const after = describe(e.after, roleName);
        return (
          <li key={e.id} className="px-5 py-3.5">
            <p className="text-sm text-ink">
              <span className="font-semibold">{names.get(e.actorUserId) ?? "Someone"}</span>{" "}
              {VERB[e.action]} <span className="font-semibold">{e.target}</span>
            </p>
            {before || after ? (
              <p className="mt-0.5 text-[13px] text-ink-2">
                {before && after ? `${before} → ${after}` : (after ?? `was ${before}`)}
              </p>
            ) : null}
            <p className="mt-0.5 font-mono text-xs text-ink-2">{when.format(e.at)}</p>
          </li>
        );
      })}
    </ul>
  );
}
