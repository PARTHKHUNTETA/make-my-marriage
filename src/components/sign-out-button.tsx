"use client";

import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SigningOutOverlay, useSignOut } from "@/components/auth/use-sign-out";

export function SignOutButton({
  endpoint = "/api/auth/logout",
  redirectTo = "/login",
}: {
  endpoint?: string;
  redirectTo?: string;
}) {
  const { signOut, pending } = useSignOut(endpoint, redirectTo);

  return (
    <>
      <Button variant="ghost" size="sm" onClick={signOut} disabled={pending}>
        <LogOut aria-hidden /> Sign out
      </Button>
      <SigningOutOverlay show={pending} />
    </>
  );
}
