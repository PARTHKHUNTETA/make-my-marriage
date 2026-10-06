import type { Metadata } from "next";
import Link from "next/link";
import { ListPlus } from "lucide-react";
import { TaskFilters } from "@/components/tasks/task-filters";
import { TaskRow } from "@/components/tasks/task-row";
import { requireMember } from "@/lib/authz";
import { listEvents } from "@/modules/events/service";
import { listTeam } from "@/modules/members/service";
import { parseTaskQuery, type TaskItem } from "@/modules/tasks/schema";
import { listTasks } from "@/modules/tasks/service";

export const metadata: Metadata = { title: "Tasks — Make My Marriage" };

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const ctx = await requireMember();
  const query = parseTaskQuery(await searchParams);
  const [tasks, events, team] = await Promise.all([
    listTasks(ctx.weddingId, query, ctx.memberId),
    listEvents(ctx.weddingId),
    listTeam(ctx.weddingId),
  ]);
  const memberNames = new Map(team.members.map((m) => [m.memberId, m.name]));
  const eventNames = new Map(events.map((e) => [e.id, e.name]));

  const row = (task: TaskItem, showEvent = true) => (
    <TaskRow
      key={task.id}
      task={task}
      assigneeName={task.assignedMemberId ? memberNames.get(task.assignedMemberId) : undefined}
      eventName={showEvent && task.eventId ? eventNames.get(task.eventId) : undefined}
    />
  );

  // "By event" groups the list under each event, with the unlinked tasks last.
  const groups =
    query.view === "by-event"
      ? [
          ...events.map((e) => ({ name: e.name, items: tasks.filter((t) => t.eventId === e.id) })),
          {
            name: "No event",
            items: tasks.filter((t) => !t.eventId || !eventNames.has(t.eventId)),
          },
        ].filter((g) => g.items.length > 0)
      : null;

  return (
    <main className="mx-auto w-full max-w-4xl pt-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold tracking-[0.6px] text-bronze uppercase">Planning</p>
          <h1 className="mt-1 font-serif text-4xl leading-11 tracking-tight text-plum">Tasks</h1>
          <p className="mt-1 text-sm text-ink-2">
            Your team&rsquo;s checklist. Only members can see it.
          </p>
        </div>
        <Link
          href="/tasks/new"
          className="inline-flex h-11 items-center gap-2 rounded-lg bg-bronze px-5 text-sm font-semibold text-white hover:bg-bronze/90"
        >
          <ListPlus className="size-4" aria-hidden /> Add task
        </Link>
      </div>

      <div className="mt-6">
        <TaskFilters
          members={team.members.map((m) => ({ id: m.memberId, name: m.name }))}
          events={events.map((e) => ({ id: e.id, name: e.name }))}
        />
      </div>

      {tasks.length === 0 ? (
        <div className="mt-6 rounded-xl bg-white p-8 text-center shadow-[0_1px_3px_rgba(35,31,32,0.04)]">
          <p className="font-serif text-xl text-ink">Nothing here</p>
          <p className="mt-1 text-sm text-ink-2">
            {query.view === "all" && !query.status && !query.priority && !query.assignee
              ? "Add your first task, like “Finalize photographer”."
              : "No tasks match these filters."}
          </p>
        </div>
      ) : groups ? (
        <div className="mt-6 flex flex-col gap-4">
          {groups.map((group) => (
            <section
              key={group.name}
              className="rounded-xl bg-white shadow-[0_1px_3px_rgba(35,31,32,0.04)]"
            >
              <h2 className="px-5 pt-4 font-serif text-lg text-ink">{group.name}</h2>
              <ul className="mt-1 divide-y divide-line">
                {group.items.map((task) => row(task, false))}
              </ul>
            </section>
          ))}
        </div>
      ) : (
        <ul className="mt-6 divide-y divide-line rounded-xl bg-white shadow-[0_1px_3px_rgba(35,31,32,0.04)]">
          {tasks.map((task) => row(task))}
        </ul>
      )}
    </main>
  );
}
