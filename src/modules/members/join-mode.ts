// What the invitation page shows, decided from who (if anyone) is signed in. Kept apart from the
// page so the order of the checks is tested: identity first, then membership. Checking membership
// first once told a signed-in inviter "you're already on this wedding" when they opened the link
// meant for someone else.
export type JoinMode =
  | { kind: "new" } // not signed in: create an account
  | { kind: "accept" } // signed in as the invited address
  | { kind: "wrong-account"; signedInAs: string } // signed in as someone else
  | { kind: "has-wedding" }; // signed in as the invited address, already on this wedding

export function decideJoinMode(input: {
  inviteEmail: string;
  // The signed-in account, or null when nobody is signed in.
  signedIn: { email: string; onThisWedding: boolean } | null;
}): JoinMode {
  const { inviteEmail, signedIn } = input;
  if (!signedIn) return { kind: "new" };
  if (signedIn.email.toLowerCase() !== inviteEmail.toLowerCase())
    return { kind: "wrong-account", signedInAs: signedIn.email };
  return signedIn.onThisWedding ? { kind: "has-wedding" } : { kind: "accept" };
}
