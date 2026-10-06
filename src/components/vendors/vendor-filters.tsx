"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Select } from "@/components/ui/select";
import { VENDOR_CATEGORIES, VENDOR_CATEGORY_LABELS } from "@/modules/vendors/schema";

export function VendorFilters({ events }: { events: { id: string; name: string }[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  function set(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    const query = next.toString();
    router.replace(query ? `${pathname}?${query}` : pathname);
  }

  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      <Select
        aria-label="Filter by category"
        value={params.get("category") ?? ""}
        onChange={(e) => set("category", e.target.value)}
        className="h-9 text-[13px]"
      >
        <option value="">Any category</option>
        {VENDOR_CATEGORIES.map((c) => (
          <option key={c} value={c}>
            {VENDOR_CATEGORY_LABELS[c]}
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
        {events.map((e) => (
          <option key={e.id} value={e.id}>
            {e.name}
          </option>
        ))}
      </Select>
    </div>
  );
}
