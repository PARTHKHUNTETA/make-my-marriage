"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { Select } from "@/components/ui/select";
import { RSVP_LABELS, RSVP_STATUSES } from "@/modules/guests/schema";

// Search and filters live in the URL, so a filtered list can be bookmarked or shared. Changing
// any filter goes back to page 1.
export function GuestFilters({ events }: { events: { id: string; name: string }[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [search, setSearch] = React.useState(params.get("search") ?? "");

  const set = React.useCallback(
    (key: string, value: string) => {
      const next = new URLSearchParams(params.toString());
      if (value) next.set(key, value);
      else next.delete(key);
      next.delete("page");
      const query = next.toString();
      router.replace(query ? `${pathname}?${query}` : pathname);
    },
    [params, pathname, router],
  );

  // Wait for a pause in typing before searching.
  React.useEffect(() => {
    if (search === (params.get("search") ?? "")) return;
    const timer = setTimeout(() => set("search", search.trim()), 350);
    return () => clearTimeout(timer);
  }, [search, params, set]);

  return (
    <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto]">
      <label className="relative">
        <span className="sr-only">Search guests by name or phone</span>
        <Search
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-2"
          aria-hidden
        />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or phone"
          className="h-9 w-full rounded-lg border border-line-soft/60 bg-white pr-3 pl-9 text-[13px] text-ink outline-none focus:border-plum focus:ring-1 focus:ring-plum"
        />
      </label>
      <Select
        aria-label="Filter by event"
        value={params.get("eventId") ?? ""}
        onChange={(e) => set("eventId", e.target.value)}
        className="h-9 text-[13px] sm:w-48"
      >
        <option value="">Any event</option>
        {events.map((e) => (
          <option key={e.id} value={e.id}>
            {e.name}
          </option>
        ))}
      </Select>
      <Select
        aria-label="Filter by reply"
        value={params.get("status") ?? ""}
        onChange={(e) => set("status", e.target.value)}
        className="h-9 text-[13px] sm:w-44"
      >
        <option value="">Any reply</option>
        {RSVP_STATUSES.map((s) => (
          <option key={s} value={s}>
            {RSVP_LABELS[s]}
          </option>
        ))}
      </Select>
    </div>
  );
}
