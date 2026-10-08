import * as React from "react";
import { cn } from "@/lib/utils";

function Input({ className, type = "text", ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "h-11 w-full min-w-0 rounded-lg border border-line-soft/60 bg-white px-4 text-sm text-ink transition-all outline-none",
        "placeholder:text-ink-2/80 focus:border-plum focus:ring-1 focus:ring-plum",
        "aria-invalid:border-destructive aria-invalid:focus:ring-destructive",
        "disabled:cursor-not-allowed disabled:bg-rose-200/40 disabled:text-ink-2/60",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
