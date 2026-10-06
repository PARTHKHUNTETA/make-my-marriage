"use client";

import { Printer } from "lucide-react";

export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex items-center gap-2 rounded-lg bg-bronze px-4 py-2 text-sm font-semibold text-white hover:bg-bronze/90"
    >
      <Printer className="size-4" aria-hidden /> Print or save as PDF
    </button>
  );
}
