import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard } from "@/components/auth/auth-card";
import { AuthShell } from "@/components/auth/auth-shell";
import { JoinInvite } from "@/components/members/join-invite";
import { decideJoinMode } from "@/modules/members/join-mode";
import { resolveContext } from "@/lib/context";
import { belongsToWedding, getProfile, previewInvite } from "@/modules/members/service";
import { getWedding } from "@/modules/wedding/service";

export const metadata: Metadata = {
  title: "Join a wedding · Make My Marriage",
  robots: { index: false },
};

function Problem({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <AuthShell>
      <AuthCard title={title} subtitle="">
        <div className="flex flex-col gap-5 text-[13px] leading-5 text-ink-2">
          {children}
          <Link
            href="/login"
            className="font-semibold text-plum transition-colors hover:text-bronze"
          >
            Go to sign in
          </Link>
        </div>
      </AuthCard>
    </AuthShell>
  );
}

// The invitation link. The token is a credential: it is handed to the client form and never
// rendered. A bad, cancelled or unknown link all look alike, and nothing about the wedding is
// shown unless the invitation is real.
export default async function JoinPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const preview = await previewInvite(token);
  if (!preview) {
    return (
      <Problem title="This invitation isn't valid">
        <p>
          The link may have been cancelled or mistyped. Ask the person who invited you to send a new
          one.
        </p>
      </Problem>
    );
  }

  const [wedding, inviter, ctx] = await Promise.all([
    getWedding(preview.weddingId),
    getProfile(preview.invitedByUserId),
    resolveContext(),
  ]);
  if (!wedding) {
    return (
      <Problem title="This invitation isn't valid">
        <p>This wedding is no longer available.</p>
      </Problem>
    );
  }
  if (preview.state === "expired") {
    return (
      <Problem title="This invitation has expired">
        <p>
          Invitations are valid for 7 days. Ask {inviter?.name ?? "the person who invited you"} to
          send you a new one.
        </p>
      </Problem>
    );
  }

  // Who is looking at the link decides what they see: the invited person (new, or signed in), or
  // someone else who happens to be signed in, such as the admin who sent it.
  let signedIn: { email: string; onThisWedding: boolean } | null = null;
  if (ctx.kind === "user" || ctx.kind === "member") {
    const [me, onThisWedding] = await Promise.all([
      getProfile(ctx.userId),
      belongsToWedding(ctx.userId, preview.weddingId),
    ]);
    if (me) signedIn = { email: me.email, onThisWedding };
  }
  const mode = decideJoinMode({ inviteEmail: preview.email, signedIn });

  return (
    <AuthShell>
      <JoinInvite
        token={token}
        weddingTitle={wedding.title}
        inviterName={inviter?.name ?? "Someone"}
        email={preview.email}
        mode={mode}
      />
    </AuthShell>
  );
}
