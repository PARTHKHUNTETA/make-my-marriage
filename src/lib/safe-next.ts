// Where to send someone after signing in. The value comes from the URL (?next=), which anyone can
// craft, so only a plain path on this site is allowed: a leading slash, and not "//host" or
// "/\host", which browsers treat as another site. Anything else falls back to the dashboard.
export function safeNext(value: string | string[] | undefined, fallback = "/dashboard"): string {
  const next = Array.isArray(value) ? value[0] : value;
  if (!next || next.length > 300) return fallback;
  if (!next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  if (/[\u0000-\u001f\u007f]/.test(next)) return fallback;
  return next;
}
