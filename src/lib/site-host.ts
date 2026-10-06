const RESERVED_SUBDOMAINS: ReadonlySet<string> = new Set(["www", "mail", "app", "api"]);

// "priya-aarav.makemymarriage.com" with root "makemymarriage.com" -> "priya-aarav".
// Returns null for the apex domain, reserved subdomains, nested subdomains and other hosts.
// Ports are ignored, so "demo.localhost:3000" works with root "localhost:3000".
export function siteSlugFromHost(
  host: string | null,
  rootDomain: string | undefined,
): string | null {
  if (!host || !rootDomain) return null;
  const hostname = host.toLowerCase().split(":")[0] ?? "";
  const root = rootDomain.toLowerCase().split(":")[0] ?? "";
  if (!root || !hostname.endsWith(`.${root}`)) return null;
  const sub = hostname.slice(0, hostname.length - root.length - 1);
  if (!sub || sub.includes(".") || RESERVED_SUBDOMAINS.has(sub)) return null;
  return sub;
}
