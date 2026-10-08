"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { postJson } from "./post-json";

export const SIGN_OUT_FAILED = "We couldn't sign you out. Check your connection and try again.";

// The sign-out itself, apart from React so it can be tested: the request, then either the way out
// or a message. A failure must be said out loud, since staying signed in on a shared computer is
// the one thing a person pressing Sign out cannot be left unaware of.
export async function runSignOut(
  endpoint: string,
  redirectTo: string,
  io: {
    post: (url: string, body: unknown) => Promise<{ ok: boolean }>;
    leave: (to: string) => void;
    setPending: (pending: boolean) => void;
    setError: (message: string | null) => void;
  },
): Promise<void> {
  io.setPending(true);
  io.setError(null);
  const result = await io.post(endpoint, {});
  if (!result.ok) {
    io.setPending(false);
    io.setError(SIGN_OUT_FAILED);
    return;
  }
  io.leave(redirectTo);
}

// Signs the visitor out and sends them to `redirectTo`. `pending` stays true until the next page
// replaces this one, so the overlay covers the whole wait. A failed request clears it again and
// sets `error`.
export function useSignOut(endpoint = "/api/auth/logout", redirectTo = "/login") {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function signOut() {
    if (pending) return;
    await runSignOut(endpoint, redirectTo, {
      post: postJson,
      leave: (to) => {
        router.replace(to);
        router.refresh();
      },
      setPending,
      setError,
    });
  }

  return { signOut, pending, error };
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
