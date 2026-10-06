"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import { Field } from "@/components/auth/field";
import { FieldError } from "@/components/auth/field-error";
import { FormAlert } from "@/components/auth/form-alert";
import { SelectField } from "@/components/auth/select-field";
import { SubmitButton } from "@/components/auth/submit-button";
import { Textarea } from "@/components/ui/textarea";
import { formatRupees, parseRupees } from "@/lib/money";
import { createExpenseAction, updateExpenseAction } from "@/modules/money/actions";
import {
  CATEGORY_LABELS,
  EXPENSE_CATEGORIES,
  PAID_BY,
  PAYER_LABELS,
  expenseInputSchema,
  type ExpenseCategory,
  type ExpenseFormValues,
  type ExpenseInput,
  type SplitDefault,
} from "@/modules/money/schema";

const FIELDS = [
  "title",
  "amount",
  "date",
  "category",
  "paidBy",
  "eventId",
  "notes",
  "shareBride",
  "shareGroom",
  "shareCouple",
] as const;

export function ExpenseForm({
  initial,
  expenseId,
  events,
  splitDefaults,
}: {
  initial: ExpenseFormValues;
  expenseId?: string;
  events: { id: string; name: string }[];
  // Default percentages for shared expenses, by category (set on the Splits page).
  splitDefaults: Partial<Record<ExpenseCategory, SplitDefault>>;
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
    control,
    formState: { errors, isSubmitting },
  } = useForm<ExpenseFormValues, undefined, ExpenseInput>({
    resolver: zodResolver(expenseInputSchema),
    defaultValues: initial,
  });
  const category = register("category");
  const paidBy = register("paidBy");
  const [watchedPaidBy, mode, amountText, bride, groom, couple] = useWatch({
    control,
    name: ["paidBy", "splitMode", "amount", "shareBride", "shareGroom", "shareCouple"],
  });
  const shared = watchedPaidBy === "shared";

  // A new shared expense starts from its category's default split, if the couple set one.
  function applyDefault(forCategory: ExpenseCategory) {
    const preset = splitDefaults[forCategory];
    const empty = !getValues("shareBride") && !getValues("shareGroom") && !getValues("shareCouple");
    if (!preset || !empty) return;
    setValue("splitMode", "percentage");
    setValue("shareBride", preset.bride_family ? String(preset.bride_family) : "");
    setValue("shareGroom", preset.groom_family ? String(preset.groom_family) : "");
    setValue("shareCouple", preset.couple ? String(preset.couple) : "");
  }

  // Live check under the shares, so a mistake is clear before saving.
  const total = parseRupees(String(amountText ?? ""));
  let hint = "";
  if (shared) {
    const parts = [bride, groom, couple].map((v) => String(v ?? "").trim());
    if (mode === "percentage") {
      const sum = parts.reduce((s, v) => s + (Number(v.replace(/%/g, "")) || 0), 0);
      const rounded = Math.round(sum * 100) / 100;
      hint = rounded === 100 ? "Adds up to 100%" : `Adds up to ${rounded}%. It needs to be 100%.`;
    } else {
      const sum = parts.reduce((s, v) => s + (parseRupees(v) ?? 0), 0);
      hint = total
        ? `${formatRupees(sum)} of ${formatRupees(total)}${sum === total ? "" : ` (${formatRupees(Math.abs(total - sum))} ${sum < total ? "left" : "too much"})`}`
        : `${formatRupees(sum)} so far`;
    }
  }

  async function onSubmit(values: ExpenseInput) {
    setProblem(null);
    setSaved(false);
    // The server takes the form's own values, so send those and not the parsed output.
    const raw = getValues();
    const result = expenseId
      ? await updateExpenseAction({ expenseId, ...raw })
      : await createExpenseAction(raw);
    void values;
    if (result.ok) {
      if (!expenseId) {
        router.push("/money");
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
        {problem ? <FormAlert title="Couldn't save the expense">{problem}</FormAlert> : null}
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
          label="What was it for?"
          autoComplete="off"
          placeholder="e.g. Photographer advance"
          error={errors.title?.message}
          {...register("title")}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            id="amount"
            label="Amount (₹)"
            inputMode="decimal"
            autoComplete="off"
            placeholder="e.g. 50,000"
            error={errors.amount?.message}
            {...register("amount")}
          />
          <Field
            id="date"
            label="Date"
            type="date"
            error={errors.date?.message}
            {...register("date")}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField
            id="category"
            label="Category"
            error={errors.category?.message}
            {...category}
            onChange={(event) => {
              void category.onChange(event);
              if (getValues("paidBy") === "shared")
                applyDefault(event.target.value as ExpenseCategory);
            }}
          >
            {EXPENSE_CATEGORIES.map((value) => (
              <option key={value} value={value}>
                {CATEGORY_LABELS[value]}
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

        <SelectField
          id="paidBy"
          label="Paid by"
          error={errors.paidBy?.message}
          {...paidBy}
          onChange={(event) => {
            void paidBy.onChange(event);
            if (event.target.value === "shared") applyDefault(getValues("category"));
          }}
        >
          {PAID_BY.map((value) => (
            <option key={value} value={value}>
              {PAYER_LABELS[value]}
            </option>
          ))}
        </SelectField>

        {shared ? (
          <fieldset className="flex flex-col gap-3 rounded-lg border border-line p-4">
            <legend className="px-1 text-xs font-semibold tracking-wide text-ink">
              How is it shared?
            </legend>
            <div className="flex gap-5 text-sm text-ink">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  value="percentage"
                  className="accent-plum"
                  {...register("splitMode")}
                />
                By percentage
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  value="amount"
                  className="accent-plum"
                  {...register("splitMode")}
                />
                By amount (₹)
              </label>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field
                id="shareBride"
                label={PAYER_LABELS.bride_family}
                inputMode="decimal"
                autoComplete="off"
                placeholder={mode === "amount" ? "₹" : "%"}
                error={errors.shareBride?.message}
                {...register("shareBride")}
              />
              <Field
                id="shareGroom"
                label={PAYER_LABELS.groom_family}
                inputMode="decimal"
                autoComplete="off"
                placeholder={mode === "amount" ? "₹" : "%"}
                error={errors.shareGroom?.message}
                {...register("shareGroom")}
              />
              <Field
                id="shareCouple"
                label={PAYER_LABELS.couple}
                inputMode="decimal"
                autoComplete="off"
                placeholder={mode === "amount" ? "₹" : "%"}
                error={errors.shareCouple?.message}
                {...register("shareCouple")}
              />
            </div>
            <p className="text-xs text-ink-2" aria-live="polite">
              {hint}
            </p>
          </fieldset>
        ) : null}

        <div className="flex flex-col gap-1">
          <label htmlFor="notes" className="text-xs font-semibold tracking-wide text-ink">
            Notes (optional)
          </label>
          <Textarea
            id="notes"
            placeholder="e.g. Paid by UPI"
            aria-invalid={errors.notes ? true : undefined}
            {...register("notes")}
          />
          {errors.notes?.message ? (
            <FieldError id="notes-error">{errors.notes.message}</FieldError>
          ) : null}
        </div>

        <div className="w-full sm:w-auto sm:min-w-56">
          <SubmitButton pending={isSubmitting} pendingLabel="Saving...">
            {expenseId ? "Save changes" : "Add expense"}
          </SubmitButton>
        </div>
      </fieldset>
    </form>
  );
}
