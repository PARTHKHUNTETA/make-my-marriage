"use client";

import type { FieldErrors, UseFormRegister } from "react-hook-form";
import { Field } from "@/components/auth/field";
import { FieldError } from "@/components/auth/field-error";
import { Textarea } from "@/components/ui/textarea";
import type { CreateWeddingFormValues } from "@/modules/wedding/schema";

// The wedding's basics, used by first-time setup and by Settings → Wedding details so the two
// forms always ask for the same things the same way.
export function WeddingFields({
  register,
  errors,
  onTitleEdited,
}: {
  register: UseFormRegister<CreateWeddingFormValues>;
  errors: FieldErrors<CreateWeddingFormValues>;
  // Called when the couple types their own title, so setup stops suggesting one.
  onTitleEdited?: () => void;
}) {
  const title = register("title");
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          id="brideName"
          label="Bride's name"
          autoComplete="off"
          placeholder="e.g. Priya"
          error={errors.brideName?.message}
          {...register("brideName")}
        />
        <Field
          id="groomName"
          label="Groom's name"
          autoComplete="off"
          placeholder="e.g. Aarav"
          error={errors.groomName?.message}
          {...register("groomName")}
        />
      </div>

      <Field
        id="title"
        label="Wedding title"
        autoComplete="off"
        placeholder="e.g. Priya weds Aarav"
        hint="Shown on your dashboard, invitations and wedding website."
        error={errors.title?.message}
        {...title}
        onChange={(event) => {
          onTitleEdited?.();
          void title.onChange(event);
        }}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          id="date"
          label="Wedding date"
          type="date"
          error={errors.date?.message}
          {...register("date")}
        />
        <Field
          id="city"
          label="City"
          autoComplete="off"
          placeholder="e.g. Jaipur"
          error={errors.city?.message}
          {...register("city")}
        />
      </div>

      <Field
        id="venue"
        label="Venue (optional)"
        autoComplete="off"
        placeholder="e.g. Rambagh Palace"
        error={errors.venue?.message}
        {...register("venue")}
      />

      <div className="flex flex-col gap-1">
        <label htmlFor="description" className="text-xs font-semibold tracking-wide text-ink">
          Welcome message (optional)
        </label>
        <Textarea
          id="description"
          placeholder="A few words for your guests"
          aria-invalid={errors.description ? true : undefined}
          aria-describedby={errors.description ? "description-error" : undefined}
          {...register("description")}
        />
        {errors.description?.message ? (
          <FieldError id="description-error">{errors.description.message}</FieldError>
        ) : null}
      </div>
    </>
  );
}
