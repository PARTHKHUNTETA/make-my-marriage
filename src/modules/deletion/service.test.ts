import { beforeEach, describe, expect, it, vi } from "vitest";

const repo = vi.hoisted(() => ({
  softDeleteWedding: vi.fn(),
  findDeletedBefore: vi.fn(),
  listFileKeys: vi.fn(),
  eraseWeddingRows: vi.fn(),
}));
const deleteObjects = vi.hoisted(() => vi.fn());
const getWedding = vi.hoisted(() => vi.fn());
vi.mock("./repository", () => repo);
vi.mock("@/lib/storage", () => ({ deleteObjects }));
vi.mock("@/modules/wedding/service", () => ({ getWedding }));

import { deleteWedding, purgeDeletedWeddings, purgeWedding } from "./service";

beforeEach(() => {
  vi.resetAllMocks();
  getWedding.mockResolvedValue({ title: "Asha weds Dev" });
  repo.softDeleteWedding.mockResolvedValue(true);
  repo.findDeletedBefore.mockResolvedValue([]);
  repo.listFileKeys.mockResolvedValue(["weddings/w/photos/p/original"]);
  repo.eraseWeddingRows.mockResolvedValue({ weddings: 1 });
});

describe("deleteWedding", () => {
  it("needs the title typed, ignoring case and extra spaces", async () => {
    await deleteWedding("w1", "  asha   WEDS dev ");
    expect(repo.softDeleteWedding).toHaveBeenCalledWith("w1", expect.any(Date));
  });

  it("refuses a wrong title without deleting anything", async () => {
    await expect(deleteWedding("w1", "Asha")).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
    expect(repo.softDeleteWedding).not.toHaveBeenCalled();
  });

  it("reports a wedding that is gone or was just deleted", async () => {
    getWedding.mockResolvedValue(null);
    await expect(deleteWedding("w1", "x")).rejects.toMatchObject({ code: "NOT_FOUND" });
    getWedding.mockResolvedValue({ title: "T" });
    repo.softDeleteWedding.mockResolvedValue(false);
    await expect(deleteWedding("w1", "T")).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("purging", () => {
  it("removes the files before the rows, and stops if the files cannot be removed", async () => {
    const order: string[] = [];
    deleteObjects.mockImplementation(async () => void order.push("files"));
    repo.eraseWeddingRows.mockImplementation(async () => void order.push("rows"));
    await purgeWedding("w1");
    expect(order).toEqual(["files", "rows"]);

    deleteObjects.mockRejectedValue(new Error("r2 down"));
    repo.eraseWeddingRows.mockClear();
    await expect(purgeWedding("w1")).rejects.toThrow("r2 down");
    expect(repo.eraseWeddingRows).not.toHaveBeenCalled();
  });

  it("sweeps only weddings deleted more than 7 days ago, and one failure does not stop the rest", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const now = new Date("2027-01-10T00:00:00Z");
    repo.findDeletedBefore.mockResolvedValue(["a", "b"]);
    repo.listFileKeys.mockRejectedValueOnce(new Error("boom"));
    expect(await purgeDeletedWeddings(now)).toEqual({ purged: 1, failed: 1 });
    expect(repo.findDeletedBefore).toHaveBeenCalledWith(new Date("2027-01-03T00:00:00Z"), 50);
  });
});
