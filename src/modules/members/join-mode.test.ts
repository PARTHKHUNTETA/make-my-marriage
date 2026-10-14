import { describe, expect, it } from "vitest";
import { decideJoinMode } from "./join-mode";

const invite = "rahul@example.com";

describe("decideJoinMode", () => {
  it("asks a visitor who is not signed in to create an account", () => {
    expect(decideJoinMode({ inviteEmail: invite, signedIn: null })).toEqual({ kind: "new" });
  });

  it("lets the invited person accept, even if they are on other weddings", () => {
    expect(
      decideJoinMode({
        inviteEmail: invite,
        signedIn: { email: "Rahul@Example.com", onThisWedding: false },
      }),
    ).toEqual({ kind: "accept" });
  });

  it("tells the inviter (or anyone else) they are on the wrong account, even though they are on this wedding", () => {
    // The bug: the admin who sent the invite opened the link in their own browser and was told
    // "you're already on this wedding".
    expect(
      decideJoinMode({
        inviteEmail: invite,
        signedIn: { email: "admin@example.com", onThisWedding: true },
      }),
    ).toEqual({ kind: "wrong-account", signedInAs: "admin@example.com" });
  });

  it("says 'already on this wedding' only to the invited person themselves", () => {
    expect(
      decideJoinMode({ inviteEmail: invite, signedIn: { email: invite, onThisWedding: true } }),
    ).toEqual({ kind: "has-wedding" });
  });
});
