import type { SiteTheme } from "../types";

// Classical Indian: reds and golds, ornate serif type, traditional motifs.
export const classical: SiteTheme = {
  name: "classical",
  page: "min-h-screen bg-[#fff7e8] font-serif text-[#4a1c1c]",
  hero: "bg-[#7a1424] px-6 py-20 text-center text-[#f6dfa3] sm:py-28",
  eyebrow: "text-sm tracking-[0.35em] text-[#e2b85a] uppercase",
  names: "mt-4 text-4xl leading-tight font-semibold break-words sm:text-6xl lg:text-7xl",
  ampersand: "mx-3 font-normal text-[#e2b85a] italic",
  dateLine: "mt-6 text-xl tracking-wide sm:text-2xl",
  cityLine: "mt-1 text-base text-[#e2b85a]",
  ornament: "❖",
  section: "mx-auto max-w-3xl px-6 py-14 text-center",
  sectionTitle: "text-3xl font-semibold text-[#7a1424] sm:text-4xl",
  body: "mt-5 text-lg leading-8 whitespace-pre-line",
  card: "rounded-sm border-2 border-[#d9b25f] bg-white/70 p-6 text-center shadow-sm",
  cardTitle: "text-2xl font-semibold text-[#7a1424]",
  meta: "mt-1 text-base text-[#6e3a3a]",
  link: "font-semibold text-[#7a1424] underline decoration-[#d9b25f] underline-offset-4 hover:text-[#4a0b16]",
  note: "mt-4 text-sm text-[#6e3a3a]",
  footer: "bg-[#4a0b16] px-6 py-8 text-center text-sm text-[#e2b85a]",
};
