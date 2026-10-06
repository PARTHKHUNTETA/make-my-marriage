import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { TaskForm } from "@/components/tasks/task-form";
import { requireMember } from "@/lib/authz";
import { listEvents } from "@/modules/events/service";
import { listTeam } from "@/modules/members/service";

export const metadata: Metadata = { title: "Add task — Make My Marriage" };

export default async function NewTaskPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const ctx = await requireMember();
  const { eventId } = await searchParams;
  const [events, team] = await Promise.all([listEvents(ctx.weddingId), listTeam(ctx.weddingId)]);
  // Arriving from an event's page pre-selects that event, if it is a real one in this wedding.
  const preset = typeof eventId === "string" && events.some((e) => e.id === eventId) ? eventId : "";

  return (
    <main className="mx-auto w-full max-w-3xl pt-6">
      <Link
        href="/tasks"
        className="mb-4 inline-flex items-center gap-2 text-[13px] font-semibold text-ink-2 hover:text-ink"
      >
        <ArrowLeft className="size-4" aria-hidden /> Tasks
      </Link>
      <h1 className="mb-6 font-serif text-4xl leading-11 tracking-tight text-plum">Add task</h1>
      <TaskForm
        initial={{
          title: "",
          description: "",
          dueDate: "",
          status: "todo",
          priority: "medium",
          assignedMemberId: "",
          eventId: preset,
        }}
        members={team.members.map((m) => ({ id: m.memberId, name: m.name }))}
        events={events.map((e) => ({ id: e.id, name: e.name }))}
      />
    </main>
  );
}
