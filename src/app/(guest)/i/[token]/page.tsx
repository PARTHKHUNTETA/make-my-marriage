import type { Metadata } from "next";
import { EventReply } from "@/components/invite/rsvp-form";
import { getInvitation } from "@/modules/invitations/service";

// A guest's personal invitation. The link is the only credential, so the page never prints it
// and is not indexed (see the guest layout).
export const metadata: Metadata = { title: "You're invited", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function InvitationPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const view = await getInvitation(token);

  if (!view) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-5 py-16 text-center">
        <h1 className="font-serif text-3xl text-plum">This link isn&rsquo;t working</h1>
        <p className="mt-3 text-[15px] text-ink-2">
          It may have been copied incompletely, or the invitation was changed. Please ask the couple
          to send you the link again.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-screen max-w-xl px-4 py-10 sm:py-16">
      <header className="text-center">
        <p className="text-xs font-semibold tracking-[0.6px] text-bronze uppercase">
          You&rsquo;re invited
        </p>
        <h1 className="mt-2 font-serif text-4xl leading-tight text-plum sm:text-5xl">
          {view.couple}
        </h1>
        <p className="mt-4 text-[17px] text-ink">{view.greeting},</p>
        <p className="mt-1 text-[15px] text-ink-2">
          {view.couple} would love for you to celebrate with them. Please let them know which events
          you can join.
        </p>
      </header>
      <div className="mt-8 flex flex-col gap-5">
        {view.events.length === 0 ? (
          <p className="text-center text-[15px] text-ink-2">
            The events for your invitation will appear here soon.
          </p>
        ) : (
          view.events.map((event) => (
            <EventReply
              key={event.eventId}
              token={token}
              event={event}
              guestsAllowed={view.guestsAllowed}
            />
          ))
        )}
      </div>
    </main>
  );
}
