import Image from "next/image";
import { Heart } from "lucide-react";

// Right-hand panel from the Figma sign-in design: wedding portrait under a dark gradient, with
// marketing copy only (no real data).
export function SidePanel() {
  return (
    <aside
      aria-hidden
      className="relative hidden flex-col justify-between overflow-hidden bg-black p-12 text-white select-none lg:flex lg:w-5/12 xl:w-1/2"
    >
      <Image
        src="/images/auth-portrait.webp"
        alt=""
        fill
        priority
        sizes="(min-width: 1280px) 50vw, 42vw"
        className="object-cover object-[60%_30%]"
      />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/30 via-black/45 to-black/90" />

      <div className="relative z-10 flex items-center justify-between">
        <span className="flex items-center gap-2 text-xs font-medium tracking-[0.2em] whitespace-nowrap text-white/90 uppercase xl:text-sm">
          <Heart className="size-5 text-honey" />
          Make My Marriage
        </span>
        <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1.5 font-mono text-xs tracking-wider whitespace-nowrap text-honey uppercase backdrop-blur-md">
          Secure Platform
        </span>
      </div>

      <div className="relative z-10 mt-auto flex flex-col pb-10">
        <div className="mb-8 w-12 border-t border-honey/70" />
        <span className="text-sm tracking-[0.3em] text-honey/90 uppercase">
          Wedding Command Center
        </span>
        <h2 className="mt-3 font-serif text-5xl leading-[1.05] tracking-tight text-white xl:text-6xl">
          Your celebration, orchestrated in one calm place
        </h2>
        <p className="mt-6 text-lg text-white">Plan your wedding with calm precision</p>
        <p className="mt-2 text-sm text-white/70">
          Schedules, guest journeys, and intimate milestones in sync
        </p>
      </div>

      <div className="relative z-10 flex items-center justify-between border-t border-white/15 pt-5 font-mono text-xs">
        <span className="tracking-wider text-white/70 uppercase">Encrypted Workspace</span>
        <span className="tracking-wide text-honey">Multi-Event Suite</span>
      </div>
    </aside>
  );
}
