"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Select } from "@/components/ui/select";
import { CATEGORY_LABELS, EXPENSE_CATEGORIES, PAID_BY, PAYER_LABELS } from "@/modules/money/schema";

// Filters live in the URL, so a filtered list can be bookmarked. Changing one goes back to page 1.
export function ExpenseFilters({
  events,
  vendors,
}: {
  events: { id: string; name: string }[];
  vendors: { id: string; name: string }[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  function set(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    next.delete("page");
    const query = next.toString();
    router.replace(query ? `${pathname}?${query}` : pathname);
  }

  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
      <Select
        aria-label="Filter by category"
        value={params.get("category") ?? ""}
        onChange={(e) => set("category", e.target.value)}
        className="h-9 text-[13px]"
      >
        <option value="">Any category</option>
        {EXPENSE_CATEGORIES.map((c) => (
          <option key={c} value={c}>
            {CATEGORY_LABELS[c]}
          </option>
        ))}
      </Select>
      <Select
        aria-label="Filter by event"
        value={params.get("eventId") ?? ""}
        onChange={(e) => set("eventId", e.target.value)}
        className="h-9 text-[13px]"
      >
        <option value="">Any event</option>
        <option value="none">No event</option>
        {events.map((e) => (
          <option key={e.id} value={e.id}>
            {e.name}
          </option>
        ))}
      </Select>
      <Select
        aria-label="Filter by vendor"
        value={params.get("vendorId") ?? ""}
        onChange={(e) => set("vendorId", e.target.value)}
        className="h-9 text-[13px]"
      >
        <option value="">Any vendor</option>
        <option value="none">No vendor</option>
        {vendors.map((v) => (
          <option key={v.id} value={v.id}>
            {v.name}
          </option>
        ))}
      </Select>
      <Select
        aria-label="Filter by who paid"
        value={params.get("paidBy") ?? ""}
        onChange={(e) => set("paidBy", e.target.value)}
        className="h-9 text-[13px]"
      >
        <option value="">Anyone</option>
        {PAID_BY.map((p) => (
          <option key={p} value={p}>
            {PAYER_LABELS[p]}
          </option>
        ))}
      </Select>
    </div>
  );
}
