"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { FormAlert } from "@/components/auth/form-alert";
import { Textarea } from "@/components/ui/textarea";
import { saveWhatsappMessageAction } from "@/modules/guests/actions";
import { DEFAULT_WHATSAPP_MESSAGE, WHATSAPP_MESSAGE_MAX } from "@/modules/guests/whatsapp";

// The one message every "Share on WhatsApp" button uses, e.g. rewritten in Hindi (PRD 5.6).
export function WhatsappMessageForm({ initial }: { initial: string }) {
  const router = useRouter();
  const [value, setValue] = React.useState(initial);
  const [busy, setBusy] = React.useState(false);
  const [notice, setNotice] = React.useState<{ ok: boolean; text: string } | null>(null);

  async function save(message: string) {
    setBusy(true);
    setNotice(null);
    const result = await saveWhatsappMessageAction({ message });
    setBusy(false);
    if (result.ok) {
      setValue(message || DEFAULT_WHATSAPP_MESSAGE);
      setNotice({ ok: true, text: message ? "Saved." : "Back to the standard message." });
      router.refresh();
    } else setNotice({ ok: false, text: result.error.message });
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-[13px] text-ink-2">
        Use <code className="font-mono text-xs">{"{name}"}</code>,{" "}
        <code className="font-mono text-xs">{"{link}"}</code> and{" "}
        <code className="font-mono text-xs">{"{couple}"}</code>; each guest&rsquo;s own details are
        filled in. Keep <code className="font-mono text-xs">{"{link}"}</code> so they can open the
        invitation.
      </p>
      {notice && !notice.ok ? <FormAlert title="Couldn't save">{notice.text}</FormAlert> : null}
      <Textarea
        aria-label="WhatsApp message"
        value={value}
        maxLength={WHATSAPP_MESSAGE_MAX}
        onChange={(e) => setValue(e.target.value)}
        rows={4}
      />
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={busy || !value.includes("{link}")}
          onClick={() => save(value)}
          className="rounded-lg bg-bronze px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"
        >
          {busy ? "Saving..." : "Save message"}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => save("")}
          className="rounded-lg px-3 py-2 text-xs font-semibold text-ink-2 hover:bg-rose-100"
        >
          Use the standard message
        </button>
        {notice?.ok ? (
          <span role="status" className="text-xs font-medium text-forest">
            {notice.text}
          </span>
        ) : null}
        {!value.includes("{link}") ? (
          <span className="text-xs text-destructive">
            Add {"{link}"} so guests get their invitation.
          </span>
        ) : null}
      </div>
    </div>
  );
}
