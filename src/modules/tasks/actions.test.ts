import { beforeEach, describe, expect, it, vi } from "vitest";

const requireMember = vi.hoisted(() => vi.fn());
const service = vi.hoisted(() => ({
  createTask: vi.fn(),
  updateTask: vi.fn(),
  changeTaskStatus: vi.fn(),
  deleteTask: vi.fn(),
}));
const eventExists = vi.hoisted(() => vi.fn());
const memberExists = vi.hoisted(() => vi.fn());
vi.mock("@/lib/authz", () => ({ requireMember }));
vi.mock("./service", () => service);
vi.mock("@/modules/events/service", () => ({ eventExists }));
vi.mock("@/modules/members/service", () => ({ memberExists }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import {
  changeTaskStatusAction,
  createTaskAction,
  deleteTaskAction,
  updateTaskAction,
} from "./actions";

const ID = "507f1f77bcf86cd799439011";
const OTHER = "507f1f77bcf86cd799439012";

beforeEach(() => {
  requireMember
    .mockReset()
    .mockResolvedValue({ kind: "member", weddingId: "w1", memberId: "m1", role: "manager" });
  Object.values(service).forEach((fn) => fn.mockReset().mockResolvedValue({ id: "t1" }));
  eventExists.mockReset().mockResolvedValue(true);
  memberExists.mockReset().mockResolvedValue(true);
});

describe("task actions", () => {
  it("create: uses the caller's wedding, never one from the input", async () => {
    const result = await createTaskAction({ title: "Book band", weddingId: "evil" });
    expect(result).toEqual({ ok: true, data: { id: "t1" } });
    expect(service.createTask.mock.calls[0]![0]).toBe("w1");
  });

  it("create: refuses an event that is not in this wedding", async () => {
    eventExists.mockResolvedValue(false);
    const result = await createTaskAction({ title: "x", eventId: ID });
    expect(result).toMatchObject({ ok: false, error: { code: "VALIDATION_FAILED" } });
    expect(eventExists).toHaveBeenCalledWith("w1", ID);
    expect(service.createTask).not.toHaveBeenCalled();
  });

  it("create: refuses a member who is not in this wedding", async () => {
    memberExists.mockResolvedValue(false);
    const result = await createTaskAction({ title: "x", assignedMemberId: OTHER });
    expect(result).toMatchObject({ ok: false, error: { code: "VALIDATION_FAILED" } });
    expect(service.createTask).not.toHaveBeenCalled();
  });

  it("update: checks the references too", async () => {
    eventExists.mockResolvedValue(false);
    const result = await updateTaskAction({ taskId: ID, title: "x", eventId: OTHER });
    expect(result.ok).toBe(false);
    expect(service.updateTask).not.toHaveBeenCalled();
  });

  it("validates input before touching anything", async () => {
    expect(await createTaskAction({ title: "" })).toMatchObject({
      ok: false,
      error: { code: "VALIDATION_FAILED" },
    });
    expect(await changeTaskStatusAction({ taskId: ID, status: "done" })).toMatchObject({
      ok: false,
    });
    expect(await deleteTaskAction({ taskId: "nope" })).toMatchObject({ ok: false });
  });

  it("every action needs a signed-in member", async () => {
    const { AppError } = await import("@/lib/errors");
    requireMember.mockRejectedValue(new AppError("UNAUTHENTICATED", "Sign in"));
    for (const result of [
      await createTaskAction({ title: "x" }),
      await updateTaskAction({ taskId: ID, title: "x" }),
      await changeTaskStatusAction({ taskId: ID, status: "todo" }),
      await deleteTaskAction({ taskId: ID }),
    ])
      expect(result).toMatchObject({ ok: false, error: { code: "UNAUTHENTICATED" } });
    expect(Object.values(service).every((fn) => fn.mock.calls.length === 0)).toBe(true);
  });
});
