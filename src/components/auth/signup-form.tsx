"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import {
  PASSWORD_MIN,
  signupSchema,
  type PublicUser,
  type SignupFormValues,
  type SignupInput,
} from "@/modules/members/schema";
import { AuthCard } from "./auth-card";
import { Field } from "./field";
import { FormAlert } from "./form-alert";
import { PasswordField } from "./password-field";
import { postJson } from "./post-json";
import { SubmitButton } from "./submit-button";

export function SignupForm() {
  const router = useRouter();
  const [problem, setProblem] = React.useState<{ title: string; message: string } | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<SignupFormValues, undefined, SignupInput>({
    resolver: zodResolver(signupSchema),
    defaultValues: { name: "", email: "", password: "" },
  });

  async function onSubmit(values: SignupInput) {
    setProblem(null);
    const result = await postJson<{ user: PublicUser; next: string }>("/api/auth/signup", values);
    if (result.ok) {
      router.replace(result.data.next);
      router.refresh();
      return;
    }
    const details = result.error.details;
    if (result.error.code === "VALIDATION_FAILED" && details) {
      for (const field of ["name", "email", "password"] as const) {
        const message = details[field]?.[0];
        if (message) setError(field, { message });
      }
    }
    if (result.error.code === "EMAIL_IN_USE") {
      setError("email", { message: result.error.message });
      return;
    }
    if (result.error.code === "VALIDATION_FAILED") return;
    setProblem({
      title: result.error.code === "RATE_LIMITED" ? "Too many attempts" : "Sign-up failed",
      message: result.error.message,
    });
  }

  return (
    <AuthCard
      title="Create your workspace"
      subtitle="Start planning with your family in one calm place. Guests never need an account."
    >
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <fieldset disabled={isSubmitting} className="flex flex-col gap-4">
          {problem ? <FormAlert title={problem.title}>{problem.message}</FormAlert> : null}
          <Field
            id="name"
            label="Your name"
            autoComplete="name"
            placeholder="e.g. Priya Sharma"
            error={errors.name?.message}
            {...register("name")}
          />
          <Field
            id="email"
            label="Email address"
            type="email"
            autoComplete="email"
            placeholder="e.g. priya@outlook.com"
            error={errors.email?.message}
            {...register("email")}
          />
          <PasswordField
            id="password"
            label="Password"
            autoComplete="new-password"
            hint={`At least ${PASSWORD_MIN} characters.`}
            error={errors.password?.message}
            {...register("password")}
          />
          <SubmitButton pending={isSubmitting} pendingLabel="Creating your workspace...">
            Create workspace
          </SubmitButton>
        </fieldset>
      </form>

      <p className="mt-6 text-center text-[13px] text-ink-2">
        Already have an account?{" "}
        <Link href="/login" className="font-semibold text-plum transition-colors hover:text-bronze">
          Sign in
        </Link>
      </p>
    </AuthCard>
  );
}
