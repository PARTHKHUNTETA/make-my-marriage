import { describe, expect, it, vi } from "vitest";
import { guessType, uploadPhotos, type Deps, type SlotRequest } from "./photo-upload";
import type { UploadSlot } from "@/modules/photos/schema";

const file = (name: string, size = 100, type = "image/jpeg") => {
  const f = new File([new Uint8Array(size)], name, { type });
  return f;
};

function deps(over: Partial<Deps> = {}): Deps & { puts: string[] } {
  const puts: string[] = [];
  return {
    puts,
    requestSlots: vi.fn(async (files: SlotRequest[]) =>
      files.map((f: SlotRequest): UploadSlot => ({
        clientKey: f.clientKey,
        photoId: `id-${f.name}`,
        state: "upload",
        contentType: f.type,
        originalUrl: `put://${f.name}/original`,
        ...(f.hasDisplay ? { displayUrl: `put://${f.name}/display` } : {}),
        ...(f.hasThumb ? { thumbUrl: `put://${f.name}/thumb` } : {}),
      })),
    ),
    confirm: vi.fn(async (ids: string[]) => ids.map((photoId) => ({ photoId, ok: true }))),
    put: vi.fn(async (url: string) => {
      puts.push(url);
    }),
    copies: vi.fn(async () => ({ display: new Blob(["d"]), thumb: new Blob(["t"]) })),
    wait: async () => undefined,
    ...over,
  };
}

describe("guessType", () => {
  it("uses the type, then falls back to the name for phones that leave it blank", () => {
    expect(guessType({ name: "a.jpg", type: "image/jpeg" })).toBe("image/jpeg");
    expect(guessType({ name: "IMG_0001.HEIC", type: "" })).toBe("image/heic");
    expect(guessType({ name: "x.webp", type: "" })).toBe("image/webp");
    expect(guessType({ name: "x.gif", type: "image/gif" })).toBeNull();
    expect(guessType({ name: "noextension", type: "" })).toBeNull();
  });
});

describe("uploadPhotos", () => {
  it("sends each file and its copies, then confirms them together", async () => {
    const d = deps();
    const last = vi.fn();
    const out = await uploadPhotos([file("a.jpg"), file("b.jpg")], d, last);
    expect(out.map((o) => o.ok)).toEqual([true, true]);
    expect(d.puts.sort()).toEqual([
      "put://a.jpg/display",
      "put://a.jpg/original",
      "put://a.jpg/thumb",
      "put://b.jpg/display",
      "put://b.jpg/original",
      "put://b.jpg/thumb",
    ]);
    expect(d.confirm).toHaveBeenCalledTimes(1);
    expect(last).toHaveBeenLastCalledWith(
      expect.objectContaining({ total: 2, done: 2, failed: 0 }),
    );
  });

  it("turns away what the server would, before sending anything", async () => {
    const d = deps();
    const out = await uploadPhotos(
      [
        file("a.gif", 10, "image/gif"),
        file("big.jpg", 26 * 1024 * 1024),
        file("empty.jpg", 0),
        file("ok.jpg"),
      ],
      d,
      () => undefined,
    );
    expect(
      out
        .filter((o) => !o.ok)
        .map((o) => o.name)
        .sort(),
    ).toEqual(["a.gif", "big.jpg", "empty.jpg"]);
    expect(d.requestSlots).toHaveBeenCalledTimes(1);
    expect(vi.mocked(d.requestSlots).mock.calls[0]![0]).toHaveLength(1);
  });

  it("retries a dropped connection and still finishes", async () => {
    let calls = 0;
    const d = deps({
      put: vi.fn(async () => {
        calls++;
        if (calls <= 2) throw new Error("Network error");
      }),
      copies: async () => ({}),
    });
    const out = await uploadPhotos([file("a.jpg")], d, () => undefined);
    expect(out).toEqual([{ name: "a.jpg", ok: true }]);
    expect(calls).toBe(3);
  });

  it("gives up on one photo after repeated failures without losing the others", async () => {
    const d = deps({
      put: vi.fn(async (url: string) => {
        if (url.includes("bad")) throw new Error("Network error");
      }),
      copies: async () => ({}),
    });
    const out = await uploadPhotos([file("bad.jpg"), file("good.jpg")], d, () => undefined);
    expect(out.find((o) => o.name === "bad.jpg")).toMatchObject({
      ok: false,
      error: "Network error",
    });
    expect(out.find((o) => o.name === "good.jpg")).toMatchObject({ ok: true });
    expect(d.confirm).toHaveBeenCalledWith(["id-good.jpg"]);
  });

  it("reports a full storage for every file in the batch", async () => {
    const d = deps({
      requestSlots: async () => {
        throw new Error("This wedding's photo storage is full.");
      },
    });
    const out = await uploadPhotos([file("a.jpg"), file("b.jpg")], d, () => undefined);
    expect(out.every((o) => !o.ok && o.error?.includes("storage is full"))).toBe(true);
    expect(d.put).not.toHaveBeenCalled();
  });

  it("does not resend a photo the server already has", async () => {
    const d = deps({
      requestSlots: async (files) =>
        files.map((f) => ({
          clientKey: f.clientKey,
          photoId: "x",
          state: "done",
          contentType: f.type,
        })),
    });
    const out = await uploadPhotos([file("a.jpg")], d, () => undefined);
    expect(out[0]!.ok).toBe(true);
    expect(d.put).not.toHaveBeenCalled();
    expect(d.confirm).not.toHaveBeenCalled();
  });

  it("works in batches of 50", async () => {
    const d = deps({ copies: async () => ({}) });
    const files = Array.from({ length: 120 }, (_, i) => file(`p${i}.jpg`, 10));
    const out = await uploadPhotos(files, d, () => undefined);
    expect(out.filter((o) => o.ok)).toHaveLength(120);
    expect(vi.mocked(d.requestSlots).mock.calls.map((c) => c[0].length)).toEqual([50, 50, 20]);
  });

  it("surfaces a confirmation refusal against the right file", async () => {
    const d = deps({
      confirm: async (ids) =>
        ids.map((photoId) => ({
          photoId,
          ok: photoId !== "id-b.jpg",
          error: "That file is not a photo we can accept",
        })),
      copies: async () => ({}),
    });
    const out = await uploadPhotos([file("a.jpg"), file("b.jpg")], d, () => undefined);
    expect(out.find((o) => o.name === "b.jpg")).toMatchObject({
      ok: false,
      error: "That file is not a photo we can accept",
    });
    expect(out.find((o) => o.name === "a.jpg")?.ok).toBe(true);
  });
});
