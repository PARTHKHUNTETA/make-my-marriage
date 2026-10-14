"use client";

import * as React from "react";
import { AlertDialog } from "radix-ui";
import { Loader2 } from "lucide-react";

// "Are you sure?" before something that cannot be undone, such as deleting a photo. Wraps the
// button that starts it (the trigger). The dialog stays open while the action runs and closes when
// it is done; if the action fails, the caller shows the problem as usual. Escape or Cancel backs out.
export function ConfirmDialog({
  children,
  title,
  description,
  confirmLabel = "Delete",
  busyLabel = "Deleting…",
  imageUrl,
  onConfirm,
}: {
  children: React.ReactElement;
  title: string;
  description: React.ReactNode;
  confirmLabel?: string;
  busyLabel?: string;
  // A small picture of what is about to be deleted, so it is clear which one it is.
  imageUrl?: string;
  onConfirm: () => Promise<unknown> | void;
}) {
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  async function confirm(event: React.MouseEvent) {
    // Keep the dialog open until the action has finished.
    event.preventDefault();
    setBusy(true);
    try {
      await onConfirm();
    } finally {
      setBusy(false);
      setOpen(false);
    }
  }

  return (
    <AlertDialog.Root open={open} onOpenChange={(next) => !busy && setOpen(next)}>
      <AlertDialog.Trigger asChild>{children}</AlertDialog.Trigger>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 z-[60] bg-black/50 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <AlertDialog.Content className="fixed top-1/2 left-1/2 z-[61] w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-xl bg-white p-5 shadow-xl data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 sm:p-6">
          {imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imageUrl}
              alt=""
              className="mb-4 h-32 w-full rounded-lg bg-rose-50 object-cover"
            />
          ) : null}
          <AlertDialog.Title className="font-serif text-xl text-ink">{title}</AlertDialog.Title>
          <AlertDialog.Description className="mt-1.5 text-sm text-ink-2">
            {description}
          </AlertDialog.Description>
          <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <AlertDialog.Cancel
              disabled={busy}
              className="rounded-lg px-4 py-2 text-sm font-semibold text-ink-2 hover:bg-rose-100 disabled:opacity-50"
            >
              Cancel
            </AlertDialog.Cancel>
            <AlertDialog.Action
              disabled={busy}
              onClick={confirm}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-destructive px-4 py-2 text-sm font-semibold text-white hover:bg-destructive/90 disabled:opacity-70"
            >
              {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
              {busy ? busyLabel : confirmLabel}
            </AlertDialog.Action>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
