// A small queue kept on the phone for check-ins made with no signal (PRD 5.14). It lives in the
// browser's localStorage, one list per event, and everything in it is safe to send again: each scan
// carries its own key, and the server records a key only once.
export type QueuedScan = {
  entryToken: string;
  clientKey: string;
  arrivedCount?: number;
  scannedAt: string;
};

const keyFor = (eventId: string) => `mmm-checkin-queue:${eventId}`;

export function readQueue(eventId: string): QueuedScan[] {
  try {
    const raw = window.localStorage.getItem(keyFor(eventId));
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed)
      ? parsed.filter(
          (s): s is QueuedScan =>
            typeof s === "object" &&
            s !== null &&
            typeof (s as QueuedScan).entryToken === "string" &&
            typeof (s as QueuedScan).clientKey === "string",
        )
      : [];
  } catch {
    return [];
  }
}

const CHANGED = "mmm-queue-changed";

// Lets a screen follow the queue as it changes (this tab, or another tab on the same phone).
export function subscribeToQueue(listener: () => void): () => void {
  window.addEventListener(CHANGED, listener);
  window.addEventListener("storage", listener);
  return () => {
    window.removeEventListener(CHANGED, listener);
    window.removeEventListener("storage", listener);
  };
}

export function writeQueue(eventId: string, scans: QueuedScan[]): void {
  try {
    if (scans.length === 0) window.localStorage.removeItem(keyFor(eventId));
    else window.localStorage.setItem(keyFor(eventId), JSON.stringify(scans));
  } catch {
    // Storage can be full or blocked (private browsing); the scan then is not kept, and the screen says so.
  }
  window.dispatchEvent(new Event(CHANGED));
}

export function enqueue(eventId: string, scan: QueuedScan): QueuedScan[] {
  const queue = readQueue(eventId);
  if (!queue.some((s) => s.clientKey === scan.clientKey)) queue.push(scan);
  writeQueue(eventId, queue);
  return queue;
}

// Removes the scans the server has dealt with, keeping any it could not.
export function drop(eventId: string, keys: string[]): QueuedScan[] {
  const gone = new Set(keys);
  const left = readQueue(eventId).filter((s) => !gone.has(s.clientKey));
  writeQueue(eventId, left);
  return left;
}

export function newKey(): string {
  const c = globalThis.crypto;
  if (c?.randomUUID) return c.randomUUID();
  return `k${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
}
