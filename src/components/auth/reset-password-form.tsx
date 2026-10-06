"use client";

import * as React from "react";
import Link from "next/link";
import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { PASSWORD_MIN, signupSchema } from "@/modules/members/schema";
import { AuthCard } from "./auth-card";
import { FormAlert } from "./form-alert";
import { PasswordField } from "./password-field";
import { postJson } from "./post-json";
import { SubmitButton } from "./submit-button";

const formSchema = z
  .object({ password: signupSchema.shape.password, confirm: z.string() })
  .refine((v) => v.password === v.confirm, {
    path: ["confirm"],
    message: "The passwords don't match",
  });
type Values = z.input<typeof formSchema>;

export function ResetPasswordForm({ token }: { token: string }) {
  const [done, setDone] = React.useState(false);
  const [expired, setExpired] = React.useState(false);
  const [problem, setProblem] = React.useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(formSchema),
    defaultValues: { password: "", confirm: "" },
  });

  async function onSubmit(values: Values) {
    setProblem(null);
    setExpired(false);
    const result = await postJson("/api/auth/reset", { token, password: values.password });
    if (result.ok) {
      setDone(true);
      return;
    }
    if (result.error.code === "LINK_INVALID") {
      setExpired(true);
      return;
    }
    const first = result.error.details?.password?.[0];
    if (result.error.code === "VALIDATION_FAILED" && first)
      setError("password", { message: first });
    else setProblem(result.error.message);
  }

  if (done) {
    return (
      <AuthCard title="Password updated" subtitle="You can now sign in with your new password.">
        <div className="flex flex-col gap-4 text-[13px] leading-5 text-ink-2">
          <CheckCircle2 className="size-8 text-forest" aria-hidden />
          <p>For your security, you&rsquo;ve been signed out everywhere else.</p>
          <Link
            href="/login"
            className="flex h-11 items-center justify-center rounded-lg bg-bronze text-sm font-semibold text-white shadow-sm transition-all hover:bg-bronze/90"
          >
            Sign in
          </Link>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Choose a new password" subtitle="Pick something you don't use anywhere else.">
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <fieldset disabled={isSubmitting} className="flex flex-col gap-4">
          {expired ? (
            <FormAlert title="This link can't be used">
              It has expired or has already been used.{" "}
              <Link href="/forgot-password" className="font-semibold text-plum underline">
                Request a new one
              </Link>
              .
            </FormAlert>
          ) : null}
          {problem ? <FormAlert title="Couldn't update your password">{problem}</FormAlert> : null}
          <PasswordField
            id="password"
            label="New password"
            autoComplete="new-password"
            hint={`At least ${PASSWORD_MIN} characters.`}
            error={errors.password?.message}
            {...register("password")}
          />
          <PasswordField
            id="confirm"
            label="Confirm new password"
            autoComplete="new-password"
            error={errors.confirm?.message}
            {...register("confirm")}
          />
          <SubmitButton pending={isSubmitting} pendingLabel="Updating your password...">
            Update password
          </SubmitButton>
        </fieldset>
      </form>
    </AuthCard>
  );
}
