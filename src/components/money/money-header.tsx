import Link from "next/link";

export function MoneyHeader({
  active,
  title,
  blurb,
  action,
}: {
  active: "expenses" | "budget" | "splits";
  title: string;
  blurb: string;
  action?: React.ReactNode;
}) {
  const tab = (key: typeof active, href: string, label: string) => (
    <Link
      href={href}
      aria-current={active === key ? "page" : undefined}
      className={`rounded-full px-4 py-1.5 text-[13px] font-semibold transition-colors ${
        active === key ? "bg-plum text-white" : "bg-white text-ink-2 hover:bg-rose-200"
      }`}
    >
      {label}
    </Link>
  );
  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold tracking-[0.6px] text-bronze uppercase">Money</p>
          <h1 className="mt-1 font-serif text-4xl leading-11 tracking-tight text-plum">{title}</h1>
          <p className="mt-1 text-sm text-ink-2">{blurb}</p>
        </div>
        {action}
      </div>
      <nav aria-label="Money pages" className="mt-5 flex gap-2">
        {tab("expenses", "/money", "Expenses")}
        {tab("budget", "/money/budget", "Budget")}
        {tab("splits", "/money/splits", "Who paid")}
      </nav>
    </>
  );
}
