// What a theme is: the look of each part of the wedding website, as class names. Every theme fills
// in every slot, and all three render the same sections from the same data, so switching theme
// never loses content (PRD 5.9).
export type SiteTheme = {
  name: string;
  page: string;
  hero: string;
  eyebrow: string;
  names: string;
  ampersand: string;
  dateLine: string;
  cityLine: string;
  ornament: string; // a small decorative mark between sections ("" for none)
  section: string;
  sectionTitle: string;
  body: string;
  card: string;
  cardTitle: string;
  meta: string;
  link: string;
  note: string;
  footer: string;
};
