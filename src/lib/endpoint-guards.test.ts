import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { PERMISSIONS, PLATFORM_PERMISSIONS } from "./permissions";
import { permissionForPath } from "./route-permissions";

// Deny by default, checked in CI: every Server Action, API route and member page must name the
// guard that protects it. A new endpoint without one fails this test. The table of endpoints and
// their guards is kept in docs/endpoint-permissions.md; regenerate it after a change with
//   UPDATE_ENDPOINT_TABLE=1 npx vitest run src/lib/endpoint-guards.test.ts

const ROOT = process.cwd();
const rel = (p: string) => path.relative(ROOT, p);

function walk(dir: string, match: (name: string) => boolean): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    return statSync(full).isDirectory() ? walk(full, match) : match(name) ? [full] : [];
  });
}

// The body of each exported function (up to the next top-level export).
function exportedFunctions(source: string): { name: string; body: string }[] {
  const starts = [...source.matchAll(/^export (?:async )?function (\w+)/gm)];
  return starts.map((m, i) => ({
    name: m[1]!,
    body: source.slice(m.index, starts[i + 1]?.index ?? source.length),
  }));
}

const WEDDING = new Set(Object.keys(PERMISSIONS));
const PLATFORM = new Set<string>(PLATFORM_PERMISSIONS);

// What protects a piece of code, as a short label, or null if nothing does.
function guardOf(body: string): string | null {
  const found: string[] = [];
  for (const m of body.matchAll(/require(?:Page)?Permission\(\s*(?:"([\w.]+)"|(\w+\([^)]*\)))/g))
    found.push(m[1] ?? `${m[2]} (by target)`);
  for (const m of body.matchAll(/requirePlatform\("([\w.]+)"\)/g)) found.push(`staff: ${m[1]}`);
  if (/requireVendor\(\)/.test(body)) found.push("vendor session");
  if (/requireUser\(\)/.test(body)) found.push("signed in");
  if (/requireStaff\(\)/.test(body)) found.push("staff");
  if (/requireMember\(\)/.test(body)) found.push("member (self)");
  return found.length ? [...new Set(found)].join(", ") : null;
}

// Members acting only on their own things (their bell, theme, search that filters by permission).
// requireMember alone is allowed for these and nowhere else.
const SELF_ACTIONS = new Set([
  "getNotificationsAction",
  "markNotificationReadAction",
  "markAllNotificationsReadAction",
  "saveMutedTypesAction",
  "setPaletteAction",
  "searchAction",
]);
const SELF_PAGES = new Set([
  "dashboard",
  "settings",
  "settings/appearance",
  "settings/notifications",
]);

// API routes that are deliberately not member routes, with what protects them instead.
const OTHER_ROUTES: Record<string, string> = {
  "auth/": "public (sign-in, sign-up, password reset), rate-limited",
  "vendor/": "public vendor sign-in and sign-up, rate-limited",
  "cron/": "cron secret",
  "g/": "guest gallery link token",
  "i/": "guest invitation token",
  "unsubscribe/": "unsubscribe token",
  health: "public health check",
  "dev-storage/": "signed address, development only",
};

type Row = { endpoint: string; guard: string | null };

function collect(): Row[] {
  const rows: Row[] = [];
  for (const file of walk(path.join(ROOT, "src/modules"), (n) => n === "actions.ts")) {
    const mod = path.basename(path.dirname(file));
    for (const fn of exportedFunctions(readFileSync(file, "utf8"))) {
      let guard = guardOf(fn.body);
      if (guard === "member (self)" && !SELF_ACTIONS.has(fn.name)) guard = null;
      rows.push({ endpoint: `action ${mod}.${fn.name}`, guard });
    }
  }
  const api = path.join(ROOT, "src/app/api");
  for (const file of walk(api, (n) => n === "route.ts")) {
    const route = path.relative(api, path.dirname(file));
    const other = Object.entries(OTHER_ROUTES).find(([prefix]) => route.startsWith(prefix));
    for (const fn of exportedFunctions(readFileSync(file, "utf8"))) {
      const guard = other ? other[1] : guardOf(fn.body);
      rows.push({ endpoint: `${fn.name} /api/${route}`, guard });
    }
  }
  const member = path.join(ROOT, "src/app/(member)");
  for (const file of walk(member, (n) => n === "page.tsx")) {
    const page = path.relative(member, path.dirname(file));
    let guard = guardOf(readFileSync(file, "utf8"));
    if (guard === "member (self)" && !SELF_PAGES.has(page)) guard = null;
    rows.push({ endpoint: `page /${page}`, guard });
  }
  return rows.sort((a, b) => a.endpoint.localeCompare(b.endpoint));
}

const rows = collect();

describe("every endpoint is protected (deny by default)", () => {
  it("found the code to check", () => {
    expect(rows.filter((r) => r.endpoint.startsWith("action ")).length).toBeGreaterThan(100);
    expect(rows.filter((r) => r.endpoint.startsWith("page ")).length).toBeGreaterThan(40);
  });

  it("no action, API route or member page is left without a guard", () => {
    expect(rows.filter((r) => r.guard === null).map((r) => r.endpoint)).toEqual([]);
  });

  it("every permission named in the code exists", () => {
    const named = rows.flatMap((r) =>
      (r.guard ?? "")
        .split(", ")
        .map((g) => g.replace(/^staff: /, ""))
        .filter((g) => /^[a-z_]+\.[a-z_]+$/.test(g)),
    );
    for (const p of named) expect(WEDDING.has(p) || PLATFORM.has(p), p).toBe(true);
  });

  it("each page asks for the same permission the navigation uses to show its link", () => {
    const mismatched = rows
      .filter((r) => r.endpoint.startsWith("page ") && r.guard !== "member (self)")
      .map((r) => {
        const page = r.endpoint.slice("page ".length).replace(/\[[^\]]+\]/g, "x");
        return { page, guard: r.guard, nav: permissionForPath(page) };
      })
      .filter((x) => x.guard !== x.nav);
    expect(mismatched).toEqual([]);
  });

  it("docs/endpoint-permissions.md matches the code", () => {
    const table = [
      "# Endpoints and their permissions",
      "",
      "Generated by `src/lib/endpoint-guards.test.ts`; do not edit by hand. Every Server Action, API",
      "route and member page, and the guard that protects it. The test fails if any is unguarded.",
      "",
      "| Endpoint | Guard |",
      "| --- | --- |",
      ...rows.map((r) => `| \`${r.endpoint}\` | ${r.guard} |`),
      "",
    ].join("\n");
    const file = path.join(ROOT, "docs/endpoint-permissions.md");
    if (process.env.UPDATE_ENDPOINT_TABLE === "1") writeFileSync(file, table);
    expect(existsSync(file), rel(file)).toBe(true);
    expect(readFileSync(file, "utf8")).toBe(table);
  });
});
