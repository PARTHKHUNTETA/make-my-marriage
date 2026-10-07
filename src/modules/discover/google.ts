import "server-only";
import { getPlacesApiKey } from "@/lib/env";
import { AppError } from "@/lib/errors";
import type { DiscoverPlace } from "./schema";

const ENDPOINT = "https://places.googleapis.com/v1/places:searchText";
const FIELDS = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.nationalPhoneNumber",
  "places.rating",
  "places.userRatingCount",
  "places.googleMapsUri",
  "places.websiteUri",
].join(",");

type GooglePlace = {
  id?: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  nationalPhoneNumber?: string;
  rating?: number;
  userRatingCount?: number;
  googleMapsUri?: string;
  websiteUri?: string;
};

// Google Places Text Search (New), called from the server so the key never reaches a browser.
// Returns null when no key is set.
export async function searchPlaces(textQuery: string): Promise<DiscoverPlace[] | null> {
  const key = getPlacesApiKey();
  if (!key) return null;
  let res: Response;
  try {
    res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": key,
        "X-Goog-FieldMask": FIELDS,
      },
      body: JSON.stringify({ textQuery, regionCode: "IN", languageCode: "en", pageSize: 12 }),
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    throw new AppError("INTERNAL", "Google could not be reached. Try again in a moment.");
  }
  if (!res.ok) {
    // The body can echo the key's restrictions; log the status only.
    console.error(`Google Places search failed: ${res.status}`);
    throw new AppError("INTERNAL", "Vendor search is not available right now.");
  }
  const body = (await res.json()) as { places?: GooglePlace[] };
  return (body.places ?? []).flatMap((p) =>
    p.id && p.displayName?.text
      ? [
          {
            placeId: p.id,
            name: p.displayName.text,
            address: p.formattedAddress,
            phone: p.nationalPhoneNumber,
            rating: p.rating,
            ratingCount: p.userRatingCount,
            mapsUrl: p.googleMapsUri,
            website: p.websiteUri,
          },
        ]
      : [],
  );
}
