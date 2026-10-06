import { ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function SubmitButton({
  pending,
  pendingLabel,
  children,
}: {
  pending: boolean;
  pendingLabel: string;
  children: React.ReactNode;
}) {
  return (
    <Button
      type="submit"
      disabled={pending}
      className="mt-2 h-11 w-full rounded-lg bg-bronze text-sm font-semibold tracking-wide text-white shadow-sm transition-all hover:bg-bronze/90 disabled:opacity-75"
    >
      {pending ? (
        <>
          <Loader2 className="size-[18px] animate-spin" aria-hidden />
          {pendingLabel}
        </>
      ) : (
        <>
          {children}
          <ArrowRight className="size-4" aria-hidden />
        </>
      )}
    </Button>
  );
}
