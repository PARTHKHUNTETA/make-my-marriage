import type { SiteTheme } from "../types";

// Minimal Elegant: soft neutrals, generous white space, refined type.
export const minimal: SiteTheme = {
  name: "minimal",
  page: "min-h-screen bg-[#faf8f5] font-sans text-[#2b2a28]",
  hero: "px-6 py-28 text-center sm:py-40",
  eyebrow: "text-xs tracking-[0.4em] text-[#8a857d] uppercase",
  names:
    "mt-6 font-serif text-4xl leading-tight font-light tracking-tight break-words sm:text-6xl lg:text-7xl",
  ampersand: "mx-3 font-serif font-light text-[#a39e95] italic",
  dateLine: "mt-8 text-base tracking-[0.2em] text-[#5c5851] uppercase",
  cityLine: "mt-2 text-sm text-[#8a857d]",
  ornament: "",
  section: "mx-auto max-w-2xl border-t border-[#e6e1d8] px-6 py-16 text-center",
  sectionTitle: "font-serif text-3xl font-light tracking-tight",
  body: "mt-6 text-base leading-8 text-[#4a4741] whitespace-pre-line",
  card: "border-b border-[#e6e1d8] py-6 text-center",
  cardTitle: "font-serif text-2xl font-light",
  meta: "mt-1 text-sm text-[#6b665e]",
  link: "text-sm tracking-wide text-[#2b2a28] underline underline-offset-4 hover:text-[#8a857d]",
  note: "mt-4 text-xs text-[#8a857d]",
  footer: "px-6 py-10 text-center text-xs tracking-widest text-[#a39e95] uppercase",
};
