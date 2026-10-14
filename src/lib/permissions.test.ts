import { describe, expect, it } from "vitest";
import {
  ALL_PERMISSIONS,
  BUILT_IN_ROLES,
  can,
  grantsWithin,
  legacyRoleFor,
  mergeGrants,
  parseGrant,
  platformPermissionsOf,
} from "./permissions";

describe("parseGrant", () => {
  it("reads a permission, with the whole wedding as the default scope", () => {
    expect(parseGrant("expense.edit")).toEqual({ permission: "expense.edit", scope: "wedding" });
    expect(parseGrant("task.edit@assigned")).toEqual({
      permission: "task.edit",
      scope: "assigned",
    });
    expect(parseGrant("task.edit@wedding")).toEqual({ permission: "task.edit", scope: "wedding" });
  });

  it("refuses unknown permissions, scopes a permission does not allow, and junk", () => {
    for (const bad of [
      "expense.fly",
      "expense.edit@assigned",
      "task.edit@everyone",
      "task.edit@assigned@x",
      "",
      "@",
    ])
      expect(parseGrant(bad)).toBeNull();
  });
});

describe("mergeGrants", () => {
  it("is the union of every role, with the widest scope winning", () => {
    const set = mergeGrants([
      ["task.edit@assigned", "event.view"],
      ["task.edit", "guest.view"],
    ]);
    expect(set).toEqual({
      "task.edit": "wedding",
      "event.view": "wedding",
      "guest.view": "wedding",
    });
    // order does not matter
    expect(mergeGrants([["task.edit"], ["task.edit@assigned"]])["task.edit"]).toBe("wedding");
  });

  it("ignores grants it cannot read, so bad data grants nothing", () => {
    expect(mergeGrants([["nope", "wedding.delete@assigned"]])).toEqual({});
  });
});

describe("grantsWithin (no escalation)", () => {
  const holder = mergeGrants([["task.edit@assigned", "event.view", "expense.edit"]]);

  it("allows handing out what you hold, or less", () => {
    expect(grantsWithin(["event.view", "task.edit@assigned"], holder)).toBe(true);
    expect(grantsWithin([], holder)).toBe(true);
  });

  it("refuses anything more: another permission, a wider scope, or a bad grant", () => {
    expect(grantsWithin(["member.manage"], holder)).toBe(false);
    expect(grantsWithin(["task.edit"], holder)).toBe(false); // wedding is wider than assigned
    expect(grantsWithin(["garbage"], holder)).toBe(false);
  });
});

describe("built-in roles", () => {
  const set = (id: keyof typeof BUILT_IN_ROLES) => mergeGrants([BUILT_IN_ROLES[id].grants]);

  it("every grant in every template is valid", () => {
    for (const role of Object.values(BUILT_IN_ROLES))
      for (const grant of role.grants) expect(parseGrant(grant), grant).not.toBeNull();
  });

  it("Admin can do everything", () => {
    for (const p of ALL_PERMISSIONS) expect(can(set("admin"), p), p).toBe(true);
  });

  it("Manager is exactly today's manager: everything except the admin-only actions", () => {
    const denied = ALL_PERMISSIONS.filter((p) => !can(set("manager"), p)).sort();
    expect(denied).toEqual(
      [
        "gallery.reset_link",
        "member.invite",
        "member.manage",
        "role.manage",
        "wedding.delete",
      ].sort(),
    );
  });

  it("Viewer can only look", () => {
    const allowed = ALL_PERMISSIONS.filter((p) => can(set("viewer"), p));
    expect(allowed.every((p) => p.endsWith(".view"))).toBe(true);
    expect(can(set("viewer"), "guest.view")).toBe(true);
  });

  it("Finance handles money and vendors, never guests or the team", () => {
    expect(can(set("finance"), "expense.edit")).toBe(true);
    expect(can(set("finance"), "vendor.edit")).toBe(true);
    for (const p of ["guest.view", "guest.edit", "member.view", "photo.view"] as const)
      expect(can(set("finance"), p), p).toBe(false);
  });

  it("the legacy role field reads admin only for those who can manage the team", () => {
    expect(legacyRoleFor(set("admin"))).toBe("admin");
    expect(legacyRoleFor(set("manager"))).toBe("manager");
    expect(legacyRoleFor(set("viewer"))).toBe("manager");
  });
});

describe("platform roles", () => {
  it("combine, and unknown roles grant nothing", () => {
    expect([...platformPermissionsOf(["moderator", "support", "wizard"])].sort()).toEqual(
      ["audit.view", "listing.review", "review.moderate"].sort(),
    );
    expect(platformPermissionsOf(["super_admin"]).has("staff.manage")).toBe(true);
    expect(platformPermissionsOf([]).size).toBe(0);
  });
});
