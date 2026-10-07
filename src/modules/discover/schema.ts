import { z } from "zod";
import { VENDOR_CATEGORIES, VENDOR_CATEGORY_LABELS } from "@/modules/vendors/schema";

// Discover vendors: a search of Google Places for businesses near the wedding (not our marketplace).

export const discoverSchema = z.object({
  category: z.enum(VENDOR_CATEGORIES),
  city: z.string().trim().min(2, "Enter a city").max(80, "That is too long"),
});
export type DiscoverInput = z.output<typeof discoverSchema>;

// One business, as Google describes it. Shown, never stored: Google's terms do not allow keeping
// their data, so a place becomes ours only when the couple adds it to My vendors.
export type DiscoverPlace = {
  placeId: string;
  name: string;
  address?: string;
  phone?: string;
  rating?: number;
  ratingCount?: number;
  mapsUrl?: string;
  website?: string;
};

export type DiscoverResult = { configured: false } | { configured: true; places: DiscoverPlace[] };

// Searches per wedding per day, to keep the Google bill predictable.
export const DISCOVER_DAILY_LIMIT = 30;

export function placesQuery({ category, city }: DiscoverInput): string {
  const label = VENDOR_CATEGORY_LABELS[category].toLowerCase();
  return category === "other" ? `wedding services in ${city}` : `wedding ${label} in ${city}`;
}
