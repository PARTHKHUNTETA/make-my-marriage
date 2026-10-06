import { z } from "zod";
import { istDate } from "@/lib/dates";

// Zod schemas and types for the tasks module (PRD 5.4), shared by the forms and the Server Actions.

export const TASK_STATUSES = ["todo", "in_progress", "completed"] as const;
export const TASK_PRIORITIES = ["low", "medium", "high"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export const STATUS_LABELS: Record<TaskStatus, string> = {
  todo: "To do",
  in_progress: "In progress",
  completed: "Completed",
};
export const PRIORITY_LABELS: Record<TaskPriority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
};

// Blank form fields mean "not set".
const blankToUndefined = (value: unknown) =>
  typeof value === "string" && value.trim() === "" ? undefined : value;
const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, "Not a valid id");

export const taskInputSchema = z.object({
  title: z.string().trim().min(1, "Enter a title").max(200, "That is too long"),
  description: z
    .string()
    .trim()
    .max(2000, "That is too long")
    .optional()
    .transform((value) => value || undefined),
  dueDate: z.preprocess(
    blankToUndefined,
    z
      .string()
      .refine((value) => istDate(value) !== null, "Enter a valid date")
      .optional(),
  ),
  status: z.enum(TASK_STATUSES).default("todo"),
  priority: z.enum(TASK_PRIORITIES).default("medium"),
  assignedMemberId: z.preprocess(blankToUndefined, objectId.optional()),
  eventId: z.preprocess(blankToUndefined, objectId.optional()),
});

export type TaskInput = z.output<typeof taskInputSchema>;
export type TaskFormValues = z.input<typeof taskInputSchema>;

export const taskIdSchema = z.object({ taskId: objectId });
export const taskStatusSchema = z.object({ taskId: objectId, status: z.enum(TASK_STATUSES) });

// ---- listing ----

export const TASK_VIEWS = ["all", "mine", "completed", "by-event"] as const;
export type TaskView = (typeof TASK_VIEWS)[number];

export type TaskQuery = {
  view: TaskView;
  status?: TaskStatus;
  priority?: TaskPriority;
  assignee?: string; // a member id, or "none" for unassigned
  eventId?: string; // an event id, or "none" for tasks with no event
};

// Reads the filters from the page's URL. Anything unrecognised is ignored rather than an error.
export function parseTaskQuery(raw: Record<string, string | string[] | undefined>): TaskQuery {
  const one = (key: string) => {
    const value = raw[key];
    return typeof value === "string" ? value : undefined;
  };
  const view = TASK_VIEWS.find((v) => v === one("view")) ?? "all";
  const status = TASK_STATUSES.find((v) => v === one("status"));
  const priority = TASK_PRIORITIES.find((v) => v === one("priority"));
  const id = (key: string) => {
    const value = one(key);
    return value === "none" || (value && objectId.safeParse(value).success) ? value : undefined;
  };
  return { view, status, priority, assignee: id("assignee"), eventId: id("eventId") };
}

export type TaskItem = {
  id: string;
  title: string;
  description?: string;
  dueDate?: Date;
  status: TaskStatus;
  priority: TaskPriority;
  assignedMemberId?: string;
  eventId?: string;
  // When it was completed (older tasks fall back to their last change).
  completedAt?: Date;
  // Worked out when read, never stored: not completed and the due day has passed (in India).
  overdue: boolean;
};
