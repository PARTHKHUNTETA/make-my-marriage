import * as React from "react";
import { cn } from "@/lib/utils";

// A native <select> styled like Input: works on every phone and with every screen reader.
function Select({ className, ...props }: React.ComponentProps<"select">) {
  return (
    <select
      data-slot="select"
      className={cn(
        "h-11 w-full min-w-0 rounded-lg border border-line-soft/60 bg-white px-3 text-sm text-ink transition-all outline-none",
        "focus:border-plum focus:ring-1 focus:ring-plum",
        "aria-invalid:border-destructive aria-invalid:focus:ring-destructive",
        "disabled:cursor-not-allowed disabled:bg-rose-200/40 disabled:text-ink-2/60",
        className,
      )}
      {...props}
    />
  );
}

export { Select };
