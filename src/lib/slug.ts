// URL slugs for wedding sites: lowercase letters, numbers and hyphens (PRD 5.9).
export const SLUG_MIN = 3;
export const SLUG_MAX = 50;

export function slugify(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // strip accents
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, SLUG_MAX)
    .replace(/-+$/g, "");
}

export function isValidSlug(slug: string): boolean {
  return (
    slug.length >= SLUG_MIN && slug.length <= SLUG_MAX && /^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)
  );
}
