import { z } from "zod";

// Zod schemas and TypeScript types for the members module. Shared by the browser forms and the
// route handlers: the same rules run on the client for quick feedback and again on the server,
// which is the one that counts.

export const PASSWORD_MIN = 10;
export const PASSWORD_MAX = 128;

const email = z
  .string()
  .trim()
  .toLowerCase()
  .max(254, "That email address is too long")
  .pipe(z.email("Enter a valid email address"));

export const signupSchema = z.object({
  name: z.string().trim().min(1, "Enter your name").max(100, "That name is too long"),
  email,
  password: z
    .string()
    .min(PASSWORD_MIN, `Use at least ${PASSWORD_MIN} characters`)
    .max(PASSWORD_MAX, `Use at most ${PASSWORD_MAX} characters`),
});

// No length policy on login: it only checks the password that was set earlier.
export const loginSchema = z.object({
  email,
  password: z.string().min(1, "Enter your password").max(PASSWORD_MAX, "That password is too long"),
  remember: z.boolean().default(false),
});

export type SignupInput = z.infer<typeof signupSchema>;
export type LoginInput = z.infer<typeof loginSchema>;

// Form inputs before parsing (the resolver feeds the schema raw values).
export type LoginFormValues = z.input<typeof loginSchema>;
export type SignupFormValues = z.input<typeof signupSchema>;

// What the API returns about an account. Never includes the password hash.
export type PublicUser = { id: string; name: string; email: string; emailVerified: boolean };

// A token from an emailed link (verify, reset, invite). Format is checked only to reject junk
// before hitting the database; whether it is real is the database's call.
const token = z
  .string()
  .trim()
  .min(10, "This link is not valid")
  .max(128, "This link is not valid");

export const resetRequestSchema = z.object({ email });
export const resetPasswordSchema = z.object({
  token,
  password: signupSchema.shape.password,
});
export const verifyEmailSchema = z.object({ token });

// ---- team management ----

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, "Not a valid id");

export const inviteMemberSchema = z.object({ email });
export const inviteIdSchema = z.object({ inviteId: objectId });
export const memberIdSchema = z.object({ memberId: objectId });
export const changeRoleSchema = z.object({
  memberId: objectId,
  role: z.enum(["admin", "manager"]),
});
export const acceptInviteSchema = z.object({ token });
// Sign-up from an invitation: the email comes from the invitation, not from the form.
export const inviteSignupSchema = z.object({
  name: signupSchema.shape.name,
  password: signupSchema.shape.password,
  token,
});

export type InviteSignupInput = z.infer<typeof inviteSignupSchema>;
export type MemberRole = "admin" | "manager";

export type MemberView = {
  memberId: string;
  userId: string;
  name: string;
  email: string;
  role: MemberRole;
  joinedAt: Date;
};

export type InviteView = {
  inviteId: string;
  email: string;
  expiresAt: Date;
  expired: boolean;
  // Whole days left, rounded up, worked out when the page is built (so a fresh invitation says 7).
  daysLeft: number;
};
