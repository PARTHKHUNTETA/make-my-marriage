"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { FormAlert } from "@/components/auth/form-alert";
import { sendInvitationsAction, sendRemindersAction } from "@/modules/invitations/actions";
import { describeSend } from "./send-result";

// The two one-click sends: invitations to everyone with an email, and a reminder to everyone
// who has not replied (PRD 5.6).
export function SendPanel({
  withEmail,
  waiting,
}: {
  withEmail: number;
  // Guests with an email who still owe a reply to an upcoming event and have not unsubscribed.
  waiting: number;
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState<"invite" | "remind" | null>(null);
  const [notice, setNotice] = React.useState<{ ok: boolean; text: string } | null>(null);

  async function run(kind: "invite" | "remind") {
    setBusy(kind);
    setNotice(null);
    const result =
      kind === "invite"
        ? await sendInvitationsAction({ all: true })
        : await sendRemindersAction({ nonResponders: true });
    setBusy(null);
    if (result.ok) {
      setNotice({
        ok: true,
        text: describeSend(result.data, kind === "invite" ? "invitation" : "reminder"),
      });
      router.refresh();
    } else setNotice({ ok: false, text: result.error.message });
  }

  const card = "rounded-xl bg-white p-5 shadow-[0_1px_3px_rgba(35,31,32,0.04)]";
  const button =
    "mt-3 h-10 rounded-lg bg-bronze px-5 text-sm font-semibold text-white hover:bg-bronze/90 disabled:opacity-50";
  return (
    <div className="flex flex-col gap-3">
      {notice ? (
        notice.ok ? (
          <p
            role="status"
            className="rounded-lg border border-forest/20 bg-forest/10 px-3.5 py-3 text-[13px] font-medium text-forest"
          >
            {notice.text}
          </p>
        ) : (
          <FormAlert title="Couldn't send">{notice.text}</FormAlert>
        )
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <section className={card}>
          <h2 className="font-serif text-lg text-ink">Email invitations</h2>
          <p className="mt-1 text-[13px] text-ink-2">
            Sends each guest their personal link and event details.{" "}
            <strong className="text-ink">{withEmail}</strong>{" "}
            {withEmail === 1 ? "guest has" : "guests have"} an email address. To email only some,
            tick them on the guest list.
          </p>
          <button
            type="button"
            className={button}
            disabled={busy !== null || withEmail === 0}
            onClick={() => run("invite")}
          >
            {busy === "invite" ? "Sending..." : "Email everyone with an email"}
          </button>
        </section>
        <section className={card}>
          <h2 className="font-serif text-lg text-ink">Remind guests who haven&rsquo;t replied</h2>
          <p className="mt-1 text-[13px] text-ink-2">
            <strong className="text-ink">{waiting}</strong>{" "}
            {waiting === 1 ? "guest still needs" : "guests still need"} to reply to an upcoming
            event. Each guest gets at most one email a day.
          </p>
          <button
            type="button"
            className={button}
            disabled={busy !== null || waiting === 0}
            onClick={() => run("remind")}
          >
            {busy === "remind" ? "Sending..." : "Send a reminder to everyone waiting"}
          </button>
        </section>
      </div>
    </div>
  );
}
