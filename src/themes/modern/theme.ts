import type { SiteTheme } from "../types";

// Modern Celebration: bright colours, bold type, a playful layout.
export const modern: SiteTheme = {
  name: "modern",
  page: "min-h-screen bg-[#fff4fb] font-sans text-[#1d1340]",
  hero: "bg-gradient-to-br from-[#ff4fa3] via-[#ff7a45] to-[#ffc23d] px-6 py-20 text-center text-white sm:py-28",
  eyebrow:
    "inline-block rounded-full bg-white/25 px-4 py-1 text-sm font-bold tracking-widest uppercase",
  names:
    "mt-5 text-4xl leading-none font-black tracking-tight break-words uppercase sm:text-6xl lg:text-8xl",
  ampersand: "mx-2 text-[#1d1340]",
  dateLine: "mt-6 text-2xl font-extrabold sm:text-3xl",
  cityLine: "mt-1 text-lg font-semibold",
  ornament: "✦",
  section: "mx-auto max-w-4xl px-6 py-14 text-center",
  sectionTitle: "text-4xl font-black tracking-tight text-[#ff2f8f] uppercase sm:text-5xl",
  body: "mt-5 text-lg font-medium leading-8 whitespace-pre-line",
  card: "rotate-0 rounded-3xl bg-white p-6 text-center shadow-[6px_6px_0_#1d1340] ring-2 ring-[#1d1340] sm:odd:-rotate-1 sm:even:rotate-1",
  cardTitle: "text-2xl font-black uppercase",
  meta: "mt-1 text-base font-semibold text-[#4b3d86]",
  link: "inline-block rounded-full bg-[#1d1340] px-4 py-1.5 text-sm font-bold text-white hover:bg-[#ff2f8f]",
  note: "mt-4 text-sm font-medium text-[#4b3d86]",
  footer:
    "bg-[#1d1340] px-6 py-8 text-center text-sm font-bold tracking-widest text-[#ffc23d] uppercase",
};
