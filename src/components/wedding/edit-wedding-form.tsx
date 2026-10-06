"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { FormAlert } from "@/components/auth/form-alert";
import { SubmitButton } from "@/components/auth/submit-button";
import { updateWeddingAction } from "@/modules/wedding/actions";
import {
  updateWeddingSchema,
  type CreateWeddingFormValues,
  type UpdateWeddingInput,
} from "@/modules/wedding/schema";
import { WeddingFields } from "./wedding-fields";

const FIELDS = ["brideName", "groomName", "title", "date", "city", "venue", "description"] as const;

export function EditWeddingForm({ initial }: { initial: CreateWeddingFormValues }) {
  const router = useRouter();
  const [saved, setSaved] = React.useState(false);
  const [problem, setProblem] = React.useState<{ title: string; message: string } | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<CreateWeddingFormValues, undefined, UpdateWeddingInput>({
    resolver: zodResolver(updateWeddingSchema),
    defaultValues: initial,
  });

  async function onSubmit(values: UpdateWeddingInput) {
    setProblem(null);
    setSaved(false);
    const result = await updateWeddingAction(values);
    if (result.ok) {
      // Treat what was just saved as the new starting point, so "unsaved changes" clears.
      reset({
        brideName: values.brideName,
        groomName: values.groomName,
        title: values.title,
        date: values.date,
        city: values.city,
        venue: values.venue ?? "",
        description: values.description ?? "",
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
    setProblem({ title: "Couldn't save your changes", message });
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      onChange={() => setSaved(false)}
      noValidate
      className="rounded-xl bg-white p-5 shadow-[0_1px_3px_rgba(35,31,32,0.04)] sm:p-6"
    >
      <fieldset disabled={isSubmitting} className="flex flex-col gap-4">
        {problem ? <FormAlert title={problem.title}>{problem.message}</FormAlert> : null}
        {saved ? (
          <p
            role="status"
            className="rounded-lg border border-forest/20 bg-forest/10 px-3.5 py-3 text-[13px] font-medium text-forest"
          >
            Saved. Your dashboard and invitations now show the new details.
          </p>
        ) : null}

        <WeddingFields register={register} errors={errors} />

        <div className="flex items-center gap-3">
          <div className="w-full sm:w-auto sm:min-w-56">
            <SubmitButton pending={isSubmitting} pendingLabel="Saving...">
              Save changes
            </SubmitButton>
          </div>
          {isDirty && !isSubmitting ? (
            <span className="text-[13px] text-ink-2">You have unsaved changes.</span>
          ) : null}
        </div>
      </fieldset>
    </form>
  );
}
