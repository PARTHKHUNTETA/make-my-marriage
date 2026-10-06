// YouTube links for the live stream (PRD 5.11): youtube.com/watch, youtube.com/live and youtu.be.
// The link is taken apart and checked, never trusted: only the 11-character video id is kept, and
// the embed address is rebuilt from it, so nothing else a member typed ever reaches the page.
const HOSTS = new Set(["youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be"]);
const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;

export function parseYouTube(
  input: string,
): { videoId: string; watchUrl: string; embedUrl: string } | null {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  if (url.username || url.password) return null;
  const host = url.hostname.toLowerCase();
  if (!HOSTS.has(host)) return null;

  const parts = url.pathname.split("/").filter(Boolean);
  let id: string | undefined;
  if (host === "youtu.be") id = parts[0];
  else if (parts[0] === "watch") id = url.searchParams.get("v") ?? undefined;
  else if (parts[0] === "live") id = parts[1];
  if (!id || !VIDEO_ID.test(id)) return null;

  return {
    videoId: id,
    watchUrl: `https://www.youtube.com/watch?v=${id}`,
    // The privacy-friendly player: no tracking cookies until the guest presses play.
    embedUrl: `https://www.youtube-nocookie.com/embed/${id}`,
  };
}
