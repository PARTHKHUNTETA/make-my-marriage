import { beforeEach, describe, expect, it, vi } from "vitest";

// The queue lives in the browser's storage; this gives it a small stand-in.
function install() {
  const store = new Map<string, string>();
  const listeners = new Map<string, Set<() => void>>();
  vi.stubGlobal("window", {
    localStorage: {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    },
    addEventListener: (type: string, fn: () => void) =>
      void (listeners.get(type) ?? listeners.set(type, new Set()).get(type)!).add(fn),
    removeEventListener: (type: string, fn: () => void) => void listeners.get(type)?.delete(fn),
    dispatchEvent: (event: Event) => {
      listeners.get(event.type)?.forEach((fn) => fn());
      return true;
    },
  });
  return { store, listeners };
}

let q: typeof import("./offline-queue");
beforeEach(async () => {
  install();
  vi.resetModules();
  q = await import("./offline-queue");
});

const scan = (key: string) => ({
  entryToken: `token-${key}-0000`,
  clientKey: key,
  scannedAt: "2027-02-13T19:00:00Z",
});

describe("offline queue", () => {
  it("keeps scans per event, in order, and survives a reload", () => {
    q.enqueue("e1", scan("aaaaaaaa"));
    q.enqueue("e1", scan("bbbbbbbb"));
    q.enqueue("e2", scan("cccccccc"));
    expect(q.readQueue("e1").map((s) => s.clientKey)).toEqual(["aaaaaaaa", "bbbbbbbb"]);
    expect(q.readQueue("e2").map((s) => s.clientKey)).toEqual(["cccccccc"]);
  });
  it("never saves the same scan twice", () => {
    q.enqueue("e1", scan("aaaaaaaa"));
    q.enqueue("e1", scan("aaaaaaaa"));
    expect(q.readQueue("e1")).toHaveLength(1);
  });
  it("removes only what the server dealt with, and keeps the rest to try again", () => {
    for (const k of ["aaaaaaaa", "bbbbbbbb", "cccccccc"]) q.enqueue("e1", scan(k));
    expect(q.drop("e1", ["aaaaaaaa", "cccccccc"]).map((s) => s.clientKey)).toEqual(["bbbbbbbb"]);
    expect(q.drop("e1", ["bbbbbbbb"])).toEqual([]);
    expect(q.readQueue("e1")).toEqual([]);
  });
  it("shrugs off corrupt or foreign data in storage", () => {
    window.localStorage.setItem("mmm-checkin-queue:e1", "{not json");
    expect(q.readQueue("e1")).toEqual([]);
    window.localStorage.setItem(
      "mmm-checkin-queue:e1",
      JSON.stringify([{ nope: 1 }, "x", scan("aaaaaaaa")]),
    );
    expect(q.readQueue("e1").map((s) => s.clientKey)).toEqual(["aaaaaaaa"]);
  });
  it("tells a screen when the queue changes", () => {
    const seen = vi.fn();
    const stop = q.subscribeToQueue(seen);
    q.enqueue("e1", scan("aaaaaaaa"));
    expect(seen).toHaveBeenCalledTimes(1);
    q.drop("e1", ["aaaaaaaa"]);
    expect(seen).toHaveBeenCalledTimes(2);
    stop();
    q.enqueue("e1", scan("bbbbbbbb"));
    expect(seen).toHaveBeenCalledTimes(2);
  });
  it("makes a fresh key for every scan, in the shape the server accepts", () => {
    const keys = new Set(Array.from({ length: 50 }, () => q.newKey()));
    expect(keys.size).toBe(50);
    for (const k of keys) expect(k).toMatch(/^[A-Za-z0-9_-]{8,64}$/);
  });
});
