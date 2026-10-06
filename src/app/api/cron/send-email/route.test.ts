import { beforeEach, describe, expect, it, vi } from "vitest";

const isCronAuthorized = vi.hoisted(() => vi.fn());
const drainEmailQueue = vi.hoisted(() => vi.fn());
vi.mock("@/lib/cron", () => ({ isCronAuthorized }));
vi.mock("@/lib/queue", () => ({ drainEmailQueue }));
vi.mock("@/lib/email", () => ({ deliverJob: vi.fn() }));

import { GET, POST } from "./route";

const req = (method: string) => new Request("http://localhost/api/cron/send-email", { method });

beforeEach(() => {
  isCronAuthorized.mockReset().mockReturnValue(true);
  drainEmailQueue.mockReset().mockResolvedValue({ sent: 2, retried: 1, failed: 0 });
});

describe("/api/cron/send-email", () => {
  it.each([
    ["GET", GET],
    ["POST", POST],
  ])("%s drains the queue and reports the counts", async (method, handler) => {
    const res = await handler(req(method));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, data: { sent: 2, retried: 1, failed: 0 } });
  });

  it.each([
    ["GET", GET],
    ["POST", POST],
  ])("%s without the cron secret answers 401 and does nothing", async (method, handler) => {
    isCronAuthorized.mockReturnValue(false);
    const res = await handler(req(method));
    expect(res.status).toBe(401);
    expect(drainEmailQueue).not.toHaveBeenCalled();
  });

  it("reports an unexpected failure as INTERNAL without details", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    drainEmailQueue.mockRejectedValue(new Error("mongodb+srv://u:SuperSecret@host"));
    const res = await GET(req("GET"));
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain("SuperSecret");
    log.mockRestore();
  });
});
