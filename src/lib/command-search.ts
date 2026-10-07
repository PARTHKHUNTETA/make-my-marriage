// Matching what someone types in the search box against the app's own pages and quick actions.
// Pure, so it is easy to test. Every word typed must appear somewhere in the entry's label or its
// keywords (so "add gu" finds "Add guest"), and entries that start with what was typed come first.

export type Entry = { label: string; keywords?: string; href: string };

const words = (s: string) => s.toLowerCase().split(/\s+/).filter(Boolean);

export function matchEntries<T extends Entry>(entries: readonly T[], query: string): T[] {
  const typed = words(query);
  if (typed.length === 0) return [...entries];
  const scored: { entry: T; score: number; index: number }[] = [];
  entries.forEach((entry, index) => {
    const label = entry.label.toLowerCase();
    const haystack = `${label} ${(entry.keywords ?? "").toLowerCase()}`;
    if (!typed.every((w) => haystack.includes(w))) return;
    // Best: the label starts with the typed words. Next: a word of the label starts with the first
    // typed word. Then: it only appears somewhere (including the keywords).
    const score = label.startsWith(typed.join(" "))
      ? 0
      : label.split(/\s+/).some((l) => l.startsWith(typed[0]!))
        ? 1
        : 2;
    scored.push({ entry, score, index });
  });
  return scored.sort((a, b) => a.score - b.score || a.index - b.index).map((s) => s.entry);
}
