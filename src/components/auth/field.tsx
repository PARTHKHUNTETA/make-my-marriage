import * as React from "react";
import { AlertCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { FieldError } from "./field-error";

// A labelled input with an error line, wired for screen readers (aria-invalid + describedby).
export function Field({
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
} & React.ComponentProps<"input">) {
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
          aria-invalid={error || invalid ? true : undefined}
          aria-describedby={describedBy}
          className={error ? "pr-11" : undefined}
          {...inputProps}
        />
        {error ? (
          <AlertCircle
            aria-hidden
            className="pointer-events-none absolute top-1/2 right-3 size-[18px] -translate-y-1/2 text-destructive"
          />
        ) : null}
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
