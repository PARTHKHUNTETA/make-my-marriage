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
import { createVendorAction, updateVendorAction } from "@/modules/vendors/actions";
import {
  VENDOR_CATEGORIES,
  VENDOR_CATEGORY_LABELS,
  vendorInputSchema,
  type VendorFormValues,
  type VendorInput,
} from "@/modules/vendors/schema";

const FIELDS = [
  "name",
  "category",
  "phone",
  "email",
  "address",
  "totalCost",
  "eventIds",
  "notes",
] as const;

export function VendorForm({
  initial,
  vendorId,
  events,
}: {
  initial: VendorFormValues;
  vendorId?: string;
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
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<VendorFormValues, undefined, VendorInput>({
    resolver: zodResolver(vendorInputSchema),
    defaultValues: initial,
  });

  async function onSubmit() {
    setProblem(null);
    setSaved(false);
    // The server checks the form's own values again, so send those.
    const raw = getValues();
    const result = vendorId
      ? await updateVendorAction({ vendorId, ...raw })
      : await createVendorAction(raw);
    if (result.ok) {
      if (!vendorId) {
        router.push(`/vendors/${(result.data as { id: string }).id}`);
        return;
      }
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
        {problem ? <FormAlert title="Couldn't save the vendor">{problem}</FormAlert> : null}
        {saved ? (
          <p
            role="status"
            className="rounded-lg border border-forest/20 bg-forest/10 px-3.5 py-3 text-[13px] font-medium text-forest"
          >
            Saved.
          </p>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            id="name"
            label="Vendor name"
            autoComplete="off"
            placeholder="e.g. Pixel Photography"
            error={errors.name?.message}
            {...register("name")}
          />
          <SelectField
            id="category"
            label="Category"
            error={errors.category?.message}
            {...register("category")}
          >
            {VENDOR_CATEGORIES.map((value) => (
              <option key={value} value={value}>
                {VENDOR_CATEGORY_LABELS[value]}
              </option>
            ))}
          </SelectField>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            id="phone"
            label="Phone (optional)"
            type="tel"
            autoComplete="off"
            placeholder="e.g. 98765 43210"
            error={errors.phone?.message as string | undefined}
            {...register("phone")}
          />
          <Field
            id="email"
            label="Email (optional)"
            type="email"
            autoComplete="off"
            error={errors.email?.message as string | undefined}
            {...register("email")}
          />
        </div>

        <Field
          id="address"
          label="Address (optional)"
          autoComplete="off"
          error={errors.address?.message}
          {...register("address")}
        />

        <div className="max-w-64">
          <Field
            id="totalCost"
            label="Total cost, ₹ (optional)"
            inputMode="decimal"
            autoComplete="off"
            placeholder="e.g. 1,50,000"
            error={errors.totalCost?.message as string | undefined}
            {...register("totalCost")}
          />
        </div>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-xs font-semibold tracking-wide text-ink">
            Related events (optional)
          </legend>
          {events.length === 0 ? (
            <p className="text-[13px] text-ink-2">Add events first to link a vendor to them.</p>
          ) : (
            events.map((event) => (
              <label key={event.id} className="flex items-center gap-3 text-sm text-ink">
                <input
                  type="checkbox"
                  value={event.id}
                  className="size-4 accent-plum"
                  {...register("eventIds")}
                />
                {event.name}
              </label>
            ))
          )}
          {errors.eventIds?.message ? (
            <FieldError id="eventIds-error">{errors.eventIds.message as string}</FieldError>
          ) : null}
        </fieldset>

        <div className="flex flex-col gap-1">
          <label htmlFor="notes" className="text-xs font-semibold tracking-wide text-ink">
            Notes (optional)
          </label>
          <Textarea
            id="notes"
            placeholder="e.g. Includes drone shots"
            aria-invalid={errors.notes ? true : undefined}
            {...register("notes")}
          />
          {errors.notes?.message ? (
            <FieldError id="notes-error">{errors.notes.message}</FieldError>
          ) : null}
        </div>

        <div className="w-full sm:w-auto sm:min-w-56">
          <SubmitButton pending={isSubmitting} pendingLabel="Saving...">
            {vendorId ? "Save changes" : "Add vendor"}
          </SubmitButton>
        </div>
      </fieldset>
    </form>
  );
}
