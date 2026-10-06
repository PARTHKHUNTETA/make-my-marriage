"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { postJson } from "@/components/auth/post-json";

export function SignOutButton({
  endpoint = "/api/auth/logout",
  redirectTo = "/login",
}: {
  endpoint?: string;
  redirectTo?: string;
}) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);

  async function signOut() {
    setPending(true);
    await postJson(endpoint, {});
    router.replace(redirectTo);
    router.refresh();
  }

  return (
    <Button variant="ghost" size="sm" onClick={signOut} disabled={pending}>
      <LogOut aria-hidden /> Sign out
    </Button>
  );
}
