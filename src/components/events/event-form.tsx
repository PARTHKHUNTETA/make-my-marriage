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
import { createEventAction, updateEventAction } from "@/modules/events/actions";
import {
  EVENT_TYPES,
  EVENT_TYPE_LABELS,
  eventInputSchema,
  type EventFormValues,
  type EventInput,
  type EventType,
} from "@/modules/events/schema";

const FIELDS = [
  "type",
  "name",
  "date",
  "startTime",
  "endTime",
  "venueName",
  "address",
  "description",
  "dressCode",
] as const;

export function EventForm({
  initial,
  eventId,
}: {
  initial: EventFormValues;
  // Present when editing an existing event.
  eventId?: string;
}) {
  const router = useRouter();
  const [saved, setSaved] = React.useState(false);
  const [problem, setProblem] = React.useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    setValue,
    getValues,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<EventFormValues, undefined, EventInput>({
    resolver: zodResolver(eventInputSchema),
    defaultValues: initial,
  });
  const type = register("type");

  async function onSubmit(values: EventInput) {
    setProblem(null);
    setSaved(false);
    const result = eventId
      ? await updateEventAction({ eventId, ...values })
      : await createEventAction(values);
    if (result.ok) {
      if (!eventId) {
        router.push("/events");
        return;
      }
      reset({
        ...values,
        endTime: values.endTime ?? "",
        venueName: values.venueName ?? "",
        address: values.address ?? "",
        description: values.description ?? "",
        dressCode: values.dressCode ?? "",
      });
      setSaved(true);
      router.refresh();
      return;
    }
    const { code, message, details } = result.error;
    if (code === "VALIDATION_FAILED" && details && typeof details === "object") {
      for (const field of FIELDS) {
        const first = (details as Record<string, string[] | undefined>)[field]?.[0];
        if (first) setError(field, { message: first });
      }
      return;
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
        {problem ? <FormAlert title="Couldn't save the event">{problem}</FormAlert> : null}
        {saved ? (
          <p
            role="status"
            className="rounded-lg border border-forest/20 bg-forest/10 px-3.5 py-3 text-[13px] font-medium text-forest"
          >
            Saved.
          </p>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField
            id="type"
            label="Event type"
            error={errors.type?.message}
            {...type}
            onChange={(event) => {
              // Suggest the type's name while the name is empty or still the previous suggestion.
              const previous = getValues("type") as EventType;
              const name = getValues("name").trim();
              const next = event.target.value as EventType;
              if (next !== "custom" && (name === "" || name === EVENT_TYPE_LABELS[previous]))
                setValue("name", EVENT_TYPE_LABELS[next], { shouldDirty: true });
              void type.onChange(event);
            }}
          >
            {EVENT_TYPES.map((value) => (
              <option key={value} value={value}>
                {EVENT_TYPE_LABELS[value]}
              </option>
            ))}
          </SelectField>
          <Field
            id="name"
            label="Event name"
            autoComplete="off"
            placeholder="e.g. Mehndi Night"
            error={errors.name?.message}
            {...register("name")}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field
            id="date"
            label="Date"
            type="date"
            error={errors.date?.message}
            {...register("date")}
          />
          <Field
            id="startTime"
            label="Start time"
            type="time"
            error={errors.startTime?.message}
            {...register("startTime")}
          />
          <Field
            id="endTime"
            label="End time (optional)"
            type="time"
            error={errors.endTime?.message}
            {...register("endTime")}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            id="venueName"
            label="Venue (optional)"
            autoComplete="off"
            placeholder="e.g. Royal Garden"
            hint="Guests see “Venue to be announced” until you add one."
            error={errors.venueName?.message}
            {...register("venueName")}
          />
          <Field
            id="dressCode"
            label="Dress code (optional)"
            autoComplete="off"
            placeholder="e.g. Green traditional"
            error={errors.dressCode?.message}
            {...register("dressCode")}
          />
        </div>

        <Field
          id="address"
          label="Address (optional)"
          autoComplete="off"
          error={errors.address?.message}
          {...register("address")}
        />

        <div className="flex flex-col gap-1">
          <label htmlFor="description" className="text-xs font-semibold tracking-wide text-ink">
            Description (optional)
          </label>
          <Textarea
            id="description"
            aria-invalid={errors.description ? true : undefined}
            {...register("description")}
          />
          {errors.description?.message ? (
            <FieldError id="description-error">{errors.description.message}</FieldError>
          ) : null}
        </div>

        <label className="flex items-start gap-3 text-sm text-ink">
          <input
            type="checkbox"
            className="mt-0.5 size-4 accent-plum"
            {...register("showOnWebsite")}
          />
          <span>
            Show on the wedding website
            <span className="block text-xs text-ink-2">
              Turn this off for a private event, like a family roka.
            </span>
          </span>
        </label>

        <div className="w-full sm:w-auto sm:min-w-56">
          <SubmitButton pending={isSubmitting} pendingLabel="Saving...">
            {eventId ? "Save changes" : "Add event"}
          </SubmitButton>
        </div>
      </fieldset>
    </form>
  );
}
