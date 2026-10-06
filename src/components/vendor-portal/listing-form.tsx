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
import { saveListingAction } from "@/modules/marketplace/actions";
import {
  listingInputSchema,
  type ListingFormValues,
  type ListingInput,
} from "@/modules/marketplace/schema";
import { VENDOR_CATEGORIES, VENDOR_CATEGORY_LABELS } from "@/modules/vendors/schema";

const FIELDS = [
  "category",
  "cities",
  "description",
  "startingPrice",
  "website",
  "instagram",
] as const;

export function ListingForm({
  initial,
  hasListing,
}: {
  initial: ListingFormValues;
  hasListing: boolean;
}) {
  const router = useRouter();
  const [saved, setSaved] = React.useState(false);
  const [problem, setProblem] = React.useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    reset,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<ListingFormValues, undefined, ListingInput>({
    resolver: zodResolver(listingInputSchema),
    defaultValues: initial,
  });

  async function onSubmit() {
    setProblem(null);
    setSaved(false);
    const raw = getValues();
    const result = await saveListingAction(raw);
    if (result.ok) {
      reset(raw);
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
        {problem ? <FormAlert title="Couldn't save your listing">{problem}</FormAlert> : null}
        {saved ? (
          <p
            role="status"
            className="rounded-lg border border-forest/20 bg-forest/10 px-3.5 py-3 text-[13px] font-medium text-forest"
          >
            Saved and sent to the Make My Marriage team for approval.
          </p>
        ) : null}

        <SelectField
          id="category"
          label="What do you do?"
          error={errors.category?.message}
          {...register("category")}
        >
          {VENDOR_CATEGORIES.map((value) => (
            <option key={value} value={value}>
              {VENDOR_CATEGORY_LABELS[value]}
            </option>
          ))}
        </SelectField>

        <Field
          id="cities"
          label="Cities you serve"
          autoComplete="off"
          placeholder="e.g. Jaipur, Udaipur"
          hint="Separate with commas. Up to 10."
          error={errors.cities?.message}
          {...register("cities")}
        />

        <div className="flex flex-col gap-1">
          <label htmlFor="description" className="text-xs font-semibold tracking-wide text-ink">
            About your work
          </label>
          <Textarea
            id="description"
            rows={6}
            placeholder="What you offer, your style, your experience."
            aria-invalid={errors.description ? true : undefined}
            {...register("description")}
          />
          {errors.description?.message ? (
            <FieldError id="description-error">{errors.description.message}</FieldError>
          ) : null}
        </div>

        <div className="max-w-64">
          <Field
            id="startingPrice"
            label="Starting price, ₹ (optional)"
            inputMode="decimal"
            autoComplete="off"
            placeholder="e.g. 50,000"
            error={errors.startingPrice?.message as string | undefined}
            {...register("startingPrice")}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            id="website"
            label="Website (optional)"
            autoComplete="off"
            placeholder="e.g. pixelphoto.in"
            error={errors.website?.message as string | undefined}
            {...register("website")}
          />
          <Field
            id="instagram"
            label="Instagram (optional)"
            autoComplete="off"
            placeholder="e.g. @pixelphoto"
            error={errors.instagram?.message as string | undefined}
            {...register("instagram")}
          />
        </div>

        <p className="text-xs text-ink-2">
          Every change goes to the Make My Marriage team for approval before it appears to couples.
          Your business name, phone and email come from your account.
        </p>

        <div className="w-full sm:w-auto sm:min-w-56">
          <SubmitButton pending={isSubmitting} pendingLabel="Saving...">
            {hasListing ? "Save and send for approval" : "Create listing"}
          </SubmitButton>
        </div>
      </fieldset>
    </form>
  );
}
