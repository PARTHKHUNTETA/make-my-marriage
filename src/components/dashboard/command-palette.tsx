"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { CornerDownLeft, Search } from "lucide-react";
import { matchEntries } from "@/lib/command-search";
import { searchAction } from "@/modules/search/actions";
import { KIND_LABELS, MIN_QUERY, type SearchHit, type SearchKind } from "@/modules/search/schema";
import { pagesFor, QUICK_ACTIONS } from "./nav-data";

type Row = { key: string; group: string; label: string; hint?: string; href: string };

const KIND_ORDER: SearchKind[] = ["guest", "event", "task", "vendor", "expense"];
const DEBOUNCE_MS = 250;

// The search box in the top bar (also ⌘K or Ctrl+K). It finds the app's pages and quick actions as
// you type, and, from two letters on, guests, events, tasks, vendors and expenses in this wedding.
// Arrow keys move, Enter opens, Escape closes.
export function CommandPalette({ isAdmin }: { isAdmin: boolean }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [found, setFound] = React.useState<{ query: string; hits: SearchHit[] } | null>(null);
  const [problem, setProblem] = React.useState<string | null>(null);
  const [active, setActive] = React.useState(0);
  const input = React.useRef<HTMLInputElement>(null);
  const opener = React.useRef<HTMLButtonElement>(null);
  const list = React.useRef<HTMLUListElement>(null);
  const latest = React.useRef(0);
  const isMac = React.useSyncExternalStore(
    () => () => undefined,
    () => /Mac|iPhone|iPad/i.test(navigator.userAgent),
    () => true,
  );

  const typed = query.trim();
  const searching = typed.length >= MIN_QUERY;

  const close = React.useCallback(() => {
    setOpen(false);
    setQuery("");
    setFound(null);
    setProblem(null);
    setActive(0);
  }, []);

  // ⌘K / Ctrl+K from anywhere.
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // While open: focus the box, stop the page behind from scrolling.
  React.useEffect(() => {
    if (!open) return;
    input.current?.focus();
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  // Ask the server once typing pauses. A slow answer to an older query is ignored.
  React.useEffect(() => {
    if (!open || !searching) return;
    const id = ++latest.current;
    const timer = setTimeout(async () => {
      const result = await searchAction({ q: typed });
      if (id !== latest.current) return;
      if (result.ok) {
        setFound({ query: typed, hits: result.data });
        setProblem(null);
      } else {
        setFound(null);
        setProblem(result.error.message);
      }
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [open, searching, typed]);

  const hits = React.useMemo(
    () => (searching && found?.query === typed ? found.hits : []),
    [searching, found, typed],
  );
  const waiting = searching && found?.query !== typed && !problem;

  const rows: Row[] = React.useMemo(() => {
    const out: Row[] = [];
    const actions = matchEntries(QUICK_ACTIONS, typed);
    const pages = matchEntries(pagesFor(isAdmin), typed);
    for (const a of actions)
      out.push({
        key: `a-${a.href}-${a.label}`,
        group: "Quick actions",
        label: a.label,
        href: a.href,
      });
    for (const kind of KIND_ORDER)
      for (const h of hits.filter((x) => x.kind === kind))
        out.push({
          key: `${kind}-${h.id}`,
          group: KIND_LABELS[kind],
          label: h.title,
          hint: h.subtitle,
          href: h.href,
        });
    for (const p of pages.slice(0, typed ? 6 : 8))
      out.push({ key: `p-${p.href}`, group: "Go to", label: p.label, href: p.href });
    return out;
  }, [typed, hits, isAdmin]);

  const current = Math.min(active, Math.max(0, rows.length - 1));

  React.useEffect(() => {
    list.current
      ?.querySelector<HTMLElement>(`[data-index="${current}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [current, rows.length]);

  function go(row: Row | undefined) {
    if (!row) return;
    close();
    router.push(row.href);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      close();
      opener.current?.focus();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive(rows.length ? (current + 1) % rows.length : 0);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive(rows.length ? (current - 1 + rows.length) % rows.length : 0);
    } else if (e.key === "Enter") {
      e.preventDefault();
      go(rows[current]);
    }
  }

  // The top bar blurs what is behind it, which would trap anything "fixed" inside it, so the box is
  // drawn inside the app shell instead (still within the person's colour theme).
  const host = open ? (document.getElementById("app-shell") ?? document.body) : null;
  const dialog = host
    ? createPortal(
        <div className="fixed inset-0 z-[70] flex items-start justify-center px-3 pt-[8vh] print:hidden">
          <button
            type="button"
            tabIndex={-1}
            aria-label="Close search"
            onClick={close}
            className="absolute inset-0 bg-ink/40"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Search"
            className="relative flex max-h-[80vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-line"
          >
            <div className="flex items-center gap-3 border-b border-line px-4">
              <Search className="size-5 shrink-0 text-ink-2" aria-hidden />
              <input
                ref={input}
                type="text"
                role="combobox"
                aria-expanded="true"
                aria-controls="search-results"
                aria-activedescendant={rows.length ? `search-row-${current}` : undefined}
                aria-label="Search guests, events, tasks, vendors, expenses and pages"
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setActive(0);
                }}
                onKeyDown={onKeyDown}
                placeholder="Search guests, events, tasks, vendors…"
                className="h-14 min-w-0 flex-1 bg-transparent text-base text-ink outline-none placeholder:text-ink-2/60"
              />
              <kbd className="hidden rounded border border-line px-1.5 py-0.5 font-mono text-[11px] text-ink-2 sm:block">
                Esc
              </kbd>
            </div>
            <ul
              id="search-results"
              ref={list}
              role="listbox"
              aria-label="Results"
              className="min-h-0 flex-1 overflow-y-auto p-2"
            >
              {rows.map((row, i) => (
                <React.Fragment key={row.key}>
                  {i === 0 || rows[i - 1]!.group !== row.group ? (
                    <li
                      role="presentation"
                      className="px-3 pt-3 pb-1 text-[11px] font-semibold tracking-wider text-ink-2/70 uppercase first:pt-1"
                    >
                      {row.group}
                    </li>
                  ) : null}
                  <li
                    id={`search-row-${i}`}
                    data-index={i}
                    role="option"
                    aria-selected={i === current}
                    onMouseMove={() => setActive(i)}
                    onClick={() => go(row)}
                    className={`flex cursor-pointer items-center justify-between gap-3 rounded-lg px-3 py-2.5 ${i === current ? "bg-rose-100" : ""}`}
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-ink">
                        {row.label}
                      </span>
                      {row.hint ? (
                        <span className="block truncate text-xs text-ink-2">{row.hint}</span>
                      ) : null}
                    </span>
                    {i === current ? (
                      <CornerDownLeft className="size-4 shrink-0 text-ink-2" aria-hidden />
                    ) : null}
                  </li>
                </React.Fragment>
              ))}
              {rows.length === 0 && !waiting ? (
                <li role="presentation" className="px-3 py-8 text-center text-sm text-ink-2">
                  Nothing matches &ldquo;{typed}&rdquo;.
                </li>
              ) : null}
            </ul>
            <div
              className="flex items-center justify-between gap-3 border-t border-line px-4 py-2 text-xs text-ink-2"
              aria-live="polite"
            >
              <span>
                {problem ? (
                  <span role="alert" className="text-destructive">
                    {problem}
                  </span>
                ) : waiting ? (
                  "Searching…"
                ) : searching ? (
                  `${hits.length} ${hits.length === 1 ? "match" : "matches"} in your wedding`
                ) : (
                  "Type two letters to search your wedding"
                )}
              </span>
              <span className="hidden sm:block">↑↓ to move · Enter to open</span>
            </div>
          </div>
        </div>,
        host,
      )
    : null;

  return (
    <>
      <button
        ref={opener}
        type="button"
        aria-label="Search"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
        className="flex h-11 items-center gap-2 rounded-xl px-3 text-ink-2 transition-colors hover:bg-rose-100 hover:text-ink sm:h-auto sm:bg-rose-50 sm:px-2 sm:py-1"
      >
        <Search className="size-[18px]" aria-hidden />
        <span className="hidden text-[13px] sm:inline">Search guests, events, tasks…</span>
        <kbd className="ml-2 hidden rounded bg-white px-1 font-mono text-xs text-ink-2/60 sm:inline">
          {isMac ? "⌘K" : "Ctrl K"}
        </kbd>
      </button>
      {dialog}
    </>
  );
}
