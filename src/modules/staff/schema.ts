import { z } from "zod";
import { PLATFORM_ROLES } from "@/lib/permissions";

const roles = Object.keys(PLATFORM_ROLES) as [
  keyof typeof PLATFORM_ROLES,
  ...(keyof typeof PLATFORM_ROLES)[],
];

export const staffRolesSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email("Enter a valid email address")),
  roles: z
    .array(z.enum(roles))
    .max(3)
    .transform((r) => [...new Set(r)]),
});
