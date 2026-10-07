import "server-only";
import { getPlacesApiKey } from "@/lib/env";
import { consumeRateLimit, subjectKey } from "@/lib/ratelimit";
import { searchPlaces } from "./google";
import {
  DISCOVER_DAILY_LIMIT,
  placesQuery,
  type DiscoverInput,
  type DiscoverResult,
} from "./schema";

export async function discoverVendors(
  weddingId: string,
  input: DiscoverInput,
): Promise<DiscoverResult> {
  // Without a key there is nothing to count, so it does not use up a search.
  if (!getPlacesApiKey()) return { configured: false };
  await consumeRateLimit("discover", subjectKey("wedding", weddingId), {
    limit: DISCOVER_DAILY_LIMIT,
    windowSeconds: 24 * 60 * 60,
  });
  const places = await searchPlaces(placesQuery(input));
  return places ? { configured: true, places } : { configured: false };
}
