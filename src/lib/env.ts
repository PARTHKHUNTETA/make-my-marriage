import "server-only";
import { z } from "zod";

const envSchema = z.object({
  MONGODB_URI: z.string().min(1, "MONGODB_URI is required"),
  MONGODB_DB: z.string().min(1, "MONGODB_DB is required"),
  APP_ROOT_DOMAIN: z.string().min(1, "APP_ROOT_DOMAIN is required"),
});

// Kept apart from the base schema so routes that never sign anything (like /api/health)
// do not need a session secret to run.
const authEnvSchema = z.object({
  SESSION_SECRET: z.string().min(32, "SESSION_SECRET must be at least 32 characters"),
});

// Resend is optional in development: without a key, emails are printed to the server log
// instead. Production without a key fails each send (and the queue retries) rather than
// silently dropping mail. The default sender is Resend's sandbox address, which only delivers
// to the account owner until a domain is verified.
// A line like `RESEND_API_KEY=` in .env (as copied from .env.example) arrives as an empty string;
// for optional settings that means "not set", not "invalid".
const blankIsUnset = (value: unknown) => (value === "" ? undefined : value);

const emailEnvSchema = z.object({
  RESEND_API_KEY: z.preprocess(blankIsUnset, z.string().min(1).optional()),
  EMAIL_FROM: z.preprocess(
    blankIsUnset,
    z.string().min(3).default("Make My Marriage <onboarding@resend.dev>"),
  ),
});

// Shared secret that Vercel Cron (and anyone calling the cron routes) must present.
const cronEnvSchema = z.object({
  CRON_SECRET: z.string().min(32, "CRON_SECRET must be at least 32 characters"),
});

// The Make My Marriage team: signed-in members whose verified email is on this list can open the
// internal admin screen (api-design §13). Empty or unset means nobody can.
const staffEnvSchema = z.object({
  STAFF_EMAILS: z.preprocess(blankIsUnset, z.string().optional()),
});

// Photo storage on Cloudflare R2 (system-design §8). All four are needed together. Without them,
// development uses a signed folder on this computer instead; production without them fails loudly,
// since a photo that cannot be stored must never look as if it was.
const storageEnvSchema = z.object({
  R2_ACCOUNT_ID: z.preprocess(blankIsUnset, z.string().min(1).optional()),
  R2_ACCESS_KEY_ID: z.preprocess(blankIsUnset, z.string().min(1).optional()),
  R2_SECRET_ACCESS_KEY: z.preprocess(blankIsUnset, z.string().min(1).optional()),
  R2_BUCKET: z.preprocess(blankIsUnset, z.string().min(1).optional()),
  // How much photo storage each wedding gets, in gigabytes (open question Q3 in the PRD).
  PHOTO_QUOTA_GB: z.preprocess(blankIsUnset, z.coerce.number().positive().max(10_000).default(10)),
});

export type Env = z.infer<typeof envSchema>;
export type AuthEnv = z.infer<typeof authEnvSchema>;
export type EmailEnv = z.infer<typeof emailEnvSchema>;
export type CronEnv = z.infer<typeof cronEnvSchema>;
export type StaffEnv = z.infer<typeof staffEnvSchema>;
export type StorageEnv = z.infer<typeof storageEnvSchema>;

// Where people write to us. Shown on the Privacy, Terms and Support pages.
const legalEnvSchema = z.object({
  SUPPORT_EMAIL: z.preprocess(blankIsUnset, z.string().email().optional()),
});
export type LegalEnv = z.infer<typeof legalEnvSchema>;

// Reports variable names only, never values.
function parseEnv<S extends z.ZodType>(schema: S): z.infer<S> {
  const result = schema.safeParse(process.env);
  if (!result.success) {
    const names = [...new Set(result.error.issues.map((i) => i.path.join(".")))];
    throw new Error(`Invalid environment: ${names.join(", ")}`);
  }
  return result.data;
}

let cached: Env | undefined;
let cachedAuth: AuthEnv | undefined;
let cachedEmail: EmailEnv | undefined;
let cachedCron: CronEnv | undefined;
let cachedStaff: StaffEnv | undefined;
let cachedStorage: StorageEnv | undefined;

// Parsed on first use rather than at import, so `next build` does not need secrets.
export function getEnv(): Env {
  cached ??= parseEnv(envSchema);
  return cached;
}

export function getAuthEnv(): AuthEnv {
  cachedAuth ??= parseEnv(authEnvSchema);
  return cachedAuth;
}

export function getEmailEnv(): EmailEnv {
  cachedEmail ??= parseEnv(emailEnvSchema);
  return cachedEmail;
}

export function getCronEnv(): CronEnv {
  cachedCron ??= parseEnv(cronEnvSchema);
  return cachedCron;
}

// The lowercased staff email addresses.
export function getStaffEmails(): string[] {
  cachedStaff ??= parseEnv(staffEnvSchema);
  return (cachedStaff.STAFF_EMAILS ?? "")
    .split(/[\s,;]+/)
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function getStorageEnv(): StorageEnv {
  cachedStorage ??= parseEnv(storageEnvSchema);
  return cachedStorage;
}

// Bytes of photo storage per wedding.
export function photoQuotaBytes(): number {
  return Math.round(getStorageEnv().PHOTO_QUOTA_GB * 1024 ** 3);
}

export function getSupportEmail(): string | undefined {
  try {
    return parseEnv(legalEnvSchema).SUPPORT_EMAIL;
  } catch {
    return undefined; // a bad address must not take the legal pages down
  }
}

// Google Places key for "Discover vendors". Optional: without it the Discover page says it is not
// set up yet, and nothing else changes.
export function getPlacesApiKey(): string | undefined {
  const key = process.env.GOOGLE_PLACES_API_KEY?.trim();
  return key || undefined;
}
