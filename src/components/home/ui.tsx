import { Check } from "lucide-react";

// Sign-up does not exist yet (Phase 1); every "start" call to action scrolls to the closing section.
export const START_HREF = "#start";

export const containerClass = "mx-auto w-full max-w-[1280px] px-4 sm:px-6";

export function Eyebrow({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <p
      className={`text-xs font-semibold tracking-[0.6px] text-bronze uppercase ${className}`.trim()}
    >
      {children}
    </p>
  );
}

export function SectionHeading({
  children,
  className = "",
  size = "md",
}: {
  children: React.ReactNode;
  className?: string;
  size?: "md" | "lg";
}) {
  const sizing =
    size === "lg"
      ? "text-[30px] leading-[36px] tracking-[-0.75px] md:text-[40px] md:leading-[44px] md:tracking-[-1px]"
      : "text-[28px] leading-[36px] tracking-[-0.7px] md:text-4xl md:leading-[44px] md:tracking-[-0.9px]";
  return <h2 className={`font-serif font-normal text-black ${sizing} ${className}`}>{children}</h2>;
}

export function CheckItem({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2 text-sm leading-[22px] text-ink">
      <Check className="mt-[7px] size-3 shrink-0 text-bronze" strokeWidth={2.5} aria-hidden />
      <span>{children}</span>
    </li>
  );
}

export function Pill({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium tracking-[0.33px] whitespace-nowrap ${className}`}
    >
      {children}
    </span>
  );
}

export function MonoTag({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`inline-block rounded-sm bg-rose-100 px-2 py-0.5 font-mono text-xs whitespace-nowrap text-ink-2 ${className}`}
    >
      {children}
    </span>
  );
}

// One alternating feature row: copy on one side, a product preview card on the other.
export function FeatureRow({
  index,
  tag,
  title,
  body,
  bullets,
  visual,
  visualFirst = false,
  extra,
}: {
  index: string;
  tag: string;
  title: React.ReactNode;
  body: string;
  bullets: string[];
  visual: React.ReactNode;
  visualFirst?: boolean;
  extra?: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-1 items-center gap-8 lg:grid-cols-12 lg:gap-10">
      <div
        className={`flex min-w-0 flex-col items-start gap-4 pt-[3px] lg:col-span-5 ${
          visualFirst ? "lg:order-2 lg:col-start-8" : ""
        }`}
      >
        <span className="inline-flex items-center gap-2 rounded-xl bg-rose-100 px-3 py-1 text-[11px] font-semibold tracking-[0.55px] text-ink-2 uppercase">
          <span>{index}</span>
          <span aria-hidden>•</span>
          <span>{tag}</span>
        </span>
        <h3 className="font-serif text-[28px] leading-9 font-normal tracking-[-0.7px] text-black md:text-4xl md:leading-11 md:tracking-[-0.9px]">
          {title}
        </h3>
        <p className="text-base leading-[26px] text-ink-2">{body}</p>
        {extra}
        <ul className="flex flex-col gap-2 pt-2">
          {bullets.map((b) => (
            <CheckItem key={b}>{b}</CheckItem>
          ))}
        </ul>
      </div>
      <div
        className={`min-w-0 lg:col-span-7 ${visualFirst ? "lg:order-1 lg:col-start-1" : "lg:col-start-6"}`}
      >
        {visual}
      </div>
    </div>
  );
}
