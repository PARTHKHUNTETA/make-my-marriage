import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({}) }));
vi.mock("lucide-react", () => ({ Loader2: () => null }));

import { runSignOut, SIGN_OUT_FAILED } from "./use-sign-out";

const io = (ok: boolean) => ({
  post: vi.fn().mockResolvedValue({ ok }),
  leave: vi.fn(),
  setPending: vi.fn(),
  setError: vi.fn(),
});

describe("runSignOut", () => {
  it("posts to the endpoint, then leaves for the redirect page", async () => {
    const x = io(true);
    await runSignOut("/api/vendor/logout", "/vendor/login", x);
    expect(x.post).toHaveBeenCalledWith("/api/vendor/logout", {});
    expect(x.leave).toHaveBeenCalledWith("/vendor/login");
    expect(x.setPending).toHaveBeenLastCalledWith(true); // stays pending until the page is replaced
    expect(x.setError).toHaveBeenLastCalledWith(null);
  });

  it("says so, and stays on the page, when signing out fails", async () => {
    const x = io(false);
    await runSignOut("/api/auth/logout", "/login", x);
    expect(x.leave).not.toHaveBeenCalled();
    expect(x.setPending).toHaveBeenLastCalledWith(false);
    expect(x.setError).toHaveBeenLastCalledWith(SIGN_OUT_FAILED);
  });
});
