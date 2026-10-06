// The wedding site lives at `(public)/[slug]`, and route groups add no URL segment, so a
// slug equal to a top-level route would shadow it. Enforced when a slug is set (Phase 5).
// Keep in sync with the top-level folders under src/app.
export const RESERVED_SLUGS: ReadonlySet<string> = new Set([
  // member app
  "dashboard",
  "events",
  "tasks",
  "guests",
  "money",
  "vendors",
  "website",
  "photos",
  "live",
  "analytics",
  "settings",
  // vendor portal
  "listing",
  "bookings",
  "reviews",
  // guest links and system
  "i",
  "g",
  "api",
  // account pages (Phase 1)
  "login",
  "signup",
  "logout",
  "verify",
  "reset",
  "vendor",
  "admin",
  // hygiene
  "www",
  "mail",
  "app",
  "static",
  "assets",
  "images",
  "favicon.ico",
  "robots.txt",
  "sitemap.xml",
]);

export function isReservedSlug(slug: string): boolean {
  return RESERVED_SLUGS.has(slug.toLowerCase());
}
