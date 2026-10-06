"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import { Field } from "@/components/auth/field";
import { FieldError } from "@/components/auth/field-error";
import { FormAlert } from "@/components/auth/form-alert";
import { SubmitButton } from "@/components/auth/submit-button";
import { Textarea } from "@/components/ui/textarea";
import { createGuestAction, checkPhoneAction, updateGuestAction } from "@/modules/guests/actions";
import { guestInputSchema, type GuestFormValues, type GuestInput } from "@/modules/guests/schema";

const FIELDS = ["name", "phone", "email", "guestsAllowed", "invitedEventIds", "notes"] as const;

export function GuestForm({
  initial,
  guestId,
  events,
  answeredEventIds = [],
}: {
  initial: GuestFormValues;
  guestId?: string;
  events: { id: string; name: string }[];
  // Events this guest has already replied to: unticking one deletes that reply.
  answeredEventIds?: string[];
}) {
  const router = useRouter();
  const [saved, setSaved] = React.useState(false);
  const [problem, setProblem] = React.useState<string | null>(null);
  const [duplicate, setDuplicate] = React.useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    reset,
    control,
    formState: { errors, isSubmitting },
  } = useForm<GuestFormValues, undefined, GuestInput>({
    resolver: zodResolver(guestInputSchema),
    defaultValues: initial,
  });
  const phone = register("phone");
  const watched = useWatch({ control, name: "invitedEventIds" }) as unknown;
  const chosen = Array.isArray(watched)
    ? (watched as string[])
    : typeof watched === "string"
      ? [watched]
      : [];
  const dropping = answeredEventIds.filter((id) => !chosen.includes(id));

  async function warnIfDuplicate(value: string) {
    setDuplicate(null);
    if (!value.trim()) return;
    const result = await checkPhoneAction({ phone: value, excludeGuestId: guestId });
    if (result.ok && result.data.duplicateOf) setDuplicate(result.data.duplicateOf);
  }

  async function onSubmit(values: GuestInput) {
    setProblem(null);
    setSaved(false);
    const result = guestId
      ? await updateGuestAction({ guestId, ...values })
      : await createGuestAction(values);
    if (result.ok) {
      if (!guestId) {
        router.push("/guests");
        return;
      }
      reset({
        ...values,
        phone: values.phone ?? "",
        email: values.email ?? "",
        notes: values.notes ?? "",
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
        {problem ? <FormAlert title="Couldn't save the guest">{problem}</FormAlert> : null}
        {saved ? (
          <p
            role="status"
            className="rounded-lg border border-forest/20 bg-forest/10 px-3.5 py-3 text-[13px] font-medium text-forest"
          >
            Saved.
          </p>
        ) : null}

        <Field
          id="name"
          label="Guest or family name"
          autoComplete="off"
          placeholder="e.g. Rajesh Sharma"
          hint="One entry is one invited party. Family members are not added one by one."
          error={errors.name?.message}
          {...register("name")}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <Field
              id="phone"
              label="Phone (optional)"
              type="tel"
              autoComplete="off"
              placeholder="e.g. 98765 43210"
              hint="Numbers without a country code are treated as +91."
              error={errors.phone?.message as string | undefined}
              {...phone}
              onBlur={(event) => {
                void phone.onBlur(event);
                void warnIfDuplicate(event.target.value);
              }}
            />
            {duplicate ? (
              <p role="status" className="text-xs font-medium text-bronze">
                Heads up: {duplicate} already has this number. You can still save.
              </p>
            ) : null}
          </div>
          <Field
            id="email"
            label="Email (optional)"
            type="email"
            autoComplete="off"
            error={errors.email?.message as string | undefined}
            {...register("email")}
          />
        </div>

        <div className="max-w-48">
          <Field
            id="guestsAllowed"
            label="Guests allowed"
            type="number"
            inputMode="numeric"
            min={1}
            error={errors.guestsAllowed?.message}
            {...register("guestsAllowed")}
          />
        </div>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-xs font-semibold tracking-wide text-ink">Invited to</legend>
          {events.length === 0 ? (
            <p className="text-[13px] text-ink-2">
              Add an event first. Guests are invited to events.
            </p>
          ) : (
            events.map((event) => (
              <label key={event.id} className="flex items-center gap-3 text-sm text-ink">
                <input
                  type="checkbox"
                  value={event.id}
                  className="size-4 accent-plum"
                  {...register("invitedEventIds")}
                />
                {event.name}
              </label>
            ))
          )}
          {errors.invitedEventIds?.message ? (
            <FieldError id="invitedEventIds-error">
              {errors.invitedEventIds.message as string}
            </FieldError>
          ) : null}
          {dropping.length > 0 ? (
            <p role="status" className="text-xs font-medium text-bronze">
              Removing{" "}
              {dropping.length === 1
                ? "an event they have replied to"
                : "events they have replied to"}{" "}
              deletes that reply.
            </p>
          ) : null}
        </fieldset>

        <div className="flex flex-col gap-1">
          <label htmlFor="notes" className="text-xs font-semibold tracking-wide text-ink">
            Notes (optional)
          </label>
          <Textarea
            id="notes"
            placeholder="e.g. Arriving from Jaipur"
            aria-invalid={errors.notes ? true : undefined}
            {...register("notes")}
          />
          {errors.notes?.message ? (
            <FieldError id="notes-error">{errors.notes.message}</FieldError>
          ) : null}
        </div>

        <div className="w-full sm:w-auto sm:min-w-56">
          <SubmitButton pending={isSubmitting} pendingLabel="Saving...">
            {guestId ? "Save changes" : "Add guest"}
          </SubmitButton>
        </div>
      </fieldset>
    </form>
  );
}
