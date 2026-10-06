import Image from "next/image";
import {
  Camera,
  Check,
  CircleCheck,
  CloudUpload,
  ScanQrCode,
  Smartphone,
  Wifi,
} from "lucide-react";
import { containerClass, Eyebrow, SectionHeading } from "./ui";

function PreviewHeader({
  icon,
  title,
  tag,
  tagClass,
}: {
  icon: React.ReactNode;
  title: string;
  tag: string;
  tagClass: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-line pb-[17px]">
      <div className="flex items-center gap-2">
        {icon}
        <p className="text-sm leading-5 font-semibold tracking-[-0.07px] text-black">{title}</p>
      </div>
      <span className={`font-mono text-xs leading-4 ${tagClass}`}>{tag}</span>
    </div>
  );
}

function TableTentCard() {
  return (
    <div className="flex flex-col justify-between rounded-2xl border border-line bg-white p-[25px] shadow-hair lg:col-span-4">
      <div className="flex flex-col gap-4">
        <PreviewHeader
          icon={<ScanQrCode className="size-[17px] text-plum" aria-hidden />}
          title="Table Tent Smart QR"
          tag="Print Ready"
          tagClass="font-medium text-bronze"
        />
        <div className="flex flex-col items-center gap-3 rounded-lg border border-line/80 bg-warm px-[21px] pt-[26px] pb-[21px]">
          <span className="rounded-xl bg-honey px-2.5 py-0.5 text-center text-[10px] leading-[15px] font-semibold tracking-[0.5px] text-amber-deep uppercase">
            Scan with iPhone / Android camera
          </span>
          <div className="relative flex size-28 items-center justify-center rounded-lg bg-white p-2.5 ring-2 ring-gold-ring/40">
            <Image src="/images/qr-large.svg" alt="" width={92} height={96} unoptimized />
            <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 rounded-sm bg-plum px-2 py-0.5 font-mono text-[9px] leading-[13.5px] font-medium tracking-[0.225px] whitespace-nowrap text-white">
              TABLE 12
            </span>
          </div>
          <div className="flex w-full flex-col gap-[1.25px] pt-1 text-center">
            <p className="font-serif text-base leading-6 font-medium text-black">Priya & Arjun</p>
            <p className="text-xs leading-[16.5px] text-ink-2">
              Scan to drop candid memories & view Sangeet rundown
            </p>
          </div>
          <div className="flex w-full items-center justify-center gap-3 border-t border-line pt-[9px] text-xs leading-4 text-ink-2">
            <span className="flex items-center gap-1">
              <Wifi className="size-3" aria-hidden /> Taj_Guest_5G
            </span>
            <span aria-hidden className="text-line-soft">
              •
            </span>
            <span>Pass: Udaivilas2025</span>
          </div>
        </div>
      </div>
      <p className="pt-7 text-[13px] leading-[18px] text-ink-2">
        <strong className="font-semibold text-black">One QR for every table:</strong> Guests scan
        with default phone camera, drop full-res videos & photos, and access event WiFi credentials
        without asking anyone.
      </p>
    </div>
  );
}

function RsvpCard() {
  return (
    <div className="flex flex-col justify-between gap-14 rounded-2xl bg-white p-6 shadow-hair lg:col-span-4">
      <div className="flex flex-col gap-4">
        <PreviewHeader
          icon={<Smartphone className="size-[18px] text-plum" aria-hidden />}
          title="Guest RSVP Card"
          tag="Instant Link"
          tagClass="text-ink-2"
        />
        <div className="flex flex-col gap-3.5 rounded-lg bg-blush p-4">
          <div className="flex flex-col gap-0.5 pb-1 text-center">
            <p className="text-[11px] leading-[14px] font-semibold tracking-[0.55px] text-bronze uppercase">
              Welcome
            </p>
            <p className="font-serif text-xl leading-[30px] font-normal text-black">
              Namaste Rohan & Priya
            </p>
            <p className="text-xs leading-[18px] text-ink-2">Kapoor & Sethi Celebration</p>
          </div>
          <div className="flex flex-col gap-2 rounded bg-white p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm leading-5 font-semibold tracking-[-0.07px] text-black">
                Sangeet • Dec 18
              </p>
              <p className="text-[11px] leading-[14px] font-medium tracking-[0.33px] text-bronze">
                Taj Ballroom
              </p>
            </div>
            <div className="flex gap-2 pt-0.5">
              <span className="flex flex-1 items-center justify-center gap-1 rounded-sm bg-plum py-1.5 text-[13px] leading-[18px] font-semibold text-white">
                <Check className="size-2.5" strokeWidth={3} aria-hidden /> Attending
              </span>
              <span className="flex flex-1 items-center justify-center rounded-sm bg-rose-100 py-1.5 text-[13px] leading-[18px] font-semibold text-ink-2">
                Decline
              </span>
            </div>
          </div>
          <div className="flex flex-col gap-1 rounded bg-white p-3">
            <p className="text-[11px] leading-[14px] font-semibold tracking-[0.55px] text-ink-2 uppercase">
              Dietary preference
            </p>
            <div className="flex gap-1">
              {["Jain", "Veg", "Non-Veg"].map((d, i) => (
                <span
                  key={d}
                  className={`flex-1 rounded-sm p-1 text-center text-[11px] leading-[14px] font-medium tracking-[0.33px] ${
                    i === 0 ? "bg-plum text-white" : "bg-rose-100 text-ink-2"
                  }`}
                >
                  {d}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
      <p className="pt-4 text-center text-[13px] leading-[18px] text-ink-2">
        Zero friction. No accounts, no password recovery, no OTP fatigue.
      </p>
    </div>
  );
}

function MemoryDropCard() {
  const files = [
    { name: "Baraat_Dance.HEIC", done: true },
    { name: "Varmala_4K.MOV", done: false },
  ];
  return (
    <div className="flex flex-col justify-between gap-11 rounded-2xl bg-white p-6 shadow-hair lg:col-span-4">
      <div className="flex flex-col gap-4">
        <PreviewHeader
          icon={<Camera className="size-[18px] text-plum" aria-hidden />}
          title="The Live Memory Drop"
          tag="Zero-App"
          tagClass="font-medium text-bronze"
        />
        <div className="flex flex-col items-center gap-3 rounded-lg bg-blush p-5">
          <span className="flex size-12 items-center justify-center rounded-xl bg-honey/50">
            <CloudUpload className="size-[22px] text-plum" aria-hidden />
          </span>
          <div className="flex flex-col gap-0.5 text-center">
            <p className="font-serif text-xl leading-7 font-medium text-black">Camera Roll Drops</p>
            <p className="text-xs leading-[18px] text-ink-2">
              High-res uncompressed photos & raw 4K video clips up to 500MB.
            </p>
          </div>
          <div className="flex w-full flex-col gap-2 py-1">
            {files.map((f) => (
              <div
                key={f.name}
                className="flex items-center justify-between gap-2 rounded bg-white p-2"
              >
                <div className="flex min-w-0 items-center gap-1.5">
                  <CircleCheck
                    className={`size-3.5 shrink-0 ${f.done ? "text-forest" : "text-bronze"}`}
                    aria-hidden
                  />
                  <span className="truncate text-xs leading-[18px] font-medium text-black">
                    {f.name}
                  </span>
                </div>
                {f.done ? (
                  <span className="font-mono text-[10px] leading-[18px] text-forest">Uploaded</span>
                ) : (
                  <span
                    aria-label="68 percent uploaded"
                    className="h-[7.5px] w-[17px] overflow-hidden rounded-full bg-rose-300"
                  >
                    <span className="block h-full w-[68%] rounded-full bg-bronze" />
                  </span>
                )}
              </div>
            ))}
          </div>
          <span className="w-full rounded-sm bg-plum py-2 text-center text-[13px] leading-[18px] font-medium text-white">
            Select Photos from Phone
          </span>
        </div>
      </div>
      <p className="pt-4 text-center text-[13px] leading-[18px] text-ink-2">
        Shared photo streams ready before morning breakfast.
      </p>
    </div>
  );
}

export function GuestExperience() {
  return (
    <section id="guests" className="bg-warm py-24">
      <div className={`${containerClass} flex flex-col gap-14`}>
        <div className="flex max-w-3xl flex-col gap-1.5 pt-1.5">
          <Eyebrow>Guest experience</Eyebrow>
          <SectionHeading size="lg">Your guests just tap a link. No app, no login.</SectionHeading>
          <p className="pt-1.5 text-base leading-[26px] text-ink-2">
            Grandparents, out-of-town cousins, and busy colleagues all have one thing in common:
            they hate downloading new apps. Make My Marriage runs effortlessly in Safari, Chrome,
            and WhatsApp webview.
          </p>
        </div>
        <div className="grid items-start gap-8 lg:grid-cols-12">
          <TableTentCard />
          <RsvpCard />
          <MemoryDropCard />
        </div>
      </div>
    </section>
  );
}
