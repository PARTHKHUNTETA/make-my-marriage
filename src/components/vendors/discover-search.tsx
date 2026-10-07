"use client";

import * as React from "react";
import Link from "next/link";
import { ExternalLink, Phone, Star } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { discoverAction } from "@/modules/discover/actions";
import type { DiscoverPlace } from "@/modules/discover/schema";
import { VENDOR_CATEGORIES, VENDOR_CATEGORY_LABELS } from "@/modules/vendors/schema";
import type { VendorCategory } from "@/modules/vendors/schema";

// Where "Add to My vendors" leads: the usual Add vendor form, filled in with what Google showed.
export function addVendorHref(place: DiscoverPlace, category: VendorCategory): string {
  const q = new URLSearchParams({ name: place.name, category });
  if (place.phone) q.set("phone", place.phone);
  if (place.address) q.set("address", place.address);
  return `/vendors/new?${q.toString()}`;
}

export function DiscoverSearch({ defaultCity }: { defaultCity: string }) {
  const [category, setCategory] = React.useState<VendorCategory>("photographer");
  const [city, setCity] = React.useState(defaultCity);
  const [busy, setBusy] = React.useState(false);
  const [problem, setProblem] = React.useState<string | null>(null);
  const [notSetUp, setNotSetUp] = React.useState(false);
  const [places, setPlaces] = React.useState<DiscoverPlace[] | null>(null);
  const [searched, setSearched] = React.useState<VendorCategory>("photographer");

  async function search(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setProblem(null);
    const result = await discoverAction({ category, city });
    setBusy(false);
    if (!result.ok) return setProblem(result.error.message);
    if (!result.data.configured) return setNotSetUp(true);
    setNotSetUp(false);
    setSearched(category);
    setPlaces(result.data.places);
  }

  return (
    <div>
      <form onSubmit={search} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
        <label className="block text-[13px] font-semibold text-ink">
          What are you looking for?
          <Select
            className="mt-1"
            value={category}
            onChange={(e) => setCategory(e.target.value as VendorCategory)}
          >
            {VENDOR_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {VENDOR_CATEGORY_LABELS[c]}
              </option>
            ))}
          </Select>
        </label>
        <label className="block text-[13px] font-semibold text-ink">
          City
          <Input className="mt-1" value={city} onChange={(e) => setCity(e.target.value)} />
        </label>
        <button
          type="submit"
          disabled={busy || city.trim().length < 2}
          className="h-11 self-end rounded-lg bg-plum px-5 text-sm font-semibold text-white hover:bg-plum-hover disabled:opacity-50"
        >
          {busy ? "Searching…" : "Search"}
        </button>
      </form>

      {problem ? (
        <p role="alert" className="mt-4 rounded-lg bg-rose-50 p-3 text-sm text-ink">
          {problem}
        </p>
      ) : null}
      {notSetUp ? (
        <p role="status" className="mt-4 rounded-lg bg-rose-50 p-3 text-sm text-ink">
          Vendor search is not set up yet. You can still browse the marketplace or add a vendor by
          hand.
        </p>
      ) : null}

      {places ? (
        places.length === 0 ? (
          <p className="mt-6 text-sm text-ink-2">Nothing found. Try another city or category.</p>
        ) : (
          <ul className="mt-6 grid gap-3">
            {places.map((p) => (
              <li key={p.placeId} className="rounded-xl bg-white p-4 ring-1 ring-line">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="font-serif text-xl text-plum">{p.name}</h2>
                    {p.address ? <p className="mt-0.5 text-sm text-ink-2">{p.address}</p> : null}
                    <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-ink-2">
                      {p.rating ? (
                        <span className="inline-flex items-center gap-1">
                          <Star className="size-3.5 text-bronze" aria-hidden />
                          {p.rating.toFixed(1)}
                          {p.ratingCount ? ` (${p.ratingCount})` : ""}
                        </span>
                      ) : null}
                      {p.phone ? (
                        <span className="inline-flex items-center gap-1">
                          <Phone className="size-3.5" aria-hidden />
                          {p.phone}
                        </span>
                      ) : null}
                      {p.mapsUrl ? (
                        <a
                          href={p.mapsUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 font-semibold text-bronze hover:underline"
                        >
                          View on Google Maps <ExternalLink className="size-3.5" aria-hidden />
                        </a>
                      ) : null}
                    </p>
                  </div>
                  <Link
                    href={addVendorHref(p, searched)}
                    className="rounded-lg bg-rose-100 px-3 py-2 text-[13px] font-semibold text-ink hover:bg-rose-200"
                  >
                    Add to My vendors
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )
      ) : null}

      {/* Google's terms ask for this wherever their results are shown. */}
      <p className="mt-6 text-xs text-ink-2">
        Results are from Google and shown as they are, not checked by us. Powered by Google.
      </p>
    </div>
  );
}
