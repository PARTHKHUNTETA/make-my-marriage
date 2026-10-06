// A Google Maps search link for a venue, built from its name and address. Nothing is stored or sent
// to Google until someone taps it.
export function mapsUrl(venueName?: string, address?: string): string | null {
  const place = [venueName, address].filter(Boolean).join(", ");
  return place
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place)}`
    : null;
}
