import { AlertCircle } from "lucide-react";

export function FieldError({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <p id={id} className="flex items-center gap-1 text-xs text-destructive">
      <AlertCircle className="size-3.5 shrink-0" aria-hidden />
      {children}
    </p>
  );
}
