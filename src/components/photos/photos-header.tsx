import Link from "next/link";

type Tab = "gallery" | "review" | "share";

// The title and tabs shared by the photo pages. `pending` is how many guest photos wait for a decision.
export function PhotosHeader({ active, pending = 0 }: { active: Tab; pending?: number }) {
  const tab = (key: Tab, href: string, label: string, count?: number) => (
    <Link
      href={href}
      aria-current={active === key ? "page" : undefined}
      className={`rounded-full px-4 py-1.5 text-[13px] font-semibold transition-colors ${
        active === key ? "bg-plum text-white" : "bg-white text-ink-2 hover:bg-rose-200"
      }`}
    >
      {label}
      {count ? (
        <span
          className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[11px] ${active === key ? "bg-white/25" : "bg-bronze text-white"}`}
        >
          {count}
        </span>
      ) : null}
    </Link>
  );
  return (
    <>
      <div>
        <p className="text-xs font-semibold tracking-[0.6px] text-bronze uppercase">Memories</p>
        <h1 className="mt-1 font-serif text-4xl leading-11 tracking-tight text-plum">Photos</h1>
        <p className="mt-1 text-sm text-ink-2">
          {active === "review"
            ? "Photos your guests sent. Nothing is shown to anyone until you approve it."
            : active === "share"
              ? "Let guests see and add photos by scanning a code."
              : "Every photo from your wedding, in one private place."}
        </p>
      </div>
      <nav aria-label="Photos sections" className="mt-5 flex flex-wrap gap-2">
        {tab("gallery", "/photos", "Gallery")}
        {tab("review", "/photos/review", "To review", pending)}
        {tab("share", "/photos/share", "Share and QR")}
      </nav>
    </>
  );
}
