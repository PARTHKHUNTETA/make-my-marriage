"use client";

import Link from "next/link";
import { useState } from "react";
import { AlertCircle, ArrowRight, Eye, EyeOff, Loader2 } from "lucide-react";

type Status = "idle" | "loading" | "invalid-credentials";
type Errors = { email?: string; password?: string };

const inputClass =
  "h-11 w-full rounded-lg border bg-white px-4 text-sm text-ink outline-none transition-all placeholder:text-ink-2/50 focus:ring-1 disabled:cursor-not-allowed disabled:bg-rose-200/40 disabled:text-ink-2/60";

function inputState(hasError: boolean) {
  return hasError
    ? "border-destructive focus:ring-destructive"
    : "border-line-soft/60 focus:border-plum focus:ring-plum";
}

function validate(email: string, password: string): Errors {
  const errors: Errors = {};
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    errors.email = "Please enter a valid email address";
  if (password.length < 8) errors.password = "Password must be at least 8 characters";
  return errors;
}

export function LoginForm() {
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [status, setStatus] = useState<Status>("idle");
  const loading = status === "loading";
  const credsInvalid = status === "invalid-credentials";

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const email = String(data.get("email") ?? "").trim();
    const password = String(data.get("password") ?? "");

    const found = validate(email, password);
    setErrors(found);
    if (found.email || found.password) return;

    setStatus("loading");
    // TODO: no auth backend exists yet. Replace with the real sign-in call; until then every
    // attempt is rejected so the error state is reachable.
    await new Promise((r) => setTimeout(r, 800));
    setStatus("invalid-credentials");
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      {credsInvalid && (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-lg border border-destructive/30 bg-[#ffdad6]/60 p-3.5 text-[13px] leading-snug"
        >
          <AlertCircle className="mt-0.5 size-[18px] shrink-0 text-destructive" />
          <div>
            <p className="font-semibold text-destructive">Authentication failed</p>
            <p className="mt-0.5 text-ink-2">
              Invalid email or password. Please check your credentials or reset your password.
            </p>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-1">
        <label htmlFor="email" className="text-xs font-semibold tracking-wide text-ink">
          Email address
        </label>
        <div className="relative">
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="e.g. priya@outlook.com"
            disabled={loading}
            aria-invalid={!!errors.email}
            aria-describedby={errors.email ? "email-error" : undefined}
            className={`${inputClass} ${inputState(!!errors.email || credsInvalid)}`}
          />
          {errors.email && (
            <AlertCircle className="pointer-events-none absolute top-1/2 right-3 size-[18px] -translate-y-1/2 text-destructive" />
          )}
        </div>
        {errors.email && (
          <p id="email-error" className="flex items-center gap-1 text-xs text-destructive">
            <AlertCircle className="size-3.5" />
            {errors.email}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <label htmlFor="password" className="text-xs font-semibold tracking-wide text-ink">
            Password
          </label>
          <Link
            href="/forgot-password"
            className="text-[11px] font-medium tracking-wide text-bronze transition-colors hover:text-plum"
          >
            Forgot password?
          </Link>
        </div>
        <div className="relative">
          <input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            placeholder="••••••••••••"
            disabled={loading}
            aria-invalid={!!errors.password}
            aria-describedby={errors.password ? "password-error" : undefined}
            className={`${inputClass} pr-11 ${inputState(!!errors.password || credsInvalid)}`}
          />
          <button
            type="button"
            aria-label={showPassword ? "Hide password" : "Show password"}
            onClick={() => setShowPassword((v) => !v)}
            disabled={loading}
            className="absolute top-0 right-0 flex h-11 items-center px-4 text-ink-2 transition-colors hover:text-ink disabled:pointer-events-none disabled:opacity-40"
          >
            {showPassword ? <EyeOff className="size-[18px]" /> : <Eye className="size-[18px]" />}
          </button>
        </div>
        {errors.password && (
          <p id="password-error" className="flex items-center gap-1 text-xs text-destructive">
            <AlertCircle className="size-3.5" />
            {errors.password}
          </p>
        )}
      </div>

      <label className="flex cursor-pointer items-center gap-2 pt-1 select-none">
        <input
          type="checkbox"
          name="remember"
          disabled={loading}
          className="size-4 cursor-pointer rounded-sm accent-plum disabled:cursor-not-allowed disabled:opacity-60"
        />
        <span className="text-[13px] text-ink-2">Remember this device for 30 days</span>
      </label>

      <button
        type="submit"
        disabled={loading}
        className="mt-2 flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-bronze text-sm font-semibold tracking-wide text-white shadow-sm transition-all hover:bg-bronze/90 disabled:cursor-not-allowed disabled:opacity-75"
      >
        {loading ? (
          <>
            <Loader2 className="size-[18px] animate-spin" />
            Signing in to Workspace...
          </>
        ) : (
          <>
            Sign in to Workspace
            <ArrowRight className="size-4" />
          </>
        )}
      </button>
    </form>
  );
}
