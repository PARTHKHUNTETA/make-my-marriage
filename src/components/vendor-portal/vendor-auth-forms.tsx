"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2, MailCheck } from "lucide-react";
import { useForm } from "react-hook-form";
import { AuthCard } from "@/components/auth/auth-card";
import { Field } from "@/components/auth/field";
import { FormAlert } from "@/components/auth/form-alert";
import { PasswordField } from "@/components/auth/password-field";
import { postJson } from "@/components/auth/post-json";
import { SubmitButton } from "@/components/auth/submit-button";
import {
  vendorLoginSchema,
  vendorResetRequestSchema,
  vendorSignupSchema,
  type VendorLoginFormValues,
  type VendorLoginInput,
  type VendorSignupFormValues,
  type VendorSignupInput,
} from "@/modules/marketplace/schema";

// The vendor portal's sign-in screens. A vendor account is separate from a wedding account: a
// different login, and it never opens anyone's wedding.

const link = "text-sm font-semibold text-plum transition-colors hover:text-bronze";

export function VendorLoginForm() {
  const router = useRouter();
  const [problem, setProblem] = React.useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<VendorLoginFormValues, undefined, VendorLoginInput>({
    resolver: zodResolver(vendorLoginSchema),
    defaultValues: { email: "", password: "", remember: false },
  });

  async function onSubmit(values: VendorLoginInput) {
    setProblem(null);
    const result = await postJson<{ next: string }>("/api/vendor/login", values);
    if (result.ok) {
      router.replace(result.data.next);
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
    setProblem(
      code === "UNAUTHENTICATED"
        ? `${message} Check your details or reset your password.`
        : message,
    );
  }

  return (
    <AuthCard
      title="Vendor sign in"
      subtitle="Manage your listing and the booking requests couples send you."
      footer={
        <p className="mt-6 text-center">
          <Link href="/vendor/signup" className={link}>
            New vendor? Create your account
          </Link>
        </p>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <fieldset disabled={isSubmitting} className="flex flex-col gap-4">
          {problem ? <FormAlert title="Sign-in failed">{problem}</FormAlert> : null}
          <Field
            id="email"
            label="Email address"
            type="email"
            autoComplete="email"
            error={errors.email?.message}
            {...register("email")}
          />
          <PasswordField
            id="password"
            label="Password"
            autoComplete="current-password"
            error={errors.password?.message}
            labelAside={
              <Link
                href="/vendor/forgot-password"
                className="text-[11px] font-medium text-bronze hover:text-plum"
              >
                Forgot password?
              </Link>
            }
            {...register("password")}
          />
          <label className="flex items-center gap-2 text-[13px] text-ink-2">
            <input type="checkbox" className="size-4 accent-plum" {...register("remember")} />
            Remember this device for 30 days
          </label>
          <SubmitButton pending={isSubmitting} pendingLabel="Signing in...">
            Sign in
          </SubmitButton>
        </fieldset>
      </form>
    </AuthCard>
  );
}

export function VendorSignupForm() {
  const router = useRouter();
  const [problem, setProblem] = React.useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<VendorSignupFormValues, undefined, VendorSignupInput>({
    resolver: zodResolver(vendorSignupSchema),
    defaultValues: { businessName: "", email: "", phone: "", password: "" },
  });

  async function onSubmit(values: VendorSignupInput) {
    setProblem(null);
    const result = await postJson<{ next: string }>("/api/vendor/signup", values);
    if (result.ok) {
      router.replace(result.data.next);
      router.refresh();
      return;
    }
    const { code, message, details } = result.error;
    if (code === "VALIDATION_FAILED" && details) {
      for (const field of ["businessName", "email", "phone", "password"] as const) {
        const first = details[field]?.[0];
        if (first) setError(field, { message: first });
      }
      return;
    }
    if (code === "EMAIL_IN_USE") setError("email", { message });
    else setProblem(message);
  }

  return (
    <AuthCard
      title="List your business"
      subtitle="Create a vendor account to reach couples planning their wedding."
      footer={
        <p className="mt-6 text-center">
          <Link href="/vendor/login" className={link}>
            Already have an account? Sign in
          </Link>
        </p>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <fieldset disabled={isSubmitting} className="flex flex-col gap-4">
          {problem ? <FormAlert title="Couldn't create your account">{problem}</FormAlert> : null}
          <Field
            id="businessName"
            label="Business name"
            autoComplete="organization"
            placeholder="e.g. Pixel Photography"
            error={errors.businessName?.message}
            {...register("businessName")}
          />
          <Field
            id="email"
            label="Email address"
            type="email"
            autoComplete="email"
            error={errors.email?.message}
            {...register("email")}
          />
          <Field
            id="phone"
            label="Phone"
            type="tel"
            autoComplete="tel"
            placeholder="e.g. 98765 43210"
            error={errors.phone?.message as string | undefined}
            {...register("phone")}
          />
          <PasswordField
            id="password"
            label="Password"
            autoComplete="new-password"
            hint="At least 10 characters."
            error={errors.password?.message}
            {...register("password")}
          />
          <SubmitButton pending={isSubmitting} pendingLabel="Creating account...">
            Create vendor account
          </SubmitButton>
        </fieldset>
      </form>
    </AuthCard>
  );
}

export function VendorForgotForm() {
  const [done, setDone] = React.useState(false);
  const [problem, setProblem] = React.useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<{ email: string }>({
    resolver: zodResolver(vendorResetRequestSchema),
    defaultValues: { email: "" },
  });

  async function onSubmit(values: { email: string }) {
    setProblem(null);
    const result = await postJson("/api/vendor/reset-request", values);
    if (result.ok) setDone(true);
    else setProblem(result.error.message);
  }

  return (
    <AuthCard title="Reset your password" subtitle="We'll email you a link to choose a new one.">
      {done ? (
        <p role="status" className="text-[13px] leading-5 text-ink-2">
          If a vendor account exists for that address, a reset link is on its way. It works for an
          hour.
        </p>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <fieldset disabled={isSubmitting} className="flex flex-col gap-4">
            {problem ? <FormAlert title="Couldn't send the link">{problem}</FormAlert> : null}
            <Field
              id="email"
              label="Email address"
              type="email"
              autoComplete="email"
              error={errors.email?.message}
              {...register("email")}
            />
            <SubmitButton pending={isSubmitting} pendingLabel="Sending...">
              Send reset link
            </SubmitButton>
          </fieldset>
        </form>
      )}
      <p className="mt-6 text-center">
        <Link href="/vendor/login" className={link}>
          Back to sign in
        </Link>
      </p>
    </AuthCard>
  );
}

export function VendorResetForm({ token }: { token: string }) {
  const [state, setState] = React.useState<"idle" | "working" | "done" | "invalid" | "error">(
    "idle",
  );
  const [message, setMessage] = React.useState("");
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<{ password: string }>({
    resolver: zodResolver(vendorSignupSchema.pick({ password: true })),
    defaultValues: { password: "" },
  });

  async function onSubmit(values: { password: string }) {
    setState("working");
    const result = await postJson("/api/vendor/reset", { token, password: values.password });
    if (result.ok) return setState("done");
    setMessage(result.error.message);
    setState(result.error.code === "LINK_INVALID" ? "invalid" : "error");
  }

  if (state === "done")
    return (
      <AuthCard title="Password changed" subtitle="You can now sign in with your new password.">
        <Link
          href="/vendor/login"
          className="flex h-11 items-center justify-center rounded-lg bg-bronze text-sm font-semibold text-white"
        >
          Go to sign in
        </Link>
      </AuthCard>
    );

  return (
    <AuthCard title="Choose a new password" subtitle="This signs you out everywhere else.">
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
        {state === "invalid" ? (
          <FormAlert title="This link can't be used">
            It has expired or has already been used. Ask for a new one.
          </FormAlert>
        ) : null}
        {state === "error" ? (
          <FormAlert title="Couldn't change your password">{message}</FormAlert>
        ) : null}
        <PasswordField
          id="password"
          label="New password"
          autoComplete="new-password"
          hint="At least 10 characters."
          error={errors.password?.message}
          {...register("password")}
        />
        <SubmitButton pending={state === "working"} pendingLabel="Saving...">
          Change password
        </SubmitButton>
      </form>
    </AuthCard>
  );
}

export function VendorVerifyCard({ token }: { token: string }) {
  const [state, setState] = React.useState<"idle" | "working" | "done" | "invalid" | "error">(
    "idle",
  );
  const [message, setMessage] = React.useState("");

  async function confirm(event: React.FormEvent) {
    event.preventDefault();
    setState("working");
    const result = await postJson("/api/vendor/verify", { token });
    if (result.ok) return setState("done");
    setMessage(result.error.message);
    setState(result.error.code === "LINK_INVALID" ? "invalid" : "error");
  }

  if (state === "done")
    return (
      <AuthCard title="Email confirmed" subtitle="Thanks, your email address is verified.">
        <div className="flex flex-col gap-4">
          <CheckCircle2 className="size-8 text-forest" aria-hidden />
          <Link
            href="/listing"
            className="flex h-11 items-center justify-center rounded-lg bg-bronze text-sm font-semibold text-white"
          >
            Continue to your listing
          </Link>
        </div>
      </AuthCard>
    );

  return (
    <AuthCard title="Confirm your email" subtitle="One tap and we'll know it's really you.">
      <form onSubmit={confirm} className="flex flex-col gap-4">
        {state === "invalid" ? (
          <FormAlert title="This link can't be used">
            It has expired or has already been used. Sign in and choose &ldquo;Resend email&rdquo;.
          </FormAlert>
        ) : null}
        {state === "error" ? (
          <FormAlert title="Couldn't confirm your email">{message}</FormAlert>
        ) : null}
        <MailCheck className="size-8 text-bronze" aria-hidden />
        <SubmitButton pending={state === "working"} pendingLabel="Confirming...">
          Confirm my email
        </SubmitButton>
      </form>
    </AuthCard>
  );
}
