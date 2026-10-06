"use server";

import { revalidatePath } from "next/cache";
import { safeAction } from "@/lib/action";
import { requireMember } from "@/lib/authz";
import { AppError } from "@/lib/errors";
import { eventExists } from "@/modules/events/service";
import { memberExists } from "@/modules/members/service";
import { taskIdSchema, taskInputSchema, taskStatusSchema, type TaskInput } from "./schema";
import { notifyMembers } from "@/modules/notifications/service";
import { changeTaskStatus, createTask, deleteTask, getTask, updateTask } from "./service";

// Server Actions for tasks. Open to Admins and Managers. The wedding always comes from the
// signed-in member. A task may only point at an event and a member of the same wedding, which is
// checked here because this module does not reach into the other modules' data.

async function checkReferences(weddingId: string, input: TaskInput) {
  if (input.eventId && !(await eventExists(weddingId, input.eventId)))
    throw new AppError("VALIDATION_FAILED", "That event no longer exists.", {
      eventId: ["Choose an event from the list"],
    });
  if (input.assignedMemberId && !(await memberExists(weddingId, input.assignedMemberId)))
    throw new AppError("VALIDATION_FAILED", "That person is not part of this wedding.", {
      assignedMemberId: ["Choose a member from the list"],
    });
}

// A member hears when a task is given to them by someone else, once per change of assignee.
async function tellAssignee(
  ctx: { weddingId: string; memberId: string },
  title: string,
  assignee: string | undefined,
  previous: string | undefined,
) {
  if (!assignee || assignee === previous || assignee === ctx.memberId) return;
  await notifyMembers(ctx.weddingId, {
    type: "task_assigned",
    message: `A task was assigned to you: ${title}`,
    link: `/tasks`,
    audience: { memberId: assignee },
  });
}

const refresh = () => revalidatePath("/", "layout");

export async function createTaskAction(input: unknown) {
  return safeAction(async () => {
    const ctx = await requireMember();
    const parsed = taskInputSchema.parse(input);
    await checkReferences(ctx.weddingId, parsed);
    const task = await createTask(ctx.weddingId, parsed);
    await tellAssignee(ctx, parsed.title, parsed.assignedMemberId, undefined);
    refresh();
    return { id: task.id };
  });
}

export async function updateTaskAction(input: unknown) {
  return safeAction(async () => {
    const ctx = await requireMember();
    const { taskId, ...fields } = (input ?? {}) as { taskId?: unknown };
    const id = taskIdSchema.parse({ taskId }).taskId;
    const parsed = taskInputSchema.parse(fields);
    await checkReferences(ctx.weddingId, parsed);
    const before = await getTask(ctx.weddingId, id);
    await updateTask(ctx.weddingId, id, parsed);
    await tellAssignee(ctx, parsed.title, parsed.assignedMemberId, before?.assignedMemberId);
    refresh();
    return {};
  });
}

export async function changeTaskStatusAction(input: unknown) {
  return safeAction(async () => {
    const ctx = await requireMember();
    const { taskId, status } = taskStatusSchema.parse(input);
    await changeTaskStatus(ctx.weddingId, taskId, status);
    refresh();
    return {};
  });
}

export async function deleteTaskAction(input: unknown) {
  return safeAction(async () => {
    const ctx = await requireMember();
    await deleteTask(ctx.weddingId, taskIdSchema.parse(input).taskId);
    refresh();
    return {};
  });
}
