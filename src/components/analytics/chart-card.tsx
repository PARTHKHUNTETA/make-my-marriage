"use client";

import * as React from "react";
import { Download } from "lucide-react";
import { toCsv } from "@/lib/csv";
import { formatRupees } from "@/lib/money";
import { chartCsvRows, chartFileName } from "@/modules/analytics/export";
import type { ChartData } from "@/modules/analytics/schema";
import { ChartSvg, isEmpty } from "./chart-svg";

const button =
  "inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-[12px] font-semibold text-ink ring-1 ring-line transition-colors hover:bg-rose-100 disabled:opacity-50";

function save(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

// A chart with its title, a data table for screen readers, and downloads: the picture as a PNG and
// the numbers as a CSV.
export function ChartCard({ data }: { data: ChartData }) {
  const box = React.useRef<HTMLDivElement>(null);
  const [error, setError] = React.useState<string | null>(null);
  const empty = isEmpty(data);

  function downloadCsv() {
    save(
      new Blob([toCsv(chartCsvRows(data))], { type: "text/csv;charset=utf-8" }),
      chartFileName(data, "csv"),
    );
  }

  async function downloadPng() {
    setError(null);
    const svg = box.current?.querySelector("svg");
    if (!svg) return;
    try {
      const xml = new XMLSerializer().serializeToString(svg);
      const img = new Image();
      img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(xml)}`;
      await img.decode();
      const scale = 2;
      const head = 56;
      const canvas = document.createElement("canvas");
      canvas.width = 640 * scale;
      canvas.height = (340 + head) * scale;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("no canvas");
      ctx.scale(scale, scale);
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, 640, 340 + head);
      ctx.fillStyle = "#2d1226";
      ctx.font = "600 18px system-ui, sans-serif";
      ctx.fillText(data.title, 16, 28);
      ctx.fillStyle = "#4e4449";
      ctx.font = "12px system-ui, sans-serif";
      ctx.fillText(data.description, 16, 46, 608);
      ctx.drawImage(img, 0, head, 640, 340);
      const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/png"));
      if (!blob) throw new Error("no image");
      save(blob, chartFileName(data, "png"));
    } catch {
      setError("Couldn't make the picture in this browser. Download the data instead.");
    }
  }

  const cell = (v: number) => (data.unit === "rupees" ? formatRupees(v) : v);
  return (
    <section
      aria-labelledby={`${data.id}-title`}
      className="rounded-xl bg-white p-5 shadow-[0_1px_3px_rgba(35,31,32,0.04)]"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 id={`${data.id}-title`} className="font-serif text-xl text-ink">
            {data.title}
          </h2>
          <p className="text-[13px] text-ink-2">{data.description}</p>
        </div>
        {empty ? null : (
          <div className="flex gap-2">
            <button type="button" onClick={downloadPng} className={button}>
              <Download className="size-3.5" aria-hidden /> PNG
            </button>
            <button type="button" onClick={downloadCsv} className={button}>
              <Download className="size-3.5" aria-hidden /> CSV
            </button>
          </div>
        )}
      </div>
      {empty ? (
        <p className="mt-4 rounded-lg bg-rose-50 p-6 text-center text-[13px] text-ink-2">
          Nothing to show yet. This fills in as you add the details.
        </p>
      ) : (
        <>
          <div ref={box} className="mt-3">
            <ChartSvg data={data} />
          </div>
          <details className="mt-2 text-[12px] text-ink-2">
            <summary className="cursor-pointer font-semibold">View as a table</summary>
            <div className="mt-2 overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr>
                    <th className="py-1 pr-3 font-semibold">
                      {data.kind === "line" ? "Week of" : "Item"}
                    </th>
                    {data.series.map((s) => (
                      <th key={s.name} className="py-1 pr-3 font-semibold">
                        {s.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.labels.map((l, i) => (
                    <tr key={`${l}-${i}`} className="border-t border-line">
                      <td className="py-1 pr-3">{l}</td>
                      {data.series.map((s) => (
                        <td key={s.name} className="py-1 pr-3">
                          {cell(s.values[i] ?? 0)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </>
      )}
      {error ? (
        <p role="alert" className="mt-2 text-[12px] text-destructive">
          {error}
        </p>
      ) : null}
    </section>
  );
}
