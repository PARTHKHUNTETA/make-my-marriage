import { ObjectId } from "mongodb";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const queue = vi.hoisted(() => ({ enqueueEmail: vi.fn(), sendEmailNow: vi.fn() }));
vi.mock("@/lib/queue", () => queue);

// Each test gets a fresh module (the environment is cached on first use). A value of undefined
// removes the variable.
async function load(env: Record<string, string | undefined> = {}) {
  vi.resetModules();
  for (const key of ["RESEND_API_KEY", "EMAIL_FROM"]) vi.stubEnv(key, undefined);
  for (const [key, value] of Object.entries(env)) vi.stubEnv(key, value);
  return import("./email");
}

const mail = {
  to: "priya@example.com",
  subject: "Hello",
  html: "<p>Hi</p>",
  text: "Hi",
  idempotencyKey: "job-1",
};
let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  queue.enqueueEmail.mockReset();
  queue.sendEmailNow.mockReset().mockResolvedValue(undefined);
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("sendEmail via Resend", () => {
  const env = {
    RESEND_API_KEY: "re_test_key_1234567890",
    EMAIL_FROM: "Make My Marriage <hello@mail.example.com>",
  };

  it("posts the message with the key, sender and an idempotency key", async () => {
    fetchMock.mockResolvedValue(new Response("{}", { status: 200 }));
    const { sendEmail } = await load(env);
    await sendEmail(mail);

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://api.resend.com/emails");
    expect(init.method).toBe("POST");
    expect(init.headers).toMatchObject({
      Authorization: "Bearer re_test_key_1234567890",
      "Content-Type": "application/json",
      "Idempotency-Key": "job-1",
    });
    expect(JSON.parse(init.body)).toEqual({
      from: "Make My Marriage <hello@mail.example.com>",
      to: ["priya@example.com"],
      subject: "Hello",
      html: "<p>Hi</p>",
      text: "Hi",
    });
  });

  it.each([429, 500, 502, 503])("treats HTTP %i as worth retrying", async (status) => {
    fetchMock.mockResolvedValue(new Response("{}", { status }));
    const { sendEmail } = await load(env);
    await expect(sendEmail(mail)).rejects.toMatchObject({
      name: "EmailSendError",
      retryable: true,
    });
  });

  it.each([400, 401, 403, 422])("treats HTTP %i as permanent", async (status) => {
    fetchMock.mockResolvedValue(new Response("{}", { status }));
    const { sendEmail } = await load(env);
    await expect(sendEmail(mail)).rejects.toMatchObject({ retryable: false });
  });

  it("treats a network failure as worth retrying", async () => {
    fetchMock.mockRejectedValue(new TypeError("fetch failed"));
    const { sendEmail } = await load(env);
    await expect(sendEmail(mail)).rejects.toMatchObject({ retryable: true });
  });

  it("never puts the recipient, key or provider response into an error", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ message: "bad address priya@example.com" }), { status: 422 }),
    );
    const { sendEmail } = await load(env);
    const err = await sendEmail(mail).catch((e) => e);
    expect(err.message).toBe("Email provider rejected the message (HTTP 422)");
    expect(err.message).not.toContain("priya@example.com");
    expect(err.message).not.toContain("re_test_key");
  });
});

describe("sendEmail without a key", () => {
  it("prints the email to the server log in development", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const { sendEmail } = await load();
    await sendEmail({ ...mail, text: "Open https://app.test/verify-email/TOKEN" });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(log.mock.calls.join("\n")).toContain("https://app.test/verify-email/TOKEN");
    log.mockRestore();
  });

  it("fails loudly in production instead of dropping the email, and the queue will retry", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const { sendEmail } = await load();
    await expect(sendEmail(mail)).rejects.toMatchObject({
      retryable: true,
      message: expect.stringContaining("RESEND_API_KEY"),
    });
    expect(log).not.toHaveBeenCalled(); // no links in production logs
    log.mockRestore();
  });
});

describe("deliverJob", () => {
  it("renders the stored payload and sends it with the job id as idempotency key", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const { deliverJob } = await load();
    const job = {
      _id: new ObjectId(),
      type: "reset",
      toEmail: "priya@example.com",
      payload: { name: "Priya", url: "https://app.test/reset-password/T0K3N" },
    };
    await deliverJob(job as never);
    expect(log.mock.calls.join("\n")).toContain("https://app.test/reset-password/T0K3N");
    log.mockRestore();
  });

  it("rejects a job whose payload is malformed", async () => {
    const { deliverJob } = await load();
    await expect(
      deliverJob({ _id: new ObjectId(), type: "reset", toEmail: "a@b.co", payload: {} } as never),
    ).rejects.toThrow();
  });
});

describe("queueEmail", () => {
  const job = {
    type: "verify",
    toEmail: "priya@example.com",
    payload: { name: "P", url: "https://x.test/y" },
  };

  it("queues the email and makes one immediate attempt", async () => {
    queue.enqueueEmail.mockResolvedValue("abc123");
    const { queueEmail, deliverJob } = await load();
    await queueEmail(job);
    expect(queue.enqueueEmail).toHaveBeenCalledWith(job);
    expect(queue.sendEmailNow).toHaveBeenCalledWith("abc123", deliverJob);
  });

  it("does not fail the caller if the immediate attempt fails (the cron retries it)", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    queue.enqueueEmail.mockResolvedValue("abc123");
    queue.sendEmailNow.mockRejectedValue(new Error("provider down"));
    const { queueEmail } = await load();
    await expect(queueEmail(job)).resolves.toBeUndefined();
    log.mockRestore();
  });

  it("can queue without sending now", async () => {
    queue.enqueueEmail.mockResolvedValue("abc123");
    const { queueEmail } = await load();
    await queueEmail(job, { immediate: false });
    expect(queue.sendEmailNow).not.toHaveBeenCalled();
  });

  it("sends nothing when the queue reports a duplicate", async () => {
    queue.enqueueEmail.mockResolvedValue(null);
    const { queueEmail } = await load();
    await queueEmail(job);
    expect(queue.sendEmailNow).not.toHaveBeenCalled();
  });
});
