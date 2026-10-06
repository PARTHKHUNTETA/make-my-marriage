"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import { AuthCard } from "@/components/auth/auth-card";
import { FormAlert } from "@/components/auth/form-alert";
import { SubmitButton } from "@/components/auth/submit-button";
import { SignOutButton } from "@/components/sign-out-button";
import { WeddingFields } from "./wedding-fields";
import { createWeddingAction } from "@/modules/wedding/actions";
import {
  createWeddingSchema,
  suggestTitle,
  type CreateWeddingFormValues,
  type CreateWeddingInput,
} from "@/modules/wedding/schema";

const FIELDS = ["brideName", "groomName", "title", "date", "city", "venue", "description"] as const;

export function CreateWeddingForm() {
  const router = useRouter();
  const [problem, setProblem] = React.useState<{ title: string; message: string } | null>(null);
  const titleEdited = React.useRef(false);
  const {
    register,
    handleSubmit,
    setError,
    setValue,
    control,
    formState: { errors, isSubmitting },
  } = useForm<CreateWeddingFormValues, undefined, CreateWeddingInput>({
    resolver: zodResolver(createWeddingSchema),
    defaultValues: {
      brideName: "",
      groomName: "",
      title: "",
      date: "",
      city: "",
      venue: "",
      description: "",
    },
  });

  // Suggest "Priya weds Aarav" from the names until the couple writes their own title.
  const [bride, groom] = useWatch({ control, name: ["brideName", "groomName"] });
  React.useEffect(() => {
    if (!titleEdited.current) setValue("title", suggestTitle(bride ?? "", groom ?? ""));
  }, [bride, groom, setValue]);

  async function onSubmit(values: CreateWeddingInput) {
    setProblem(null);
    const result = await createWeddingAction(values);
    if (result.ok) {
      router.replace("/dashboard");
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
    setProblem({
      title: code === "FORBIDDEN" ? "Already set up" : "Couldn't create your wedding",
      message,
    });
  }

  return (
    <AuthCard
      wide
      title="Set up your wedding"
      subtitle="Tell us the basics. You can change all of this later, and add events, guests and the budget next."
      footer={
        <div className="mt-6 flex items-center justify-center gap-1 text-[13px] text-ink-2">
          Not you? <SignOutButton />
        </div>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <fieldset disabled={isSubmitting} className="flex flex-col gap-4">
          {problem ? <FormAlert title={problem.title}>{problem.message}</FormAlert> : null}

          <WeddingFields
            register={register}
            errors={errors}
            onTitleEdited={() => {
              titleEdited.current = true;
            }}
          />

          <SubmitButton pending={isSubmitting} pendingLabel="Creating your wedding...">
            Create my wedding
          </SubmitButton>
        </fieldset>
      </form>
    </AuthCard>
  );
}
