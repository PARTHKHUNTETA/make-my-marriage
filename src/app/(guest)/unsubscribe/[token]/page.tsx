import type { Metadata } from "next";
import { UnsubscribeCard } from "@/components/invite/unsubscribe-card";
import { getUnsubscribeState } from "@/modules/invitations/sending";

export const metadata: Metadata = { title: "Reminder emails", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function UnsubscribePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const state = await getUnsubscribeState(token);
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-5 py-16 text-center">
      <h1 className="font-serif text-3xl text-plum">Reminder emails</h1>
      {state ? (
        <UnsubscribeCard token={token} couple={state.couple} initial={state.unsubscribed} />
      ) : (
        <p className="mt-3 text-[15px] text-ink-2">
          This link isn&rsquo;t working. If you still get emails you don&rsquo;t want, please reply
          to one of them and the couple will sort it out.
        </p>
      )}
    </main>
  );
}
