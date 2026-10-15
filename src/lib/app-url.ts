import "server-only";
import { getEnv } from "@/lib/env";
import { baseUrlFor } from "@/lib/urls";

let warned = false;

// Every link the app hands out (gallery, invitations, the wedding website, emails) is built from
// APP_ROOT_DOMAIN. A production server still set to localhost would give guests dead links, so say
// so loudly in the server log the first time it happens.
export function absoluteUrl(path: string): string {
  const root = getEnv().APP_ROOT_DOMAIN;
  if (!warned && process.env.NODE_ENV === "production" && /^(localhost|127\.)/.test(root)) {
    warned = true;
    console.error(
      `APP_ROOT_DOMAIN is "${root}" in production, so shared links point at localhost. ` +
        "Set it to your real domain (for example make-my-marriage.shop) and redeploy.",
    );
  }
  return new URL(path, baseUrlFor(root)).toString();
}
