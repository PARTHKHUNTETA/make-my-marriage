import Image from "next/image";

export function AuthCard({
  title,
  subtitle,
  children,
  footer,
  wide = false,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  // Longer forms (first-time wedding setup) get a little more room.
  wide?: boolean;
}) {
  return (
    <div
      className={`w-full ${wide ? "max-w-[520px]" : "max-w-[440px]"} rounded-xl border border-line-soft/30 bg-white p-6 shadow-sm sm:p-10`}
    >
      <Image
        src="/images/logo.png"
        alt="Make My Marriage"
        width={320}
        height={64}
        className="mb-4 h-8 w-auto"
        priority
      />
      <h1 className="font-serif text-4xl leading-11 tracking-tight text-plum">{title}</h1>
      <p className="mt-1 mb-4 text-[13px] leading-[18px] text-ink-2">{subtitle}</p>
      {children}
      {footer}
    </div>
  );
}
