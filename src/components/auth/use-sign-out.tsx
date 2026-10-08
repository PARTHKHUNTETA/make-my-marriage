"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { postJson } from "./post-json";

// Signs the visitor out and sends them to `redirectTo`. `pending` stays true until the next page
// replaces this one, so the overlay covers the whole wait. A failed request clears it again.
export function useSignOut(endpoint = "/api/auth/logout", redirectTo = "/login") {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);

  async function signOut() {
    if (pending) return;
    setPending(true);
    const result = await postJson(endpoint, {});
    if (!result.ok) {
      setPending(false);
      return;
    }
    router.replace(redirectTo);
    router.refresh();
  }

  return { signOut, pending };
}

// Full-screen "signing out" screen, shown while the sign-out request and redirect finish.
export function SigningOutOverlay({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-4 bg-blush/90 backdrop-blur-sm"
    >
      <Loader2 className="size-9 animate-spin text-plum" aria-hidden />
      <div className="text-center">
        <p className="font-serif text-2xl text-plum">Signing you out…</p>
        <p className="mt-1 text-sm text-ink-2">See you soon. Your plans are saved.</p>
      </div>
    </div>
  );
}
