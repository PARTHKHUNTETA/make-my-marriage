"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Select } from "@/components/ui/select";
import {
  PRIORITY_LABELS,
  STATUS_LABELS,
  TASK_PRIORITIES,
  TASK_STATUSES,
  TASK_VIEWS,
  type TaskView,
} from "@/modules/tasks/schema";

const FILTER_KEYS = ["status", "priority", "assignee", "eventId"] as const;

const VIEW_LABELS: Record<TaskView, string> = {
  all: "All tasks",
  mine: "My tasks",
  completed: "Completed",
  "by-event": "By event",
};

// Filters live in the URL, so a filtered list can be bookmarked or shared.
export function TaskFilters({
  members,
  events,
}: {
  members: { id: string; name: string }[];
  events: { id: string; name: string }[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  function go(next: URLSearchParams) {
    const query = next.toString();
    router.replace(query ? `${pathname}?${query}` : pathname);
  }

  function set(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    go(next);
  }

  // A tab can fix one filter: "My tasks" is always yours, "Completed" is always done. Switching to
  // it drops the clashing filter, so nothing hidden narrows the list.
  function setView(value: TaskView) {
    const next = new URLSearchParams(params.toString());
    if (value === "all") next.delete("view");
    else next.set("view", value);
    if (value === "mine") next.delete("assignee");
    if (value === "completed") next.delete("status");
    go(next);
  }

  function clearFilters() {
    const next = new URLSearchParams(params.toString());
    for (const key of FILTER_KEYS) next.delete(key);
    go(next);
  }

  const view = (params.get("view") as TaskView | null) ?? "all";
  const mine = view === "mine";
  const completed = view === "completed";
  const filtering = FILTER_KEYS.some(
    (key) => params.get(key) && !(key === "assignee" && mine) && !(key === "status" && completed),
  );
  return (
    <div className="flex flex-col gap-3">
      <div role="tablist" aria-label="Task views" className="flex flex-wrap gap-2">
        {TASK_VIEWS.map((value) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={view === value}
            onClick={() => setView(value)}
            className={`rounded-full px-4 py-1.5 text-[13px] font-semibold transition-colors ${
              view === value ? "bg-plum text-white" : "bg-white text-ink-2 hover:bg-rose-200"
            }`}
          >
            {VIEW_LABELS[value]}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Select
          aria-label="Filter by status"
          value={completed ? "completed" : (params.get("status") ?? "")}
          onChange={(e) => set("status", e.target.value)}
          disabled={completed}
          title={completed ? "The Completed tab shows completed tasks" : undefined}
          className="h-9 text-[13px]"
        >
          <option value="">Any status</option>
          {TASK_STATUSES.map((v) => (
            <option key={v} value={v}>
              {STATUS_LABELS[v]}
            </option>
          ))}
        </Select>
        <Select
          aria-label="Filter by priority"
          value={params.get("priority") ?? ""}
          onChange={(e) => set("priority", e.target.value)}
          className="h-9 text-[13px]"
        >
          <option value="">Any priority</option>
          {TASK_PRIORITIES.map((v) => (
            <option key={v} value={v}>
              {PRIORITY_LABELS[v]}
            </option>
          ))}
        </Select>
        <Select
          aria-label="Filter by assigned member"
          value={mine ? "me" : (params.get("assignee") ?? "")}
          onChange={(e) => set("assignee", e.target.value)}
          disabled={mine}
          title={mine ? "My tasks shows tasks assigned to you" : undefined}
          className="h-9 text-[13px]"
        >
          {mine ? <option value="me">You</option> : null}
          <option value="">Anyone</option>
          <option value="none">Unassigned</option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </Select>
        <Select
          aria-label="Filter by event"
          value={params.get("eventId") ?? ""}
          onChange={(e) => set("eventId", e.target.value)}
          className="h-9 text-[13px]"
        >
          <option value="">Any event</option>
          <option value="none">No event</option>
          {events.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name}
            </option>
          ))}
        </Select>
      </div>
      {filtering ? (
        <button
          type="button"
          onClick={clearFilters}
          className="self-start text-[13px] font-semibold text-bronze hover:underline"
        >
          Clear filters
        </button>
      ) : null}
    </div>
  );
}
