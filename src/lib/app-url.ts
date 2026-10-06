import "server-only";
import { getEnv } from "@/lib/env";
import { baseUrlFor } from "@/lib/urls";

export function absoluteUrl(path: string): string {
  return new URL(path, baseUrlFor(getEnv().APP_ROOT_DOMAIN)).toString();
}
