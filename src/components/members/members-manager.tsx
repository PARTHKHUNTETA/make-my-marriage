"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { MailPlus } from "lucide-react";
import { useForm } from "react-hook-form";
import { Field } from "@/components/auth/field";
import { FormAlert } from "@/components/auth/form-alert";
import { Button } from "@/components/ui/button";
import {
  cancelInviteAction,
  changeRoleAction,
  inviteMemberAction,
  removeMemberAction,
  resendInviteAction,
} from "@/modules/members/actions";
import {
  inviteMemberSchema,
  type InviteView,
  type MemberRole,
  type MemberView,
} from "@/modules/members/schema";

const card = "rounded-xl bg-white shadow-[0_1px_3px_rgba(35,31,32,0.04)]";
const smallButton =
  "rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-50";

type Notice = { kind: "success" | "error"; text: string } | null;

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  }).format(date);
}

function expiryLabel(invite: InviteView) {
  if (invite.expired) return "Expired";
  return `Expires in ${invite.daysLeft} ${invite.daysLeft === 1 ? "day" : "days"}`;
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export function MembersManager({
  members,
  invites,
  currentUserId,
}: {
  members: MemberView[];
  invites: InviteView[];
  currentUserId: string;
}) {
  const router = useRouter();
  const [notice, setNotice] = React.useState<Notice>(null);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = React.useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<{ email: string }>({
    resolver: zodResolver(inviteMemberSchema),
    defaultValues: { email: "" },
  });

  // Runs one action, shows its outcome, and refreshes the page data on success.
  async function run<T>(
    key: string,
    action: () => Promise<{ ok: true; data: T } | { ok: false; error: { message: string } }>,
    success: (data: T) => string,
  ) {
    setBusy(key);
    setNotice(null);
    const result = await action();
    setBusy(null);
    if (result.ok) {
      setNotice({ kind: "success", text: success(result.data) });
      router.refresh();
      return true;
    }
    setNotice({ kind: "error", text: result.error.message });
    return false;
  }

  async function invite(values: { email: string }) {
    setNotice(null);
    const result = await inviteMemberAction(values);
    if (result.ok) {
      setNotice({
        kind: "success",
        text: result.data.renewed
          ? `A fresh invitation was sent to ${values.email}.`
          : `Invitation sent to ${values.email}.`,
      });
      reset();
      router.refresh();
      return;
    }
    const details = result.error.details as Record<string, string[] | undefined> | undefined;
    const first = details?.email?.[0];
    if (result.error.code === "VALIDATION_FAILED" && first) setError("email", { message: first });
    else if (result.error.code === "EMAIL_IN_USE")
      setError("email", { message: result.error.message });
    else setNotice({ kind: "error", text: result.error.message });
  }

  return (
    <div className="flex flex-col gap-6">
      {notice ? (
        notice.kind === "error" ? (
          <FormAlert title="That didn't work">{notice.text}</FormAlert>
        ) : (
          <p
            role="status"
            className="rounded-lg border border-forest/20 bg-forest/10 px-3.5 py-3 text-[13px] font-medium text-forest"
          >
            {notice.text}
          </p>
        )
      ) : null}

      <section className={`${card} p-5`} aria-labelledby="invite-heading">
        <h2 id="invite-heading" className="font-serif text-xl text-ink">
          Invite someone
        </h2>
        <p className="mt-1 mb-4 text-[13px] text-ink-2">
          They&rsquo;ll get an email with a link that works for 7 days and joins them as a Manager.
        </p>
        <form
          onSubmit={handleSubmit(invite)}
          noValidate
          className="flex flex-col gap-3 sm:flex-row sm:items-start"
        >
          <div className="flex-1">
            <Field
              id="invite-email"
              label="Email address"
              type="email"
              autoComplete="off"
              placeholder="e.g. rahul@example.com"
              error={errors.email?.message}
              {...register("email")}
            />
          </div>
          <Button
            type="submit"
            disabled={isSubmitting}
            className="h-11 gap-2 rounded-lg bg-bronze px-5 text-sm font-semibold text-white hover:bg-bronze/90 sm:mt-[22px]"
          >
            <MailPlus aria-hidden /> {isSubmitting ? "Sending..." : "Send invitation"}
          </Button>
        </form>
      </section>

      <section className={card} aria-labelledby="members-heading">
        <h2 id="members-heading" className="px-5 pt-5 font-serif text-xl text-ink">
          Members <span className="font-sans text-sm text-ink-2">({members.length})</span>
        </h2>
        <ul className="mt-2 divide-y divide-line">
          {members.map((m) => {
            const isYou = m.userId === currentUserId;
            const key = `member:${m.memberId}`;
            return (
              <li key={m.memberId} className="flex flex-wrap items-center gap-3 px-5 py-3.5">
                <span
                  aria-hidden
                  className="flex size-10 shrink-0 items-center justify-center rounded-full bg-plum text-xs font-semibold text-white"
                >
                  {initials(m.name)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-ink">
                    {m.name}
                    {isYou ? (
                      <span className="rounded-full bg-rose-200 px-2 py-0.5 text-[10px] font-medium text-ink-2">
                        You
                      </span>
                    ) : null}
                  </p>
                  <p className="truncate text-[13px] text-ink-2">{m.email}</p>
                </div>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                    m.role === "admin" ? "bg-plum text-white" : "bg-rose-200 text-ink-2"
                  }`}
                >
                  {m.role === "admin" ? "Admin" : "Manager"}
                </span>
                <span className="hidden font-mono text-xs text-ink-2 md:block">
                  Joined {formatDate(m.joinedAt)}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={busy !== null}
                    aria-label={`${m.role === "admin" ? "Make manager" : "Make admin"}: ${m.name}`}
                    onClick={() =>
                      run(
                        key,
                        () =>
                          changeRoleAction({
                            memberId: m.memberId,
                            role: (m.role === "admin" ? "manager" : "admin") satisfies MemberRole,
                          }),
                        () =>
                          m.role === "admin"
                            ? `${m.name} is now a Manager.`
                            : `${m.name} is now an Admin.`,
                      )
                    }
                    className={`${smallButton} bg-rose-100 text-ink hover:bg-rose-200`}
                  >
                    {m.role === "admin" ? "Make manager" : "Make admin"}
                  </button>
                  {confirmRemove === m.memberId ? (
                    <>
                      <button
                        type="button"
                        disabled={busy !== null}
                        onClick={async () => {
                          const done = await run(
                            key,
                            () => removeMemberAction({ memberId: m.memberId }),
                            () => `${m.name} was removed.`,
                          );
                          if (done) setConfirmRemove(null);
                        }}
                        className={`${smallButton} bg-destructive text-white hover:bg-destructive/90`}
                      >
                        Confirm remove
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmRemove(null)}
                        className={`${smallButton} text-ink-2 hover:bg-rose-100`}
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      disabled={busy !== null}
                      aria-label={`Remove ${m.name}`}
                      onClick={() => setConfirmRemove(m.memberId)}
                      className={`${smallButton} text-destructive hover:bg-destructive/10`}
                    >
                      Remove
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <section className={card} aria-labelledby="invites-heading">
        <h2 id="invites-heading" className="px-5 pt-5 font-serif text-xl text-ink">
          Pending invitations{" "}
          <span className="font-sans text-sm text-ink-2">({invites.length})</span>
        </h2>
        {invites.length === 0 ? (
          <p className="px-5 pt-2 pb-5 text-[13px] text-ink-2">No one is waiting to join.</p>
        ) : (
          <ul className="mt-2 divide-y divide-line">
            {invites.map((inv) => {
              const key = `invite:${inv.inviteId}`;
              return (
                <li key={inv.inviteId} className="flex flex-wrap items-center gap-3 px-5 py-3.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-ink">{inv.email}</p>
                    <p className={`text-[13px] ${inv.expired ? "text-destructive" : "text-ink-2"}`}>
                      {expiryLabel(inv)}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={busy !== null}
                    aria-label={`Resend invitation to ${inv.email}`}
                    onClick={() =>
                      run(
                        key,
                        () => resendInviteAction({ inviteId: inv.inviteId }),
                        () => `A fresh invitation was sent to ${inv.email}.`,
                      )
                    }
                    className={`${smallButton} bg-rose-100 text-ink hover:bg-rose-200`}
                  >
                    Resend
                  </button>
                  <button
                    type="button"
                    disabled={busy !== null}
                    aria-label={`Cancel invitation to ${inv.email}`}
                    onClick={() =>
                      run(
                        key,
                        () => cancelInviteAction({ inviteId: inv.inviteId }),
                        () => `The invitation to ${inv.email} was cancelled.`,
                      )
                    }
                    className={`${smallButton} text-destructive hover:bg-destructive/10`}
                  >
                    Cancel
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
