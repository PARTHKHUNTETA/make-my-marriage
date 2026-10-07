// "16:00" -> "4:00 PM". Lives here, not with the event schemas, because pages that guests open on
// a phone use it, and a file that also defines zod schemas would bring all of zod along with it.
export function formatTime(value: string): string {
  const [h = "0", m = "00"] = value.split(":");
  const hour = Number(h);
  return `${hour % 12 === 0 ? 12 : hour % 12}:${m} ${hour < 12 ? "AM" : "PM"}`;
}
