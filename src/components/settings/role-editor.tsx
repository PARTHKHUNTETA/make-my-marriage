"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormAlert } from "@/components/auth/form-alert";
import { usePermissions } from "@/components/permissions/permissions-provider";
import { createRoleAction, deleteRoleAction, updateRoleAction } from "@/modules/members/actions";
import { PERMISSIONS, parseGrant, type Permission, type Scope } from "@/lib/permissions";

const GROUPS = [...new Set(Object.values(PERMISSIONS).map((p) => p.group))];
const input =
  "h-11 w-full rounded-lg border border-line-soft/60 bg-white px-3 text-sm text-ink outline-none focus:border-plum focus:ring-1 focus:ring-plum";

// Creates or edits a custom role: a name, a description, and the permissions it grants, grouped
// as the app is. Permissions the editor does not hold are shown but cannot be ticked, so nobody
// can make a role more powerful than themselves (the server checks again). `readOnly` shows a
// built-in role.
export function RoleEditor({
  roleId,
  initial,
  readOnly = false,
  inUse = 0,
}: {
  roleId?: string;
  initial: { name: string; description?: string; grants: readonly string[] };
  readOnly?: boolean;
  inUse?: number;
}) {
  const router = useRouter();
  const mine = usePermissions();
  const [name, setName] = React.useState(initial.name);
  const [description, setDescription] = React.useState(initial.description ?? "");
  const [chosen, setChosen] = React.useState<Map<Permission, Scope>>(
    () =>
      new Map(
        initial.grants.flatMap((g) => {
          const p = parseGrant(g);
          return p ? [[p.permission, p.scope] as const] : [];
        }),
      ),
  );
  const [busy, setBusy] = React.useState(false);
  const [problem, setProblem] = React.useState<string | null>(null);
  const [sure, setSure] = React.useState(false);

  const holds = (p: Permission, scope: Scope = "wedding") =>
    mine[p] === "wedding" || (mine[p] === "assigned" && scope === "assigned");

  function toggle(p: Permission) {
    setChosen((c) => {
      const next = new Map(c);
      if (next.has(p)) next.delete(p);
      else next.set(p, holds(p) ? "wedding" : "assigned");
      return next;
    });
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setProblem(null);
    const grants = [...chosen].map(([p, scope]) => (scope === "wedding" ? p : `${p}@${scope}`));
    const body = { name, description, grants };
    const r = roleId ? await updateRoleAction({ roleId, ...body }) : await createRoleAction(body);
    setBusy(false);
    if (!r.ok) return setProblem(r.error.message);
    router.push("/settings/roles");
    router.refresh();
  }

  async function remove() {
    if (!roleId) return;
    setBusy(true);
    const r = await deleteRoleAction({ roleId });
    setBusy(false);
    if (!r.ok) return setProblem(r.error.message);
    router.push("/settings/roles");
    router.refresh();
  }

  return (
    <form
      onSubmit={save}
      className="rounded-xl bg-white p-5 shadow-[0_1px_3px_rgba(35,31,32,0.04)] sm:p-6"
    >
      <fieldset disabled={readOnly || busy} className="flex min-w-0 flex-col gap-5">
        {problem ? <FormAlert title="Couldn't save the role">{problem}</FormAlert> : null}
        {readOnly ? (
          <p className="rounded-lg bg-rose-50 px-3.5 py-2.5 text-[13px] text-ink-2">
            Built-in roles can&apos;t be changed. Make a copy to adjust it.
          </p>
        ) : null}
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-xs font-semibold tracking-wide text-ink">
            Name
            <input
              className={input}
              value={name}
              maxLength={60}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Groom's family"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-semibold tracking-wide text-ink">
            Description (optional)
            <input
              className={input}
              value={description}
              maxLength={200}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Who this is for"
            />
          </label>
        </div>

        {GROUPS.map((group) => (
          <fieldset key={group} className="min-w-0">
            <legend className="mb-2 text-sm font-semibold text-ink">{group}</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {(Object.entries(PERMISSIONS) as [Permission, (typeof PERMISSIONS)[Permission]][])
                .filter(([, info]) => info.group === group)
                .map(([p, info]) => {
                  const scopes = "scopes" in info ? info.scopes : undefined;
                  const allowed =
                    holds(p) || (scopes?.includes("assigned") && holds(p, "assigned"));
                  return (
                    <div key={p} className="flex flex-col gap-1">
                      <label
                        className={`flex items-start gap-2 text-[13px] ${allowed ? "text-ink" : "text-ink-2/70"}`}
                      >
                        <input
                          type="checkbox"
                          className="mt-0.5 size-4 accent-plum"
                          checked={chosen.has(p)}
                          disabled={!allowed && !chosen.has(p)}
                          onChange={() => toggle(p)}
                        />
                        <span>
                          {info.label}
                          {!allowed ? (
                            <span className="block text-xs">
                              You don&apos;t have this yourself.
                            </span>
                          ) : null}
                        </span>
                      </label>
                      {scopes && chosen.has(p) ? (
                        <select
                          aria-label={`Which: ${info.label}`}
                          value={chosen.get(p)}
                          onChange={(e) =>
                            setChosen((c) => new Map(c).set(p, e.target.value as Scope))
                          }
                          className="ml-6 h-9 w-fit rounded-lg border border-line-soft/60 bg-white px-2 text-[13px]"
                        >
                          <option value="wedding" disabled={!holds(p)}>
                            All of them
                          </option>
                          <option value="assigned">Only ones assigned to them</option>
                        </select>
                      ) : null}
                    </div>
                  );
                })}
            </div>
          </fieldset>
        ))}

        {readOnly ? null : (
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={busy || !name.trim() || chosen.size === 0}
              className="h-11 rounded-lg bg-bronze px-5 text-sm font-semibold text-white hover:bg-bronze/90 disabled:opacity-50"
            >
              {busy ? "Saving..." : roleId ? "Save role" : "Create role"}
            </button>
            <Link
              href="/settings/roles"
              className="text-sm font-semibold text-ink-2 hover:text-ink"
            >
              Cancel
            </Link>
            {roleId ? (
              inUse > 0 ? (
                <span className="ml-auto text-xs text-ink-2">
                  {inUse} {inUse === 1 ? "person has" : "people have"} this role, so it can&apos;t
                  be deleted.
                </span>
              ) : sure ? (
                <button
                  type="button"
                  onClick={remove}
                  className="ml-auto h-11 rounded-lg bg-destructive px-4 text-sm font-semibold text-white"
                >
                  Delete for good
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setSure(true)}
                  className="ml-auto text-sm font-semibold text-destructive"
                >
                  Delete role
                </button>
              )
            ) : null}
          </div>
        )}
      </fieldset>
    </form>
  );
}
