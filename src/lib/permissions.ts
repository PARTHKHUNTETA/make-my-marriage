// Role-based access control: the permission catalog, the built-in role templates and how a member's
// roles combine into what they may do. Pure (no database), so the browser and the tests use it too.
//
// Permissions live in code, because code enforces them. Roles are data: bundles of grants. A grant
// is a permission, optionally narrowed to a scope: "task.edit" covers every task in the wedding,
// "task.edit@assigned" only the tasks assigned to the member.

export type Scope = "wedding" | "assigned";

type PermissionInfo = {
  label: string;
  group: string;
  // Narrower scopes this permission may be granted with ("wedding" is always allowed).
  scopes?: readonly Exclude<Scope, "wedding">[];
};

export const PERMISSIONS = {
  "wedding.update": {
    label: "Edit wedding details, website, live stream and covers",
    group: "Wedding",
  },
  "wedding.delete": { label: "Delete the wedding", group: "Wedding" },
  "member.view": { label: "See the team", group: "Team" },
  "member.invite": { label: "Invite people, resend and cancel invitations", group: "Team" },
  "member.manage": { label: "Change people's roles and remove them", group: "Team" },
  "role.manage": { label: "Create and edit custom roles", group: "Team" },
  "event.view": { label: "See events", group: "Events" },
  "event.edit": { label: "Add, change and delete events", group: "Events" },
  "task.view": { label: "See tasks", group: "Tasks", scopes: ["assigned"] },
  "task.edit": { label: "Add, change and delete tasks", group: "Tasks", scopes: ["assigned"] },
  "guest.view": { label: "See guests and replies", group: "Guests" },
  "guest.edit": { label: "Add, change, import and delete guests; change replies", group: "Guests" },
  "guest.export": { label: "Download the guest list", group: "Guests" },
  "invitation.send": {
    label: "Send invitations and reminders, and their settings",
    group: "Guests",
  },
  "checkin.use": { label: "Check guests in at the venue", group: "Day of" },
  "seating.view": { label: "See the seating plan", group: "Day of" },
  "seating.edit": { label: "Change the seating plan", group: "Day of" },
  "expense.view": { label: "See expenses and budgets", group: "Money" },
  "expense.edit": { label: "Add, change and delete expenses", group: "Money" },
  "budget.edit": { label: "Set budgets and family splits", group: "Money" },
  "expense.export": { label: "Download expenses", group: "Money" },
  "vendor.view": { label: "See vendors and payments", group: "Vendors" },
  "vendor.edit": { label: "Add and change vendors and their payments", group: "Vendors" },
  "vendor.export": { label: "Download vendors", group: "Vendors" },
  "marketplace.book": { label: "Find vendors, request and accept quotes", group: "Vendors" },
  "marketplace.review": { label: "Review vendors", group: "Vendors" },
  "photo.view": { label: "See photos", group: "Photos" },
  "photo.upload": { label: "Add photos", group: "Photos" },
  "photo.manage": { label: "Delete, move and approve photos", group: "Photos" },
  "gallery.share": { label: "Share the gallery and open guest uploads", group: "Photos" },
  "gallery.reset_link": { label: "Replace the gallery link", group: "Photos" },
  "analytics.view": { label: "See analytics", group: "Other" },
} as const satisfies Record<string, PermissionInfo>;

export type Permission = keyof typeof PERMISSIONS;
export const ALL_PERMISSIONS = Object.keys(PERMISSIONS) as Permission[];

export const isPermission = (value: string): value is Permission => value in PERMISSIONS;

// ---- grants ----------------------------------------------------------------------------------

export function parseGrant(grant: string): { permission: Permission; scope: Scope } | null {
  const [name = "", scope = "wedding", extra] = grant.split("@");
  if (extra !== undefined || !isPermission(name)) return null;
  if (scope === "wedding") return { permission: name, scope };
  const allowed: readonly string[] = (PERMISSIONS[name] as PermissionInfo).scopes ?? [];
  return allowed.includes(scope) ? { permission: name, scope: scope as Scope } : null;
}

export const isValidGrant = (grant: string) => parseGrant(grant) !== null;

// What a member may do: each permission they hold, with the widest scope any of their roles gives.
export type PermissionSet = Partial<Record<Permission, Scope>>;

const WIDTH: Record<Scope, number> = { assigned: 1, wedding: 2 };

// Union of every role's grants. Unknown or malformed grants (old data, a typo) grant nothing.
export function mergeGrants(lists: readonly (readonly string[])[]): PermissionSet {
  const set: PermissionSet = {};
  for (const list of lists)
    for (const grant of list) {
      const parsed = parseGrant(grant);
      if (!parsed) continue;
      const held = set[parsed.permission];
      if (!held || WIDTH[parsed.scope] > WIDTH[held]) set[parsed.permission] = parsed.scope;
    }
  return set;
}

export const can = (set: PermissionSet, permission: Permission): boolean =>
  set[permission] !== undefined;

// Whether every grant in `grants` is something `holder` already has, at least as widely. This is the
// privilege-escalation rule: nobody can hand out (in a role or by assigning one) more than they hold.
export function grantsWithin(grants: readonly string[], holder: PermissionSet): boolean {
  return grants.every((grant) => {
    const parsed = parseGrant(grant);
    if (!parsed) return false;
    const held = holder[parsed.permission];
    return held !== undefined && WIDTH[held] >= WIDTH[parsed.scope];
  });
}

// ---- built-in roles --------------------------------------------------------------------------

type BuiltInRole = { name: string; description: string; grants: readonly string[] };

const VIEW_ALL: Permission[] = [
  "member.view",
  "event.view",
  "task.view",
  "guest.view",
  "seating.view",
  "expense.view",
  "vendor.view",
  "photo.view",
  "analytics.view",
];

// The seven things only an Admin could do before roles existed.
const ADMIN_ONLY: Permission[] = [
  "member.invite",
  "member.manage",
  "role.manage",
  "gallery.reset_link",
  "wedding.delete",
];

export const BUILT_IN_ROLES = {
  admin: {
    name: "Admin",
    description: "Everything, including the team, roles and deleting the wedding.",
    grants: ALL_PERMISSIONS,
  },
  manager: {
    name: "Manager",
    description: "Plans everything with you, but cannot manage the team or delete the wedding.",
    grants: ALL_PERMISSIONS.filter((p) => !ADMIN_ONLY.includes(p)),
  },
  finance: {
    name: "Finance",
    description: "Looks after the money: expenses, budgets, vendors and their payments.",
    grants: [
      "event.view",
      "expense.view",
      "expense.edit",
      "budget.edit",
      "expense.export",
      "vendor.view",
      "vendor.edit",
      "vendor.export",
      "analytics.view",
    ],
  },
  viewer: {
    name: "Viewer",
    description: "Can see the plan but change nothing. Good for parents and relatives.",
    grants: VIEW_ALL,
  },
} as const satisfies Record<string, BuiltInRole>;

export type BuiltInRoleId = keyof typeof BUILT_IN_ROLES;

export const isBuiltInRoleId = (id: string): id is BuiltInRoleId => id in BUILT_IN_ROLES;

// Before roles existed, a member's role was "admin" or "manager". That field is still written
// during the rollout, so older code keeps working: whoever can manage the team counts as admin.
export function legacyRoleFor(set: PermissionSet): "admin" | "manager" {
  return can(set, "member.manage") ? "admin" : "manager";
}

// ---- the platform (Make My Marriage staff) ---------------------------------------------------

export const PLATFORM_PERMISSIONS = [
  "listing.review",
  "review.moderate",
  "staff.manage",
  "audit.view",
] as const;
export type PlatformPermission = (typeof PLATFORM_PERMISSIONS)[number];

export const PLATFORM_ROLES = {
  super_admin: { name: "Super admin", grants: [...PLATFORM_PERMISSIONS] },
  moderator: { name: "Moderator", grants: ["listing.review", "review.moderate"] },
  support: { name: "Support", grants: ["audit.view"] },
} as const satisfies Record<string, { name: string; grants: readonly PlatformPermission[] }>;
export type PlatformRole = keyof typeof PLATFORM_ROLES;

export const isPlatformRole = (value: string): value is PlatformRole => value in PLATFORM_ROLES;

export function platformPermissionsOf(roles: readonly string[]): Set<PlatformPermission> {
  const out = new Set<PlatformPermission>();
  for (const role of roles)
    if (isPlatformRole(role)) for (const p of PLATFORM_ROLES[role].grants) out.add(p);
  return out;
}
