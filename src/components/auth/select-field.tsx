import * as React from "react";
import { Select } from "@/components/ui/select";
import { FieldError } from "./field-error";

// A labelled select with an error line, matching Field.
export function SelectField({
  id,
  label,
  error,
  children,
  ...selectProps
}: { id: string; label: string; error?: string } & React.ComponentProps<"select">) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-xs font-semibold tracking-wide text-ink">
        {label}
      </label>
      <Select
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        {...selectProps}
      >
        {children}
      </Select>
      {error ? <FieldError id={`${id}-error`}>{error}</FieldError> : null}
    </div>
  );
}
