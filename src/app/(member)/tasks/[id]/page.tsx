import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { DeleteTaskButton } from "@/components/tasks/delete-task-button";
import { TaskForm } from "@/components/tasks/task-form";
import { requireMember } from "@/lib/authz";
import { toIstYmd } from "@/lib/dates";
import { listEvents } from "@/modules/events/service";
import { listTeam } from "@/modules/members/service";
import { getTask } from "@/modules/tasks/service";

export const metadata: Metadata = { title: "Task — Make My Marriage" };

export default async function TaskPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireMember();
  const { id } = await params;
  const task = await getTask(ctx.weddingId, id);
  if (!task) notFound();
  const [events, team] = await Promise.all([listEvents(ctx.weddingId), listTeam(ctx.weddingId)]);
  // A task may still point at someone who has since been removed; show it as unassigned.
  const assignee = team.members.some((m) => m.memberId === task.assignedMemberId)
    ? task.assignedMemberId
    : "";
  const event = events.some((e) => e.id === task.eventId) ? task.eventId : "";

  return (
    <main className="mx-auto w-full max-w-3xl pt-6">
      <Link
        href="/tasks"
        className="mb-4 inline-flex items-center gap-2 text-[13px] font-semibold text-ink-2 hover:text-ink"
      >
        <ArrowLeft className="size-4" aria-hidden /> Tasks
      </Link>
      <h1 className="mb-6 font-serif text-4xl leading-11 tracking-tight text-plum">Edit task</h1>
      <div className="flex flex-col gap-6">
        <TaskForm
          taskId={task.id}
          initial={{
            title: task.title,
            description: task.description ?? "",
            dueDate: task.dueDate ? toIstYmd(task.dueDate) : "",
            status: task.status,
            priority: task.priority,
            assignedMemberId: assignee ?? "",
            eventId: event ?? "",
          }}
          members={team.members.map((m) => ({ id: m.memberId, name: m.name }))}
          events={events.map((e) => ({ id: e.id, name: e.name }))}
        />
        <DeleteTaskButton taskId={task.id} />
      </div>
    </main>
  );
}
