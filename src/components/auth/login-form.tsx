"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { Lock } from "lucide-react";
import { useForm } from "react-hook-form";
import {
  loginSchema,
  type LoginFormValues,
  type LoginInput,
  type PublicUser,
} from "@/modules/members/schema";
import { AuthCard } from "./auth-card";
import { Field } from "./field";
import { FormAlert } from "./form-alert";
import { PasswordField } from "./password-field";
import { postJson } from "./post-json";
import { SubmitButton } from "./submit-button";

type FormProblem = { title: string; message: string };

// `next` is where to go after signing in (already checked by safeNext on the server).
export function LoginForm({ next }: { next?: string }) {
  const router = useRouter();
  const [problem, setProblem] = React.useState<FormProblem | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues, undefined, LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "", remember: false },
  });

  const credentialsRejected = problem?.title === "Authentication failed";

  async function onSubmit(values: LoginInput) {
    setProblem(null);
    const result = await postJson<{ user: PublicUser; next: string }>("/api/auth/login", values);
    if (result.ok) {
      router.replace(next ?? result.data.next);
      router.refresh();
      return;
    }
    const { code, message, details } = result.error;
    if (code === "VALIDATION_FAILED" && details) {
      for (const field of ["email", "password"] as const) {
        const first = details[field]?.[0];
        if (first) setError(field, { message: first });
      }
      return;
    }
    if (code === "UNAUTHENTICATED") {
      setProblem({
        title: "Authentication failed",
        message: `${message} Please check your credentials or reset your password.`,
      });
    } else if (code === "RATE_LIMITED") {
      setProblem({ title: "Too many attempts", message });
    } else {
      setProblem({ title: "Sign-in failed", message });
    }
  }

  return (
    <AuthCard
      title="Welcome back"
      subtitle="Sign in to manage your events, guest lists, and celebration run-sheets."
      footer={
        <>
          <div className="relative my-6 flex items-center justify-center">
            <div className="w-full border-t border-line-soft/40" />
            <span className="absolute bg-white px-2 font-mono text-xs tracking-widest text-ink-2/60 uppercase">
              or
            </span>
          </div>
          <div className="flex flex-col items-center gap-4 text-center">
            <Link
              href="/signup"
              className="text-sm font-semibold text-plum transition-colors hover:text-bronze"
            >
              New here? Create your wedding workspace
            </Link>
            <div className="flex items-center gap-1.5 rounded-full bg-rose-50 px-2 py-1 text-ink-2/80">
              <Lock className="size-3.5" aria-hidden />
              <span className="text-[11px] font-medium">
                256-bit encrypted wedding command center
              </span>
            </div>
          </div>
        </>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <fieldset disabled={isSubmitting} className="flex flex-col gap-4">
          {problem ? <FormAlert title={problem.title}>{problem.message}</FormAlert> : null}
          <Field
            id="email"
            label="Email address"
            type="email"
            autoComplete="email"
            placeholder="e.g. priya@outlook.com"
            error={errors.email?.message}
            invalid={credentialsRejected}
            {...register("email")}
          />
          <PasswordField
            id="password"
            label="Password"
            autoComplete="current-password"
            placeholder="••••••••••••"
            error={errors.password?.message}
            invalid={credentialsRejected}
            labelAside={
              <Link
                href="/forgot-password"
                className="text-[11px] font-medium tracking-wide text-bronze transition-colors hover:text-plum"
              >
                Forgot password?
              </Link>
            }
            {...register("password")}
          />
          <label className="flex cursor-pointer items-center gap-2 pt-1 select-none">
            <input
              type="checkbox"
              className="size-4 cursor-pointer rounded-sm accent-plum disabled:cursor-not-allowed disabled:opacity-60"
              {...register("remember")}
            />
            <span className="text-[13px] text-ink-2">Remember this device for 30 days</span>
          </label>
          <SubmitButton pending={isSubmitting} pendingLabel="Signing in to Workspace...">
            Sign in to Workspace
          </SubmitButton>
        </fieldset>
      </form>
    </AuthCard>
  );
}
