import * as React from "react";
import { cn } from "@/lib/utils";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "min-h-20 w-full min-w-0 rounded-lg border border-line-soft/60 bg-white px-4 py-3 text-sm text-ink transition-all outline-none",
        "placeholder:text-ink-2/50 focus:border-plum focus:ring-1 focus:ring-plum",
        "aria-invalid:border-destructive aria-invalid:focus:ring-destructive",
        "disabled:cursor-not-allowed disabled:bg-rose-200/40 disabled:text-ink-2/60",
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
