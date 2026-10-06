"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { postJson } from "@/components/auth/post-json";

export function SignOutButton() {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);

  async function signOut() {
    setPending(true);
    await postJson("/api/auth/logout", {});
    router.replace("/login");
    router.refresh();
  }

  return (
    <Button variant="ghost" size="sm" onClick={signOut} disabled={pending}>
      <LogOut aria-hidden /> Sign out
    </Button>
  );
}
