"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Select } from "@/components/ui/select";
import { SORTS, SORT_LABELS } from "@/modules/marketplace/schema";
import { VENDOR_CATEGORIES, VENDOR_CATEGORY_LABELS } from "@/modules/vendors/schema";

const input =
  "h-9 w-full rounded-lg border border-line-soft/60 bg-white px-3 text-[13px] text-ink outline-none focus:border-plum focus:ring-1 focus:ring-plum";

// Filters live in the URL, so a search can be bookmarked or shared. The city starts as the
// wedding's own city, and any change goes back to page 1.
export function MarketplaceFilters({ defaultCity }: { defaultCity: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [city, setCity] = React.useState(params.get("city") ?? defaultCity);
  const [min, setMin] = React.useState(params.get("minPrice") ?? "");
  const [max, setMax] = React.useState(params.get("maxPrice") ?? "");

  const set = React.useCallback(
    (changes: Record<string, string>) => {
      const next = new URLSearchParams(params.toString());
      for (const [key, value] of Object.entries(changes)) {
        if (value) next.set(key, value);
        else next.delete(key);
      }
      next.delete("page");
      const query = next.toString();
      router.replace(query ? `${pathname}?${query}` : pathname);
    },
    [params, pathname, router],
  );

  // Wait for a pause in typing before searching.
  React.useEffect(() => {
    const current = {
      city: params.get("city") ?? "",
      minPrice: params.get("minPrice") ?? "",
      maxPrice: params.get("maxPrice") ?? "",
    };
    if (
      city === (current.city || defaultCity) &&
      min === current.minPrice &&
      max === current.maxPrice
    )
      return;
    const timer = setTimeout(
      () => set({ city: city.trim(), minPrice: min.trim(), maxPrice: max.trim() }),
      400,
    );
    return () => clearTimeout(timer);
  }, [city, min, max, params, defaultCity, set]);

  return (
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
      <Select
        aria-label="Category"
        value={params.get("category") ?? ""}
        onChange={(e) => set({ category: e.target.value })}
        className="h-9 text-[13px]"
      >
        <option value="">Any category</option>
        {VENDOR_CATEGORIES.map((c) => (
          <option key={c} value={c}>
            {VENDOR_CATEGORY_LABELS[c]}
          </option>
        ))}
      </Select>
      <input
        aria-label="City"
        value={city}
        onChange={(e) => setCity(e.target.value)}
        placeholder="City"
        className={input}
      />
      <input
        aria-label="Lowest price in rupees"
        value={min}
        onChange={(e) => setMin(e.target.value)}
        inputMode="decimal"
        placeholder="Min price ₹"
        className={input}
      />
      <input
        aria-label="Highest price in rupees"
        value={max}
        onChange={(e) => setMax(e.target.value)}
        inputMode="decimal"
        placeholder="Max price ₹"
        className={input}
      />
      <Select
        aria-label="Sort by"
        value={params.get("sort") ?? "rating"}
        onChange={(e) => set({ sort: e.target.value === "rating" ? "" : e.target.value })}
        className="h-9 text-[13px]"
      >
        {SORTS.map((s) => (
          <option key={s} value={s}>
            {SORT_LABELS[s]}
          </option>
        ))}
      </Select>
    </div>
  );
}
