"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { FormAlert } from "@/components/auth/form-alert";
import { Textarea } from "@/components/ui/textarea";
import { sendBookingRequestAction } from "@/modules/marketplace/actions";

const inputClass =
  "h-11 w-full rounded-lg border border-line-soft/60 bg-white px-4 text-sm text-ink outline-none focus:border-plum focus:ring-1 focus:ring-plum aria-invalid:border-destructive";

// Asking a vendor for a quote. The vendor sees only what is chosen and typed here: the events
// (name and date), the city, the headcount, the message and the contact details.
export function BookingRequestForm({
  listingId,
  events,
  defaultCity,
  defaultHeadcount,
  defaultContactName,
}: {
  listingId: string;
  events: { id: string; name: string; dateLabel: string }[];
  defaultCity: string;
  defaultHeadcount: number | null;
  defaultContactName: string;
}) {
  const router = useRouter();
  const [chosen, setChosen] = React.useState<string[]>([]);
  const [city, setCity] = React.useState(defaultCity);
  const [headcount, setHeadcount] = React.useState(
    defaultHeadcount ? String(defaultHeadcount) : "",
  );
  const [message, setMessage] = React.useState("");
  const [contactName, setContactName] = React.useState(defaultContactName);
  const [contactPhone, setContactPhone] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [problem, setProblem] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setProblem(null);
    setFieldErrors({});
    const result = await sendBookingRequestAction({
      listingId,
      eventIds: chosen,
      city,
      expectedHeadcount: headcount,
      message,
      contactName,
      contactPhone,
    });
    setBusy(false);
    if (result.ok) {
      router.push("/vendors/bookings");
      return;
    }
    const details = result.error.details as Record<string, string[] | undefined> | undefined;
    if (result.error.code === "VALIDATION_FAILED" && details) {
      const errors: Record<string, string> = {};
      for (const [key, value] of Object.entries(details)) if (value?.[0]) errors[key] = value[0];
      if (Object.keys(errors).length > 0) {
        setFieldErrors(errors);
        return;
      }
    }
    setProblem(result.error.message);
  }

  if (events.length === 0)
    return (
      <p className="rounded-lg bg-rose-50 p-4 text-sm text-ink-2">
        Add your events first. A request is for the events you want this vendor at.
      </p>
    );

  const error = (key: string) =>
    fieldErrors[key] ? (
      <span role="alert" className="text-xs text-destructive">
        {fieldErrors[key]}
      </span>
    ) : null;

  return (
    <form onSubmit={submit} noValidate>
      <fieldset disabled={busy} className="flex flex-col gap-4">
        {problem ? <FormAlert title="Couldn't send the request">{problem}</FormAlert> : null}
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-xs font-semibold tracking-wide text-ink">
            Which events?
          </legend>
          {events.map((e) => (
            <label key={e.id} className="flex items-center gap-3 text-sm text-ink">
              <input
                type="checkbox"
                className="size-4 accent-plum"
                checked={chosen.includes(e.id)}
                onChange={(ev) =>
                  setChosen((current) =>
                    ev.target.checked ? [...current, e.id] : current.filter((id) => id !== e.id),
                  )
                }
              />
              {e.name} <span className="text-[13px] text-ink-2">· {e.dateLabel}</span>
            </label>
          ))}
          {error("eventIds")}
        </fieldset>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-xs font-semibold tracking-wide text-ink">
            City
            <input
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className={inputClass}
              aria-invalid={fieldErrors.city ? true : undefined}
            />
            {error("city")}
          </label>
          <label className="flex flex-col gap-1 text-xs font-semibold tracking-wide text-ink">
            Expected number of guests
            <input
              value={headcount}
              onChange={(e) => setHeadcount(e.target.value)}
              inputMode="numeric"
              className={inputClass}
              aria-invalid={fieldErrors.expectedHeadcount ? true : undefined}
            />
            {error("expectedHeadcount")}
          </label>
        </div>

        <label className="flex flex-col gap-1 text-xs font-semibold tracking-wide text-ink">
          Message (optional)
          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="What you need, your style, your budget."
          />
          {error("message")}
        </label>

        <div className="rounded-lg border border-line p-4">
          <p className="text-xs font-semibold tracking-wide text-ink">
            How should they reach you? (optional)
          </p>
          <p className="mb-3 text-xs text-ink-2">
            Shared with this vendor only. Without it they can only reply here.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-xs font-semibold tracking-wide text-ink">
              Name
              <input
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                className={inputClass}
              />
              {error("contactName")}
            </label>
            <label className="flex flex-col gap-1 text-xs font-semibold tracking-wide text-ink">
              Phone
              <input
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                type="tel"
                className={inputClass}
                aria-invalid={fieldErrors.contactPhone ? true : undefined}
              />
              {error("contactPhone")}
            </label>
          </div>
        </div>

        <button
          type="submit"
          disabled={busy || chosen.length === 0}
          className="h-11 rounded-lg bg-bronze px-6 text-sm font-semibold text-white hover:bg-bronze/90 disabled:opacity-50 sm:self-start"
        >
          {busy ? "Sending..." : "Send request"}
        </button>
        <p className="text-xs text-ink-2">
          The vendor sees the names and dates of the events you choose, your city, the number of
          guests, your message and any contact details you add. Nothing else about your wedding.
        </p>
      </fieldset>
    </form>
  );
}
