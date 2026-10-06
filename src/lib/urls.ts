// Absolute links for emails. The scheme follows the root domain: local development runs on
// plain http, everything else is https.
export function baseUrlFor(rootDomain: string): string {
  const host = rootDomain.split(":")[0] ?? "";
  const local =
    host === "localhost" || host.endsWith(".localhost") || /^\d{1,3}(\.\d{1,3}){3}$/.test(host);
  return `${local ? "http" : "https"}://${rootDomain}`;
}
