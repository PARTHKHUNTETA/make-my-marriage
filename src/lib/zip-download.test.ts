import { unzipSync } from "fflate";
import { describe, expect, it, vi } from "vitest";
import { buildZip, uniqueNames } from "./zip-download";

const bytes = (s: string) => new TextEncoder().encode(s);

describe("uniqueNames", () => {
  it("keeps distinct names and numbers repeats, case-insensitively, before the extension", () => {
    expect(uniqueNames(["a.jpg", "b.jpg", "a.jpg", "A.JPG", "a.jpg"])).toEqual([
      "a.jpg",
      "b.jpg",
      "a (2).jpg",
      "A (3).JPG",
      "a (4).jpg",
    ]);
    expect(uniqueNames(["noext", "noext"])).toEqual(["noext", "noext (2)"]);
  });
});

describe("buildZip", () => {
  it("makes a real ZIP holding every file, byte for byte, with duplicate names kept apart", async () => {
    const files: Record<string, string> = {
      "u://1": "first photo",
      "u://2": "second",
      "u://3": "third",
    };
    const zip = await buildZip(
      [
        { fileName: "IMG_1.jpg", url: "u://1" },
        { fileName: "IMG_1.jpg", url: "u://2" },
        { fileName: "wedding.jpg", url: "u://3" },
      ],
      async (url) => bytes(files[url]!),
    );
    const out = unzipSync(zip);
    expect(Object.keys(out).sort()).toEqual(["IMG_1 (2).jpg", "IMG_1.jpg", "wedding.jpg"]);
    expect(new TextDecoder().decode(out["IMG_1.jpg"])).toBe("first photo");
    expect(new TextDecoder().decode(out["IMG_1 (2).jpg"])).toBe("second");
    expect(new TextDecoder().decode(out["wedding.jpg"])).toBe("third");
  });

  it("reports progress file by file and handles an empty list", async () => {
    const progress = vi.fn();
    await buildZip(
      [
        { fileName: "a.jpg", url: "x" },
        { fileName: "b.jpg", url: "y" },
      ],
      async () => bytes("z"),
      progress,
    );
    expect(progress.mock.calls).toEqual([
      [1, 2],
      [2, 2],
    ]);
    expect(Object.keys(unzipSync(await buildZip([], async () => bytes("")))).length).toBe(0);
  });

  it("fails if a photo cannot be fetched, rather than giving a ZIP with a hole", async () => {
    await expect(
      buildZip([{ fileName: "a.jpg", url: "x" }], async () => {
        throw new Error("Could not fetch a photo (403)");
      }),
    ).rejects.toThrow("403");
  });
});
