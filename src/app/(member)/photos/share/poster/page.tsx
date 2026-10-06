import type { Metadata } from "next";
import Link from "next/link";
import { PrintButton } from "@/components/seating/print-button";
import { absoluteUrl } from "@/lib/app-url";
import { requireMember } from "@/lib/authz";
import { formatLongDate } from "@/lib/dates";
import { qrDataUrl } from "@/lib/qr";
import { getGallerySettings, getWedding } from "@/modules/wedding/service";

export const metadata: Metadata = {
  title: "Photo poster — Make My Marriage",
  robots: { index: false },
};
export const dynamic = "force-dynamic";

// A sign for the venue, sized for the paper it is printed on. "Print" then "Save as PDF" in the
// browser's print dialog gives a PDF; the app's own menus are hidden when printing.
export default async function PosterPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const ctx = await requireMember();
  const { size } = await searchParams;
  const a5 = size === "a5";
  const [settings, wedding] = await Promise.all([
    getGallerySettings(ctx.weddingId),
    getWedding(ctx.weddingId),
  ]);
  if (!wedding) return null;
  const link = absoluteUrl(`/g/${settings.token}`);
  const qr = await qrDataUrl(link);

  return (
    <main className="mx-auto max-w-3xl pt-6 print:max-w-none print:pt-0">
      <style>{`@page { size: ${a5 ? "A5" : "A4"}; margin: 0 } @media print { body { background: #fff !important } }`}</style>
      <div className="mb-4 flex items-center justify-between gap-3 print:hidden">
        <Link
          href="/photos/share"
          className="text-[13px] font-semibold text-bronze hover:underline"
        >
          ← Back
        </Link>
        <PrintButton />
      </div>
      {!settings.uploadsOn ? (
        <p
          role="alert"
          className="mb-4 rounded-lg border border-bronze/30 bg-bronze/10 p-3 text-[13px] print:hidden"
        >
          Guest uploads are off right now, so this poster would only let guests look. Switch them on
          on the Share page before printing.
        </p>
      ) : null}
      <div
        className={`mx-auto flex flex-col items-center justify-center bg-plum text-center text-white shadow-lg print:shadow-none ${
          a5 ? "aspect-[148/210] w-[148mm] max-w-full" : "aspect-[210/297] w-[210mm] max-w-full"
        } p-[8%] [print-color-adjust:exact]`}
        style={{ printColorAdjust: "exact", WebkitPrintColorAdjust: "exact" }}
      >
        <p
          className={`font-semibold tracking-[0.25em] text-rose-200 uppercase ${a5 ? "text-[10pt]" : "text-[13pt]"}`}
        >
          {formatLongDate(wedding.date)}
        </p>
        <h1 className={`mt-3 font-serif leading-tight ${a5 ? "text-[26pt]" : "text-[40pt]"}`}>
          {wedding.brideName} &amp; {wedding.groomName}
        </h1>
        <p className={`mt-6 font-serif ${a5 ? "text-[16pt]" : "text-[24pt]"}`}>
          Share your wedding photos
        </p>
        <div className={`mt-5 rounded-2xl bg-white p-[3%] ${a5 ? "w-[60%]" : "w-[62%]"}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qr} alt="QR code to upload your photos" className="block w-full" />
        </div>
        <p className={`mt-5 font-semibold ${a5 ? "text-[14pt]" : "text-[20pt]"}`}>Scan to upload</p>
        <p className={`mt-1 text-rose-200 ${a5 ? "text-[9pt]" : "text-[11pt]"}`}>
          Point your phone camera at the code. No app needed.
        </p>
      </div>
    </main>
  );
}
