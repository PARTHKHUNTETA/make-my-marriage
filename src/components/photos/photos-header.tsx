import Link from "next/link";

// The title and tabs shared by the photo pages.
export function PhotosHeader({ active }: { active: "gallery" }) {
  const tab = (key: "gallery", href: string, label: string) => (
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
      <div>
        <p className="text-xs font-semibold tracking-[0.6px] text-bronze uppercase">Memories</p>
        <h1 className="mt-1 font-serif text-4xl leading-11 tracking-tight text-plum">Photos</h1>
        <p className="mt-1 text-sm text-ink-2">
          Every photo from your wedding, in one private place.
        </p>
      </div>
      <nav aria-label="Photos sections" className="mt-5 flex flex-wrap gap-2">
        {tab("gallery", "/photos", "Gallery")}
      </nav>
    </>
  );
}
