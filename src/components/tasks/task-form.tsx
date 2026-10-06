"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Field } from "@/components/auth/field";
import { FieldError } from "@/components/auth/field-error";
import { FormAlert } from "@/components/auth/form-alert";
import { SelectField } from "@/components/auth/select-field";
import { SubmitButton } from "@/components/auth/submit-button";
import { Textarea } from "@/components/ui/textarea";
import { createTaskAction, updateTaskAction } from "@/modules/tasks/actions";
import {
  PRIORITY_LABELS,
  STATUS_LABELS,
  TASK_PRIORITIES,
  TASK_STATUSES,
  taskInputSchema,
  type TaskFormValues,
  type TaskInput,
} from "@/modules/tasks/schema";

const FIELDS = [
  "title",
  "description",
  "dueDate",
  "status",
  "priority",
  "assignedMemberId",
  "eventId",
] as const;

export function TaskForm({
  initial,
  taskId,
  members,
  events,
}: {
  initial: TaskFormValues;
  taskId?: string;
  members: { id: string; name: string }[];
  events: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [saved, setSaved] = React.useState(false);
  const [problem, setProblem] = React.useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<TaskFormValues, undefined, TaskInput>({
    resolver: zodResolver(taskInputSchema),
    defaultValues: initial,
  });

  async function onSubmit(values: TaskInput) {
    setProblem(null);
    setSaved(false);
    const result = taskId
      ? await updateTaskAction({ taskId, ...values })
      : await createTaskAction(values);
    if (result.ok) {
      if (!taskId) {
        router.push("/tasks");
        return;
      }
      reset({
        ...values,
        description: values.description ?? "",
        dueDate: values.dueDate ?? "",
        assignedMemberId: values.assignedMemberId ?? "",
        eventId: values.eventId ?? "",
      });
      setSaved(true);
      router.refresh();
      return;
    }
    const { code, message, details } = result.error;
    if (code === "VALIDATION_FAILED" && details && typeof details === "object") {
      let shown = false;
      for (const field of FIELDS) {
        const first = (details as Record<string, string[] | undefined>)[field]?.[0];
        if (first) {
          setError(field, { message: first });
          shown = true;
        }
      }
      if (shown) return;
    }
    setProblem(message);
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      onChange={() => setSaved(false)}
      noValidate
      className="rounded-xl bg-white p-5 shadow-[0_1px_3px_rgba(35,31,32,0.04)] sm:p-6"
    >
      <fieldset disabled={isSubmitting} className="flex flex-col gap-4">
        {problem ? <FormAlert title="Couldn't save the task">{problem}</FormAlert> : null}
        {saved ? (
          <p
            role="status"
            className="rounded-lg border border-forest/20 bg-forest/10 px-3.5 py-3 text-[13px] font-medium text-forest"
          >
            Saved.
          </p>
        ) : null}

        <Field
          id="title"
          label="Task"
          autoComplete="off"
          placeholder="e.g. Finalize photographer"
          error={errors.title?.message}
          {...register("title")}
        />

        <div className="flex flex-col gap-1">
          <label htmlFor="description" className="text-xs font-semibold tracking-wide text-ink">
            Notes (optional)
          </label>
          <Textarea
            id="description"
            placeholder="e.g. Compare three quotes"
            aria-invalid={errors.description ? true : undefined}
            {...register("description")}
          />
          {errors.description?.message ? (
            <FieldError id="description-error">{errors.description.message}</FieldError>
          ) : null}
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field
            id="dueDate"
            label="Due date (optional)"
            type="date"
            error={errors.dueDate?.message as string | undefined}
            {...register("dueDate")}
          />
          <SelectField
            id="status"
            label="Status"
            error={errors.status?.message}
            {...register("status")}
          >
            {TASK_STATUSES.map((value) => (
              <option key={value} value={value}>
                {STATUS_LABELS[value]}
              </option>
            ))}
          </SelectField>
          <SelectField
            id="priority"
            label="Priority"
            error={errors.priority?.message}
            {...register("priority")}
          >
            {TASK_PRIORITIES.map((value) => (
              <option key={value} value={value}>
                {PRIORITY_LABELS[value]}
              </option>
            ))}
          </SelectField>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField
            id="assignedMemberId"
            label="Assigned to (optional)"
            error={errors.assignedMemberId?.message as string | undefined}
            {...register("assignedMemberId")}
          >
            <option value="">Nobody yet</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </SelectField>
          <SelectField
            id="eventId"
            label="Related event (optional)"
            error={errors.eventId?.message as string | undefined}
            {...register("eventId")}
          >
            <option value="">No event</option>
            {events.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </SelectField>
        </div>

        <div className="w-full sm:w-auto sm:min-w-56">
          <SubmitButton pending={isSubmitting} pendingLabel="Saving...">
            {taskId ? "Save changes" : "Add task"}
          </SubmitButton>
        </div>
      </fieldset>
    </form>
  );
}
