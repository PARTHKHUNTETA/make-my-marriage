"use client";

import * as React from "react";
import Link from "next/link";
import { zodResolver } from "@hookform/resolvers/zod";
import { MailCheck } from "lucide-react";
import { useForm } from "react-hook-form";
import { resetRequestSchema } from "@/modules/members/schema";
import { AuthCard } from "./auth-card";
import { Field } from "./field";
import { FormAlert } from "./form-alert";
import { postJson } from "./post-json";
import { SubmitButton } from "./submit-button";

type Values = { email: string };

export function ForgotPasswordForm() {
  const [sentTo, setSentTo] = React.useState<string | null>(null);
  const [problem, setProblem] = React.useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(resetRequestSchema), defaultValues: { email: "" } });

  async function onSubmit(values: Values) {
    setProblem(null);
    const result = await postJson("/api/auth/reset-request", values);
    if (result.ok) {
      setSentTo(values.email);
      return;
    }
    const first = result.error.details?.email?.[0];
    if (result.error.code === "VALIDATION_FAILED" && first) setError("email", { message: first });
    else setProblem(result.error.message);
  }

  if (sentTo) {
    return (
      <AuthCard title="Check your email" subtitle="We've done what we can from here.">
        <div className="flex flex-col gap-4 text-[13px] leading-5 text-ink-2">
          <MailCheck className="size-8 text-bronze" aria-hidden />
          <p>
            If an account exists for <strong className="text-ink">{sentTo}</strong>, we have sent a
            link to choose a new password. It works for one hour.
          </p>
          <p>Nothing arrived? Check your spam folder, or try again in a few minutes.</p>
          <Link
            href="/login"
            className="font-semibold text-plum transition-colors hover:text-bronze"
          >
            Back to sign in
          </Link>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Forgot your password?"
      subtitle="Enter the email you signed up with and we'll send you a link to choose a new one."
      footer={
        <p className="mt-6 text-center text-[13px] text-ink-2">
          Remembered it?{" "}
          <Link
            href="/login"
            className="font-semibold text-plum transition-colors hover:text-bronze"
          >
            Sign in
          </Link>
        </p>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <fieldset disabled={isSubmitting} className="flex flex-col gap-4">
          {problem ? <FormAlert title="Couldn't send the link">{problem}</FormAlert> : null}
          <Field
            id="email"
            label="Email address"
            type="email"
            autoComplete="email"
            placeholder="e.g. priya@outlook.com"
            error={errors.email?.message}
            {...register("email")}
          />
          <SubmitButton pending={isSubmitting} pendingLabel="Sending the link...">
            Send reset link
          </SubmitButton>
        </fieldset>
      </form>
    </AuthCard>
  );
}
