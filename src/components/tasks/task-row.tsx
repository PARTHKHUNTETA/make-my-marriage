"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Select } from "@/components/ui/select";
import { changeTaskStatusAction } from "@/modules/tasks/actions";
import {
  PRIORITY_LABELS,
  STATUS_LABELS,
  TASK_STATUSES,
  type TaskItem,
  type TaskStatus,
} from "@/modules/tasks/schema";

const priorityStyle = {
  high: "bg-destructive/10 text-destructive",
  medium: "bg-honey/20 text-bronze",
  low: "bg-rose-200 text-ink-2",
} as const;

const dueFormat = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  timeZone: "Asia/Kolkata",
});

export function TaskRow({
  task,
  assigneeName,
  eventName,
}: {
  task: TaskItem;
  assigneeName?: string;
  eventName?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function changeStatus(status: TaskStatus) {
    setBusy(true);
    setError(null);
    const result = await changeTaskStatusAction({ taskId: task.id, status });
    setBusy(false);
    if (result.ok) router.refresh();
    else setError(result.error.message);
  }

  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3.5">
      <div className="min-w-0 flex-1 basis-60">
        <Link
          href={`/tasks/${task.id}`}
          className={`text-sm font-semibold hover:underline ${
            task.status === "completed" ? "text-ink-2 line-through" : "text-ink"
          }`}
        >
          {task.title}
        </Link>
        <p className="mt-0.5 flex flex-wrap gap-x-3 text-[13px] text-ink-2">
          {task.dueDate ? (
            <span className={task.overdue ? "font-semibold text-destructive" : undefined}>
              {task.overdue ? "Overdue · " : "Due "}
              {dueFormat.format(task.dueDate)}
            </span>
          ) : null}
          {eventName ? <span>{eventName}</span> : null}
          <span>{assigneeName ?? "Unassigned"}</span>
        </p>
        {error ? (
          <p role="alert" className="mt-1 text-xs text-destructive">
            {error}
          </p>
        ) : null}
      </div>
      <span
        className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${priorityStyle[task.priority]}`}
      >
        {PRIORITY_LABELS[task.priority]}
      </span>
      <Select
        aria-label={`Status of ${task.title}`}
        value={task.status}
        disabled={busy}
        onChange={(event) => changeStatus(event.target.value as TaskStatus)}
        className="h-9 w-auto text-[13px]"
      >
        {TASK_STATUSES.map((value) => (
          <option key={value} value={value}>
            {STATUS_LABELS[value]}
          </option>
        ))}
      </Select>
    </li>
  );
}
