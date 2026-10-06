import { AlertCircle } from "lucide-react";

// Form-level error banner (wrong credentials, rate limit, server trouble).
export function FormAlert({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      role="alert"
      className="flex items-start gap-2.5 rounded-lg border border-destructive/30 bg-[#ffdad6]/60 p-3.5 text-[13px] leading-snug"
    >
      <AlertCircle className="mt-0.5 size-[18px] shrink-0 text-destructive" aria-hidden />
      <div>
        <p className="font-semibold text-destructive">{title}</p>
        <p className="mt-0.5 text-ink-2">{children}</p>
      </div>
    </div>
  );
}
