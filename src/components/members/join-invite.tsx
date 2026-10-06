"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { AuthCard } from "@/components/auth/auth-card";
import { Field } from "@/components/auth/field";
import { FormAlert } from "@/components/auth/form-alert";
import { PasswordField } from "@/components/auth/password-field";
import { postJson } from "@/components/auth/post-json";
import { SubmitButton } from "@/components/auth/submit-button";
import { Button } from "@/components/ui/button";
import { acceptInviteAction } from "@/modules/members/actions";
import { PASSWORD_MIN, signupSchema, type PublicUser } from "@/modules/members/schema";

export type JoinMode =
  | { kind: "new" } // not signed in: create an account
  | { kind: "accept" } // signed in as the invited address
  | { kind: "wrong-account"; signedInAs: string } // signed in as someone else
  | { kind: "has-wedding" }; // already belongs to a wedding

type Props = {
  token: string;
  weddingTitle: string;
  inviterName: string;
  email: string;
  mode: JoinMode;
};

const joinFormSchema = signupSchema.pick({ name: true, password: true });
type JoinFormValues = { name: string; password: string };

function intro(inviterName: string, weddingTitle: string) {
  return `${inviterName} invited you to join the planning team for ${weddingTitle} as a Manager.`;
}

export function JoinInvite({ token, weddingTitle, inviterName, email, mode }: Props) {
  const router = useRouter();
  const [problem, setProblem] = React.useState<{ title: string; message: string } | null>(null);
  const [working, setWorking] = React.useState(false);
  const loginHref = `/login?next=${encodeURIComponent(`/join/${token}`)}`;

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<JoinFormValues>({
    resolver: zodResolver(joinFormSchema),
    defaultValues: { name: "", password: "" },
  });

  async function createAccount(values: JoinFormValues) {
    setProblem(null);
    const result = await postJson<{ user: PublicUser; next: string }>("/api/auth/signup", {
      ...values,
      token,
    });
    if (result.ok) {
      router.replace(result.data.next);
      router.refresh();
      return;
    }
    const { code, message, details } = result.error;
    if (code === "VALIDATION_FAILED" && details) {
      for (const field of ["name", "password"] as const) {
        const first = details[field]?.[0];
        if (first) setError(field, { message: first });
      }
      return;
    }
    setProblem({
      title: code === "EMAIL_IN_USE" ? "You already have an account" : "Couldn't join",
      message,
    });
  }

  async function accept() {
    setWorking(true);
    setProblem(null);
    const result = await acceptInviteAction({ token });
    if (result.ok) {
      router.replace("/dashboard");
      router.refresh();
      return;
    }
    setWorking(false);
    setProblem({ title: "Couldn't join", message: result.error.message });
  }

  async function switchAccount() {
    setWorking(true);
    await postJson("/api/auth/logout", {});
    router.replace(loginHref);
    router.refresh();
  }

  if (mode.kind === "has-wedding") {
    return (
      <AuthCard title="You're already on a wedding" subtitle={intro(inviterName, weddingTitle)}>
        <p className="text-[13px] leading-5 text-ink-2">
          An account can belong to one wedding at a time, and yours already does. If you meant to
          join this one instead, ask the person who runs your current wedding to remove you first.
        </p>
        <Link
          href="/dashboard"
          className="mt-5 flex h-11 items-center justify-center rounded-lg bg-bronze text-sm font-semibold text-white shadow-sm transition-all hover:bg-bronze/90"
        >
          Go to my wedding
        </Link>
      </AuthCard>
    );
  }

  if (mode.kind === "wrong-account") {
    return (
      <AuthCard title="Different account" subtitle={intro(inviterName, weddingTitle)}>
        <p className="text-[13px] leading-5 text-ink-2">
          This invitation was sent to <strong className="text-ink">{email}</strong>, but
          you&rsquo;re signed in as <strong className="text-ink">{mode.signedInAs}</strong>.
        </p>
        <Button
          onClick={switchAccount}
          disabled={working}
          className="mt-5 h-11 w-full rounded-lg bg-bronze text-sm font-semibold text-white hover:bg-bronze/90"
        >
          Sign out and continue
        </Button>
      </AuthCard>
    );
  }

  if (mode.kind === "accept") {
    return (
      <AuthCard title={`Join ${weddingTitle}`} subtitle={intro(inviterName, weddingTitle)}>
        {problem ? (
          <div className="mb-4">
            <FormAlert title={problem.title}>{problem.message}</FormAlert>
          </div>
        ) : null}
        <p className="mb-5 text-[13px] leading-5 text-ink-2">
          You&rsquo;re signed in as <strong className="text-ink">{email}</strong>. You&rsquo;ll be
          able to manage events, guests, the budget and vendors together.
        </p>
        <Button
          onClick={accept}
          disabled={working}
          className="h-11 w-full rounded-lg bg-bronze text-sm font-semibold text-white hover:bg-bronze/90"
        >
          {working ? "Joining..." : "Join the wedding"}
        </Button>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title={`Join ${weddingTitle}`}
      subtitle={intro(inviterName, weddingTitle)}
      footer={
        <p className="mt-6 text-center text-[13px] text-ink-2">
          Already have an account?{" "}
          <Link
            href={loginHref}
            className="font-semibold text-plum transition-colors hover:text-bronze"
          >
            Sign in
          </Link>
        </p>
      }
    >
      <form onSubmit={handleSubmit(createAccount)} noValidate>
        <fieldset disabled={isSubmitting} className="flex flex-col gap-4">
          {problem ? (
            <FormAlert title={problem.title}>
              {problem.message}{" "}
              {problem.title === "You already have an account" ? (
                <Link href={loginHref} className="font-semibold text-plum underline">
                  Sign in
                </Link>
              ) : null}
            </FormAlert>
          ) : null}
          <div className="flex flex-col gap-1">
            <span className="text-xs font-semibold tracking-wide text-ink">Email address</span>
            <div className="flex h-11 items-center rounded-lg border border-line-soft/60 bg-rose-100/60 px-4 text-sm text-ink-2">
              {email}
            </div>
          </div>
          <Field
            id="name"
            label="Your name"
            autoComplete="name"
            placeholder="e.g. Rahul Sharma"
            error={errors.name?.message}
            {...register("name")}
          />
          <PasswordField
            id="password"
            label="Choose a password"
            autoComplete="new-password"
            hint={`At least ${PASSWORD_MIN} characters.`}
            error={errors.password?.message}
            {...register("password")}
          />
          <SubmitButton pending={isSubmitting} pendingLabel="Joining...">
            Create account and join
          </SubmitButton>
        </fieldset>
      </form>
    </AuthCard>
  );
}
