"use client";

import * as React from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { FieldError } from "./field-error";

export function PasswordField({
  id,
  label,
  error,
  hint,
  labelAside,
  invalid,
  ...inputProps
}: {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  labelAside?: React.ReactNode;
  // Red border without a message (e.g. wrong credentials, where the banner explains it).
  invalid?: boolean;
} & Omit<React.ComponentProps<"input">, "type">) {
  const [visible, setVisible] = React.useState(false);
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <label htmlFor={id} className="text-xs font-semibold tracking-wide text-ink">
          {label}
        </label>
        {labelAside}
      </div>
      <div className="relative">
        <Input
          id={id}
          type={visible ? "text" : "password"}
          aria-invalid={error || invalid ? true : undefined}
          aria-describedby={describedBy}
          className="pr-11"
          {...inputProps}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Hide password" : "Show password"}
          aria-pressed={visible}
          className="absolute top-0 right-0 flex h-11 items-center px-4 text-ink-2 transition-colors hover:text-ink"
        >
          {visible ? (
            <EyeOff className="size-[18px]" aria-hidden />
          ) : (
            <Eye className="size-[18px]" aria-hidden />
          )}
        </button>
      </div>
      {error ? (
        <FieldError id={`${id}-error`}>{error}</FieldError>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-xs text-ink-2">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
