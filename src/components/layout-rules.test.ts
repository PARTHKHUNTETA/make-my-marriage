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

  it("every single-choice dropdown gets our own arrow and space before it, not the cramped browser one", () => {
    const css = read("app/globals.css");
    const rule = css.match(/select:not\(\[multiple\]\):not\(\[size\]\)\s*\{[^}]*\}/)?.[0] ?? "";
    expect(rule).toMatch(/appearance:\s*none/);
    expect(rule).toMatch(/padding-right:\s*2\.5rem/);
    expect(rule).toMatch(/background-image:\s*url\("data:image\/svg\+xml/);
  });

  it("the phone menu is drawn inside the app shell, not inside the blurred top bar that would squash it", () => {
    const nav = read("components/dashboard/mobile-nav.tsx");
    // A backdrop-blurred element becomes the reference for anything "fixed" inside it, so the drawer
    // must be placed elsewhere. The shell (not the page body) keeps it inside the person's colour theme.
    expect(nav).toContain("createPortal");
    expect(nav).toContain('getElementById("app-shell")');
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

describe("colour themes", () => {
  // Every colour on a planning screen comes from a theme token, so a theme reaches all of it. A raw
  // hex in a component would stay the old colour whatever theme was chosen. White is neutral, the
  // error and success tints are deliberately the same in every theme, and the public home page and
  // the sign-in side panel are marketing pages that sit outside the app.
  const SAME_IN_EVERY_THEME = new Set(["#ffffff", "#ffdad6", "#93000a", "#f2f7f2"]);
  const OUTSIDE_THE_APP = ["components/home/", "components/auth/side-panel.tsx"];

  it("no component or page paints with a raw colour that would ignore the theme", () => {
    const bad: string[] = [];
    for (const file of files(ROOT)) {
      const rel = path.relative(ROOT, file);
      if (OUTSIDE_THE_APP.some((p) => rel.startsWith(p)) || !/^(components|app)\//.test(rel))
        continue;
      for (const m of readFileSync(file, "utf8").matchAll(/#[0-9a-fA-F]{6}\b/g))
        if (!SAME_IN_EVERY_THEME.has(m[0].toLowerCase())) bad.push(`${rel}: ${m[0]}`);
    }
    expect(bad).toEqual([]);
  });

  it("the layout puts the signed-in member's theme on the shell", () => {
    const layout = readFileSync(path.join(ROOT, "app/(member)/layout.tsx"), "utf8");
    expect(layout).toContain("paletteStyle(ctx.palette)");
    expect(layout).toContain('id="app-shell"');
  });
});
