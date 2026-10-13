"use client";

import * as React from "react";
import { Camera, Trash2 } from "lucide-react";
import { makeCoverBlob, putBlob } from "@/lib/photo-upload";
import { confirmReceiptAction, requestReceiptUploadAction } from "@/modules/money/actions";

// Sends a photo of a bill to storage for an expense that already exists: the browser shrinks it to
// a JPEG, the server hands out an address, the file goes straight to storage, and the server
// checks it before keeping it. Throws an Error with a message fit to show.
export async function uploadReceipt(expenseId: string, file: File): Promise<void> {
  const blob = await makeCoverBlob(file);
  if (!blob) throw new Error("We couldn't read that photo. Choose a JPEG, PNG or WebP image.");
  const slot = await requestReceiptUploadAction({ expenseId, size: blob.size });
  if (!slot.ok) throw new Error(slot.error.message);
  try {
    await putBlob(slot.data.uploadUrl, blob, "image/jpeg");
  } catch {
    throw new Error("The photo could not be sent. Check your connection and try again.");
  }
  const saved = await confirmReceiptAction({ expenseId, receiptId: slot.data.receiptId });
  if (!saved.ok) throw new Error(saved.error.message);
}

// The "add a photo of the bill" part of the expense form. It only chooses the photo: it is sent
// when the expense is saved. A photo already kept can be seen and removed here.
export function ReceiptPicker({
  file,
  onFile,
  currentUrl,
  onRemoveCurrent,
  removing,
}: {
  file: File | null;
  onFile: (file: File | null) => void;
  currentUrl?: string;
  onRemoveCurrent?: () => void;
  removing?: boolean;
}) {
  const input = React.useRef<HTMLInputElement>(null);
  // A local address for showing the chosen file, released when it changes or the form closes.
  const preview = React.useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  React.useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview],
  );

  const shown = preview ?? currentUrl;
  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-semibold tracking-wide text-ink">
        Photo of the bill or receipt (optional)
      </span>
      {shown ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={shown}
          alt={file ? "The photo you chose" : "The photo kept with this expense"}
          className="max-h-64 w-fit max-w-full rounded-lg border border-line object-contain"
        />
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => input.current?.click()}
          className="inline-flex items-center gap-1.5 rounded-lg bg-rose-100 px-3.5 py-2 text-[13px] font-semibold text-ink hover:bg-rose-200"
        >
          <Camera className="size-4" aria-hidden />
          {shown ? "Choose a different photo" : "Add a photo"}
        </button>
        {file ? (
          <button
            type="button"
            onClick={() => onFile(null)}
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-[13px] font-semibold text-ink-2 hover:bg-rose-100"
          >
            <Trash2 className="size-4" aria-hidden /> Don&apos;t add it
          </button>
        ) : currentUrl && onRemoveCurrent ? (
          <button
            type="button"
            disabled={removing}
            onClick={onRemoveCurrent}
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-[13px] font-semibold text-destructive hover:bg-rose-100 disabled:opacity-50"
          >
            <Trash2 className="size-4" aria-hidden /> {removing ? "Removing…" : "Remove the photo"}
          </button>
        ) : null}
        <input
          ref={input}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          aria-label="Photo of the bill or receipt"
          onChange={(e) => {
            onFile(e.target.files?.[0] ?? null);
            e.target.value = "";
          }}
        />
      </div>
    </div>
  );
}
