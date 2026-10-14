import { describe, expect, it } from "vitest";
import { pagesFor, quickActionsFor } from "@/components/dashboard/nav-data";
import { BUILT_IN_ROLES, mergeGrants } from "./permissions";
import { canOpen, permissionForPath } from "./route-permissions";

const set = (id: keyof typeof BUILT_IN_ROLES) => mergeGrants([BUILT_IN_ROLES[id].grants]);

describe("permissionForPath", () => {
  it("uses the page's own entry, or the nearest listed parent", () => {
    expect(permissionForPath("/money/new")).toBe("expense.edit");
    expect(permissionForPath("/money/6ac5d77de8b0ea3d77f77c25")).toBe("expense.view");
    expect(permissionForPath("/guests/seating/print")).toBe("seating.view");
    expect(permissionForPath("/tasks?view=mine")).toBe("task.view");
    expect(permissionForPath("/dashboard")).toBeUndefined();
    expect(permissionForPath("/settings/appearance")).toBeUndefined();
  });

  it("canOpen lets anyone open an unlisted page", () => {
    expect(canOpen("/settings", () => false)).toBe(true);
    expect(canOpen("/money", () => false)).toBe(false);
  });
});

describe("navigation for each role", () => {
  const hrefs = (role: keyof typeof BUILT_IN_ROLES) => pagesFor(set(role)).map((p) => p.href);

  it("a Viewer sees pages, but no add or send actions", () => {
    expect(hrefs("viewer")).toContain("/guests");
    expect(hrefs("viewer")).not.toContain("/guests/import");
    expect(hrefs("viewer")).not.toContain("/settings/members");
    expect(quickActionsFor(set("viewer"))).toEqual([]);
  });

  it("Finance sees money and vendors, not guests or photos", () => {
    expect(hrefs("finance")).toEqual(
      expect.arrayContaining(["/money", "/money/payments", "/vendors"]),
    );
    expect(hrefs("finance")).not.toContain("/guests");
    expect(hrefs("finance")).not.toContain("/photos");
    expect(quickActionsFor(set("finance")).map((a) => a.label)).toEqual([
      "Add expense",
      "Add vendor",
    ]);
  });

  it("Admin sees everything, Manager all but team management", () => {
    expect(hrefs("admin")).toContain("/settings/members");
    expect(hrefs("manager")).not.toContain("/settings/members");
    expect(quickActionsFor(set("manager"))).toHaveLength(7);
  });
});
