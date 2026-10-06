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

  function set(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    const query = next.toString();
    router.replace(query ? `${pathname}?${query}` : pathname);
  }

  const view = (params.get("view") as TaskView | null) ?? "all";
  return (
    <div className="flex flex-col gap-3">
      <div role="tablist" aria-label="Task views" className="flex flex-wrap gap-2">
        {TASK_VIEWS.map((value) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={view === value}
            onClick={() => set("view", value === "all" ? "" : value)}
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
          value={params.get("status") ?? ""}
          onChange={(e) => set("status", e.target.value)}
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
          value={params.get("assignee") ?? ""}
          onChange={(e) => set("assignee", e.target.value)}
          className="h-9 text-[13px]"
        >
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
    </div>
  );
}
