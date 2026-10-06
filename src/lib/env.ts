import "server-only";
import { z } from "zod";

const envSchema = z.object({
  MONGODB_URI: z.string().min(1, "MONGODB_URI is required"),
  MONGODB_DB: z.string().min(1, "MONGODB_DB is required"),
  APP_ROOT_DOMAIN: z.string().min(1, "APP_ROOT_DOMAIN is required"),
});

export type Env = z.infer<typeof envSchema>;

let cached: Env | undefined;

// Parsed on first use rather than at import, so `next build` does not need secrets.
// Reports variable names only, never values.
export function getEnv(): Env {
  if (cached) return cached;
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    const names = [...new Set(result.error.issues.map((i) => i.path.join(".")))];
    throw new Error(`Invalid environment: ${names.join(", ")}`);
  }
  cached = result.data;
  return cached;
}
