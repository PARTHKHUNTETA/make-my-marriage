import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// Guards for phone layouts. The browser cannot be run here, so these read the source for the two
// mistakes that broke phones before: a row of tabs that cannot wrap, and a top bar with no menu.
const ROOT = path.join(process.cwd(), "src");

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    return statSync(full).isDirectory() ? files(full) : full.endsWith(".tsx") ? [full] : [];
  });
}

describe("rows of links", () => {
  it("every <nav> that lays its links out in a row can wrap or scroll", () => {
    const bad: string[] = [];
    for (const file of files(ROOT)) {
      const source = readFileSync(file, "utf8");
      for (const m of source.matchAll(/<nav\b[^>]*className=(?:"([^"]*)"|\{`([^`]*)`\})/g)) {
        const cls = m[1] ?? m[2] ?? "";
        const isRow = /(^|\s)flex(\s|$)/.test(cls) && !/flex-col/.test(cls);
        const copes = /flex-wrap|overflow-x-auto|overflow-x-scroll|(^|\s)hidden(\s|$)|lg:flex/.test(
          cls,
        );
        // The pages' own paging links are a short, fixed row of two or three.
        const small = /justify-center|justify-between/.test(cls);
        if (isRow && !copes && !small) bad.push(`${path.relative(ROOT, file)}: ${cls.trim()}`);
      }
    }
    expect(bad).toEqual([]);
  });
});

describe("the member shell on phones", () => {
  const read = (p: string) => readFileSync(path.join(ROOT, p), "utf8");

  it("the top bar carries the menu button, since the sidebar is hidden below the lg breakpoint", () => {
    expect(read("components/dashboard/topbar.tsx")).toContain("<MobileNav");
    expect(read("components/dashboard/sidebar.tsx")).toMatch(/hidden[^"]*lg:flex/);
  });

  it("the menu button is only for small screens, and gets the same links as the sidebar", () => {
    const nav = read("components/dashboard/mobile-nav.tsx");
    expect(nav).toContain("lg:hidden");
    expect(nav).toContain("<SidebarContent");
  });

  it("form controls never grow past their container, and stay 16px on phones so iPhones do not zoom", () => {
    const css = read("app/globals.css");
    expect(css).toMatch(/select,\s*input,\s*textarea\s*\{\s*max-width:\s*100%/);
    expect(css).toMatch(/@media \(max-width: 639px\)[\s\S]*font-size: 16px/);
  });
});

describe("what guests download", () => {
  // The page a relative opens from WhatsApp should not carry the whole form library. A client file
  // that imports a *value* from a module's zod schema file pulls zod (about 380 KB) into the page,
  // so these files stay on small, zod-free helpers.
  const guestFacing = [
    "components/invite/rsvp-form.tsx",
    "components/photos/guest-uploader.tsx",
    "components/photos/guest-grid.tsx",
  ];
  it.each(guestFacing)("%s imports no zod schema files at runtime", (file) => {
    const source = readFileSync(path.join(ROOT, file), "utf8");
    const runtime = [
      ...source.matchAll(/import\s+(type\s+)?\{[^}]*\}\s+from\s+"(@\/modules\/[^"]*\/schema)"/g),
    ].filter((m) => !m[1]);
    expect(runtime.map((m) => m[2])).toEqual([]);
    expect(source).not.toMatch(/from "zod"|react-hook-form/);
  });
});
