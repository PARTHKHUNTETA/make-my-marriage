"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, Download, FileSpreadsheet } from "lucide-react";
import { FormAlert } from "@/components/auth/form-alert";
import { parseCsv } from "@/lib/csv-parse";
import { confirmGuestImportAction, previewGuestImportAction } from "@/modules/guests/actions";
import type { ImportSummary, PreviewRow } from "@/modules/guests/import";

type Preview = { rows: PreviewRow[]; summary: ImportSummary };

const MAX_FILE_BYTES = 5 * 1024 * 1024;

// Every cell as plain text: a spreadsheet gives numbers (a phone number, a headcount) and dates.
const asText = (value: unknown) =>
  value === null || value === undefined ? "" : value instanceof Date ? "" : String(value);

async function readTable(file: File): Promise<string[][]> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".xlsx")) {
    // Loaded only when an Excel file is chosen, so the page stays light for everyone else.
    const { readSheet } = await import("read-excel-file/browser");
    const rows = await readSheet(file);
    return rows.map((row) => row.map(asText));
  }
  if (name.endsWith(".csv") || name.endsWith(".txt") || file.type === "text/csv")
    return parseCsv(await file.text());
  throw new Error(
    "Choose a .csv or .xlsx file. An older .xls file can be saved as .xlsx from Excel.",
  );
}

const badge = {
  ok: "bg-forest/15 text-forest",
  duplicate: "bg-honey/25 text-bronze",
  error: "bg-destructive/10 text-destructive",
} as const;
const label = { ok: "Ready", duplicate: "Duplicate phone", error: "Needs fixing" } as const;

export function GuestImport() {
  const router = useRouter();
  const [table, setTable] = React.useState<string[][] | null>(null);
  const [fileName, setFileName] = React.useState("");
  const [preview, setPreview] = React.useState<Preview | null>(null);
  const [includeDuplicates, setIncludeDuplicates] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [problem, setProblem] = React.useState<string | null>(null);
  const [done, setDone] = React.useState<{ imported: number; skipped: number } | null>(null);

  async function choose(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = ""; // so choosing the same file again (after fixing it) works
    if (!file) return;
    setProblem(null);
    setPreview(null);
    setDone(null);
    setTable(null);
    if (file.size > MAX_FILE_BYTES) {
      setProblem("That file is too big. Import up to 1,000 guests from a file under 5 MB.");
      return;
    }
    setBusy(true);
    try {
      const cells = await readTable(file);
      const result = await previewGuestImportAction({ table: cells });
      if (result.ok) {
        setTable(cells);
        setFileName(file.name);
        setPreview(result.data);
        setIncludeDuplicates(false);
      } else setProblem(result.error.message);
    } catch (err) {
      setProblem(
        err instanceof Error && err.message.startsWith("Choose a")
          ? err.message
          : "We couldn't read that file. Check it is a .csv or .xlsx file and try again.",
      );
    }
    setBusy(false);
  }

  async function confirm() {
    if (!table) return;
    setBusy(true);
    setProblem(null);
    const result = await confirmGuestImportAction({ table, includeDuplicates });
    setBusy(false);
    if (result.ok) {
      setDone(result.data);
      setPreview(null);
      setTable(null);
      router.refresh();
    } else setProblem(result.error.message);
  }

  const willImport = preview
    ? preview.summary.ok + (includeDuplicates ? preview.summary.duplicate : 0)
    : 0;

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-xl bg-white p-5 shadow-[0_1px_3px_rgba(35,31,32,0.04)] sm:p-6">
        <ol className="flex list-decimal flex-col gap-1.5 pl-5 text-sm text-ink">
          <li>
            Download the template and fill it in, one row per invited party.{" "}
            {/* A file download, not a page: a plain link is right. */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a
              href="/api/guests/template"
              className="inline-flex items-center gap-1 font-semibold text-bronze hover:underline"
            >
              <Download className="size-3.5" aria-hidden /> Template (CSV)
            </a>
          </li>
          <li>
            In <strong>Invited events</strong>, write the event names exactly as on your Events
            page, separated by semicolons (or write <em>All</em>).
          </li>
          <li>Choose the file. You&rsquo;ll see a preview before anything is added.</li>
        </ol>

        <label className="mt-5 flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-line px-4 py-8 text-center hover:border-plum">
          <FileSpreadsheet className="size-8 text-plum" aria-hidden />
          <span className="text-sm font-semibold text-ink">
            {busy && !preview ? "Reading your file..." : "Choose a .csv or .xlsx file"}
          </span>
          <span className="text-xs text-ink-2">Up to 1,000 guests</span>
          <input
            type="file"
            accept=".csv,.xlsx,text/csv"
            onChange={choose}
            disabled={busy}
            className="sr-only"
          />
        </label>
      </section>

      {problem ? <FormAlert title="Couldn't import">{problem}</FormAlert> : null}

      {done ? (
        <div
          role="status"
          className="flex items-start gap-3 rounded-xl border border-forest/20 bg-forest/10 p-5 text-sm text-forest"
        >
          <CheckCircle2 className="mt-0.5 size-5 shrink-0" aria-hidden />
          <div>
            <p className="font-semibold">
              Added {done.imported} {done.imported === 1 ? "guest" : "guests"}.
            </p>
            {done.skipped > 0 ? (
              <p className="mt-0.5">
                {done.skipped} {done.skipped === 1 ? "row was" : "rows were"} not added.
              </p>
            ) : null}
            <Link href="/guests" className="mt-2 inline-block font-semibold underline">
              Go to the guest list
            </Link>
          </div>
        </div>
      ) : null}

      {preview ? (
        <section aria-label="Preview" className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm">
            <span className="font-semibold text-ink">{fileName}</span>
            <span className="text-forest">{preview.summary.ok} ready</span>
            <span className="text-bronze">{preview.summary.duplicate} duplicate phone</span>
            <span className="text-destructive">{preview.summary.error} need fixing</span>
          </div>

          {preview.summary.error > 0 ? (
            <p className="text-[13px] text-ink-2">
              Rows that need fixing are left out. Fix them in your file and choose it again, or
              import the rest now.
            </p>
          ) : null}

          {preview.summary.duplicate > 0 ? (
            <label className="flex items-start gap-3 text-sm text-ink">
              <input
                type="checkbox"
                checked={includeDuplicates}
                onChange={(e) => setIncludeDuplicates(e.target.checked)}
                className="mt-0.5 size-4 accent-plum"
              />
              <span>
                Also add the {preview.summary.duplicate} rows whose phone number is already used
                <span className="block text-xs text-ink-2">
                  Left unticked, they are skipped so nobody is added twice.
                </span>
              </span>
            </label>
          ) : null}

          <div className="overflow-x-auto rounded-xl bg-white shadow-[0_1px_3px_rgba(35,31,32,0.04)]">
            <table className="w-full min-w-[40rem] text-left text-[13px]">
              <thead className="border-b border-line text-xs text-ink-2">
                <tr>
                  <th className="px-4 py-2.5 font-semibold">Row</th>
                  <th className="px-4 py-2.5 font-semibold">Guest</th>
                  <th className="px-4 py-2.5 font-semibold">Allowed</th>
                  <th className="px-4 py-2.5 font-semibold">Events</th>
                  <th className="px-4 py-2.5 font-semibold">Result</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line align-top">
                {preview.rows.map((row) => (
                  <tr key={row.row}>
                    <td className="px-4 py-2.5 text-ink-2">{row.row}</td>
                    <td className="px-4 py-2.5">
                      <span className="font-semibold text-ink">{row.name || "(no name)"}</span>
                      <span className="block text-ink-2">
                        {[row.phone, row.email].filter(Boolean).join(" · ")}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">{row.guestsAllowed}</td>
                    <td className="px-4 py-2.5 text-ink-2">{row.eventNames.join(", ")}</td>
                    <td className="px-4 py-2.5">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${badge[row.status]}`}
                      >
                        {label[row.status]}
                      </span>
                      {[...row.errors, ...row.warnings].map((message) => (
                        <span key={message} className="mt-1 block text-xs text-ink-2">
                          {message}
                        </span>
                      ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div>
            <button
              type="button"
              onClick={confirm}
              disabled={busy || willImport === 0}
              className="h-11 rounded-lg bg-bronze px-6 text-sm font-semibold text-white hover:bg-bronze/90 disabled:opacity-50"
            >
              {busy ? "Adding..." : `Add ${willImport} ${willImport === 1 ? "guest" : "guests"}`}
            </button>
          </div>
        </section>
      ) : null}
    </div>
  );
}
