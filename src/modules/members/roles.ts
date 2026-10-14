import "server-only";
import type { ClientSession } from "mongodb";
import { inTransaction } from "@/lib/db";
import { AppError } from "@/lib/errors";
import {
  BUILT_IN_ROLES,
  can,
  grantsWithin,
  isBuiltInRoleId,
  legacyRoleFor,
  mergeGrants,
  type BuiltInRoleId,
  type PermissionSet,
} from "@/lib/permissions";
import {
  countInvitesWithRole,
  countMembersWithRoles,
  deleteWeddingRole,
  findMembership,
  findWeddingRoles,
  insertWeddingRole,
  listMemberRoleIds,
  listWeddingRoles,
  lockAdmins,
  setLegacyRoles,
  setMemberRoleIds,
  updateWeddingRole,
  type WeddingRoleDoc,
} from "./repository";
import type { RoleInput } from "./schema";

// Custom roles and who holds which (RBAC design, sections f and i). The rules that keep this safe:
//   - nobody hands out more than they hold: a role's grants, and the roles assigned to someone, must
//     be within the permissions of the person doing it;
//   - nobody changes their own roles, or the roles of someone who can do more than they can;
//   - the wedding always keeps at least one person who can manage the team;
//   - built-in roles are fixed, and a role still held or offered in an invitation cannot be deleted.

export type RoleOption = {
  id: string;
  name: string;
  description?: string;
  grants: readonly string[];
  builtIn: boolean;
  memberCount: number;
};

const ORDER: BuiltInRoleId[] = ["admin", "manager", "finance", "viewer"];

const NO_ESCALATION = "You can only give permissions that you have yourself.";
const LAST_MANAGER =
  "Someone must still be able to manage the team. Give another person that role first.";

export async function listRoles(weddingId: string): Promise<RoleOption[]> {
  const custom = await listWeddingRoles(weddingId);
  const ids = [...ORDER, ...custom.map((r) => r._id.toHexString())];
  const counts = new Map<string, number>();
  for (const m of await listMemberRoleIds(weddingId))
    for (const id of m.roleIds?.length ? m.roleIds : [m.role])
      counts.set(id, (counts.get(id) ?? 0) + 1);
  return ids.map((id) => {
    if (isBuiltInRoleId(id)) {
      const r = BUILT_IN_ROLES[id];
      return { id, ...r, builtIn: true, memberCount: counts.get(id) ?? 0 };
    }
    const r = custom.find((c) => c._id.toHexString() === id)!;
    return {
      id,
      name: r.name,
      description: r.description,
      grants: r.grants,
      builtIn: false,
      memberCount: counts.get(id) ?? 0,
    };
  });
}

export async function getRole(weddingId: string, roleId: string): Promise<RoleOption | null> {
  return (await listRoles(weddingId)).find((r) => r.id === roleId) ?? null;
}

// The grants of each role id, built-in or this wedding's own. Unknown ids are left out.
async function grantsById(
  weddingId: string,
  ids: string[],
  override?: { id: string; grants: string[] | null },
): Promise<Map<string, readonly string[]>> {
  const map = new Map<string, readonly string[]>();
  const custom = ids.filter((id) => !isBuiltInRoleId(id));
  const docs: WeddingRoleDoc[] = custom.length ? await findWeddingRoles(weddingId, custom) : [];
  for (const id of ids) if (isBuiltInRoleId(id)) map.set(id, BUILT_IN_ROLES[id].grants);
  for (const d of docs) map.set(d._id.toHexString(), d.grants);
  if (override) {
    if (override.grants) map.set(override.id, override.grants);
    else map.delete(override.id);
  }
  return map;
}

// After a change, works out every member's permissions, refuses it if nobody could still manage the
// team, and returns the legacy role each member should now have. Runs inside the caller's
// transaction, after lockAdmins, so two changes at once cannot both remove the last manager.
async function checkTeamStillManaged(
  weddingId: string,
  change: { memberId?: string; roleIds?: string[]; role?: { id: string; grants: string[] | null } },
  session: ClientSession,
): Promise<{ memberId: string; role: "admin" | "manager" }[]> {
  await lockAdmins(weddingId, { session });
  const members = await listMemberRoleIds(weddingId, { session });
  const roleIdsOf = (m: (typeof members)[number]) =>
    change.memberId === m._id.toHexString() && change.roleIds
      ? change.roleIds
      : m.roleIds?.length
        ? m.roleIds
        : [m.role];
  const all = [...new Set(members.flatMap(roleIdsOf))];
  const grants = await grantsById(weddingId, all, change.role);
  const legacy = members.map((m) => {
    const set = mergeGrants(roleIdsOf(m).map((id) => grants.get(id) ?? []));
    return { memberId: m._id.toHexString(), role: legacyRoleFor(set), set };
  });
  if (!legacy.some((l) => can(l.set, "member.manage")))
    throw new AppError("LAST_ADMIN", LAST_MANAGER);
  return legacy.map(({ memberId, role }) => ({ memberId, role }));
}

export async function createRole(
  weddingId: string,
  actor: PermissionSet,
  input: RoleInput,
): Promise<RoleOption> {
  if (!grantsWithin(input.grants, actor)) throw new AppError("FORBIDDEN", NO_ESCALATION);
  const doc = await insertWeddingRole(weddingId, input);
  if (!doc) throw new AppError("VALIDATION_FAILED", "A role with that name already exists.");
  return {
    id: doc._id.toHexString(),
    name: doc.name,
    description: doc.description,
    grants: doc.grants,
    builtIn: false,
    memberCount: 0,
  };
}

// Returns the role as it was (for the audit log).
export async function updateRole(
  weddingId: string,
  actor: PermissionSet,
  roleId: string,
  input: RoleInput,
): Promise<{ before: WeddingRoleDoc }> {
  if (isBuiltInRoleId(roleId))
    throw new AppError("FORBIDDEN", "Built-in roles cannot be changed. Make a copy instead.");
  if (!grantsWithin(input.grants, actor)) throw new AppError("FORBIDDEN", NO_ESCALATION);
  return inTransaction(async (session) => {
    const legacy = await checkTeamStillManaged(
      weddingId,
      { role: { id: roleId, grants: input.grants } },
      session,
    );
    const before = await updateWeddingRole(weddingId, roleId, input);
    if (before === "taken")
      throw new AppError("VALIDATION_FAILED", "A role with that name already exists.");
    if (!before) throw new AppError("NOT_FOUND", "That role no longer exists.");
    await setLegacyRoles(weddingId, legacy, { session });
    return { before };
  });
}

export async function deleteRole(
  weddingId: string,
  roleId: string,
): Promise<{ before: WeddingRoleDoc }> {
  if (isBuiltInRoleId(roleId)) throw new AppError("FORBIDDEN", "Built-in roles cannot be deleted.");
  const [holders, invited] = await Promise.all([
    countMembersWithRoles(weddingId, [roleId]),
    countInvitesWithRole(weddingId, roleId),
  ]);
  if (holders > 0 || invited > 0)
    throw new AppError(
      "VALIDATION_FAILED",
      "People still have this role, or have been invited with it. Change their roles first.",
    );
  const before = await deleteWeddingRole(weddingId, roleId);
  if (!before) throw new AppError("NOT_FOUND", "That role no longer exists.");
  return { before };
}

// Checks a set of roles someone wants to give: each must exist in this wedding, and together they
// must not grant more than the giver holds. Returns them without duplicates.
export async function checkGivableRoles(
  weddingId: string,
  actor: PermissionSet,
  roleIds: string[],
): Promise<string[]> {
  const ids = [...new Set(roleIds)];
  if (ids.length === 0) throw new AppError("VALIDATION_FAILED", "Choose at least one role.");
  const grants = await grantsById(weddingId, ids);
  if (ids.some((id) => !grants.has(id)))
    throw new AppError("VALIDATION_FAILED", "One of those roles no longer exists.");
  if (
    !grantsWithin(
      ids.flatMap((id) => [...grants.get(id)!]),
      actor,
    )
  )
    throw new AppError("FORBIDDEN", NO_ESCALATION);
  return ids;
}

export async function setMemberRoles(input: {
  weddingId: string;
  actor: { memberId: string; permissions: PermissionSet };
  memberId: string;
  roleIds: string[];
}): Promise<{ before: string[]; after: string[] }> {
  const { weddingId, actor } = input;
  if (input.memberId === actor.memberId)
    throw new AppError("FORBIDDEN", "You can't change your own roles. Ask another admin.");
  const roleIds = await checkGivableRoles(weddingId, actor.permissions, input.roleIds);
  return inTransaction(async (session) => {
    const target = await findMembership(weddingId, input.memberId);
    if (!target) throw new AppError("NOT_FOUND", "That member is not part of this wedding.");
    const before = target.roleIds?.length ? target.roleIds : [target.role];
    // Nobody changes the roles of someone who can do more than they can.
    const current = await grantsById(weddingId, before);
    if (
      !grantsWithin(
        before.flatMap((id) => [...(current.get(id) ?? [])]),
        actor.permissions,
      )
    )
      throw new AppError(
        "FORBIDDEN",
        "This person has permissions you don't, so you can't change their roles.",
      );
    const legacy = await checkTeamStillManaged(
      weddingId,
      { memberId: input.memberId, roleIds },
      session,
    );
    const role = legacy.find((l) => l.memberId === input.memberId)!.role;
    await setMemberRoleIds(weddingId, input.memberId, roleIds, role, { session });
    return { before, after: roleIds };
  });
}

// The roles to give someone joining from an invitation. A custom role deleted since the invitation
// was sent is dropped; if nothing is left they join as a Viewer, never with more than was offered.
export async function rolesForJoining(
  weddingId: string,
  offered: string[] | undefined,
): Promise<{ roleIds: string[]; role: "admin" | "manager" }> {
  const wanted = offered?.length ? offered : ["manager"];
  const grants = await grantsById(weddingId, wanted);
  const roleIds = wanted.filter((id) => grants.has(id));
  const final = roleIds.length ? roleIds : ["viewer"];
  const set = mergeGrants(final.map((id) => grants.get(id) ?? BUILT_IN_ROLES.viewer.grants));
  return { roleIds: final, role: legacyRoleFor(set) };
}
