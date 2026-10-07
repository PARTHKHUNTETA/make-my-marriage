import { beforeEach, describe, expect, it, vi } from "vitest";

const requireMember = vi.hoisted(() => vi.fn());
const service = vi.hoisted(() => ({ saveWebsiteSettings: vi.fn(), saveLiveSettings: vi.fn() }));
const getWedding = vi.hoisted(() => vi.fn());
const revalidatePath = vi.hoisted(() => vi.fn());
vi.mock("@/lib/authz", () => ({ requireMember }));
vi.mock("./service", () => service);
vi.mock("@/modules/wedding/service", () => ({ getWedding }));
vi.mock("next/cache", () => ({ revalidatePath }));

import { saveLiveSettingsAction, saveWebsiteSettingsAction } from "./actions";

const valid = { isOn: true, theme: "modern", slug: "our-day", showLive: false, youtubeUrl: "" };

beforeEach(() => {
  requireMember.mockReset().mockResolvedValue({ kind: "member", weddingId: "w1" });
  service.saveWebsiteSettings.mockReset().mockResolvedValue(undefined);
  service.saveLiveSettings.mockReset().mockResolvedValue(undefined);
  getWedding.mockReset().mockResolvedValue({ website: { slug: "old-address" } });
  revalidatePath.mockReset();
});

describe("saveWebsiteSettingsAction", () => {
  it("saves for the caller's own wedding, whatever the input says", async () => {
    expect(await saveWebsiteSettingsAction({ ...valid, weddingId: "evil" })).toEqual({
      ok: true,
      data: { slug: "our-day" },
    });
    expect(service.saveWebsiteSettings.mock.calls[0]![0]).toBe("w1");
  });
  it("refreshes the old and the new address, so a changed address stops serving the site", async () => {
    await saveWebsiteSettingsAction(valid);
    expect(revalidatePath).toHaveBeenCalledWith("/old-address");
    expect(revalidatePath).toHaveBeenCalledWith("/our-day");
  });
  it("validates first", async () => {
    for (const bad of [
      { slug: "login" },
      { slug: "x" },
      { theme: "gothic" },
      { youtubeUrl: "https://vimeo.com/1" },
    ])
      expect(await saveWebsiteSettingsAction({ ...valid, ...bad })).toMatchObject({
        ok: false,
        error: { code: "VALIDATION_FAILED" },
      });
    expect(service.saveWebsiteSettings).not.toHaveBeenCalled();
  });
  it("needs a signed-in member", async () => {
    const { AppError } = await import("@/lib/errors");
    requireMember.mockRejectedValue(new AppError("UNAUTHENTICATED", "Sign in"));
    expect(await saveWebsiteSettingsAction(valid)).toMatchObject({
      ok: false,
      error: { code: "UNAUTHENTICATED" },
    });
    expect(service.saveWebsiteSettings).not.toHaveBeenCalled();
  });
});

describe("saveLiveSettingsAction", () => {
  const url = "https://www.youtube.com/live/dQw4w9WgXcQ";
  it("changes only the live settings, for the caller's own wedding", async () => {
    expect(
      await saveLiveSettingsAction({
        showLive: true,
        youtubeUrl: url,
        weddingId: "evil",
        slug: "hijack",
        theme: "modern",
      }),
    ).toEqual({
      ok: true,
      data: { showLive: true },
    });
    expect(service.saveLiveSettings).toHaveBeenCalledWith("w1", {
      showLive: true,
      youtubeUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    });
    expect(service.saveWebsiteSettings).not.toHaveBeenCalled();
  });
  it("refreshes the public site and the live page straight away", async () => {
    await saveLiveSettingsAction({ showLive: true, youtubeUrl: url });
    expect(revalidatePath).toHaveBeenCalledWith("/old-address");
    expect(revalidatePath).toHaveBeenCalledWith("/live");
  });
  it("refuses a missing or foreign link, and saves nothing", async () => {
    for (const bad of [
      { showLive: true, youtubeUrl: "" },
      { showLive: true, youtubeUrl: "https://vimeo.com/1" },
      { youtubeUrl: url },
      null,
    ]) {
      expect(await saveLiveSettingsAction(bad)).toMatchObject({
        ok: false,
        error: { code: "VALIDATION_FAILED" },
      });
    }
    expect(service.saveLiveSettings).not.toHaveBeenCalled();
  });
  it("needs a signed-in member", async () => {
    requireMember.mockRejectedValue(Object.assign(new Error("x"), { code: "UNAUTHENTICATED" }));
    expect((await saveLiveSettingsAction({ showLive: false, youtubeUrl: "" })).ok).toBe(false);
    expect(service.saveLiveSettings).not.toHaveBeenCalled();
  });
});
