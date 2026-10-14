import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

const anthropic = vi.hoisted(() => ({ anthropicJson: vi.fn() }));
const openai = vi.hoisted(() => ({ openaiJson: vi.fn() }));
vi.mock("./anthropic", () => anthropic);
vi.mock("./openai", () => openai);

import { aiProvider, generateStructured } from "./index";

const schema = z.object({ word: z.string().max(5) });
const request = { system: "s", user: "u", jsonSchema: {}, name: "t" };
const reply = (text: string) => ({ text, model: "m", inputTokens: 10, outputTokens: 5 });

beforeEach(() => {
  anthropic.anthropicJson.mockReset();
  openai.openaiJson.mockReset();
});
afterEach(() => {
  vi.unstubAllEnvs();
});

describe("aiProvider", () => {
  it("is off without a key for the chosen provider", () => {
    vi.stubEnv("AI_PROVIDER", "openai");
    vi.stubEnv("OPENAI_API_KEY", "");
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-ant");
    expect(aiProvider()).toBeNull();
  });
  it("defaults to Claude", () => {
    vi.stubEnv("AI_PROVIDER", "");
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-ant");
    expect(aiProvider()).toBe("anthropic");
  });
  it("is off, not broken, when the provider name is wrong", () => {
    vi.stubEnv("AI_PROVIDER", "gemini");
    expect(aiProvider()).toBeNull();
  });
});

describe("generateStructured", () => {
  beforeEach(() => {
    vi.stubEnv("AI_PROVIDER", "openai");
    vi.stubEnv("OPENAI_API_KEY", "sk-test");
  });
  it("returns a value that passed the schema, from the chosen provider", async () => {
    openai.openaiJson.mockResolvedValue(reply('{"word":"hi"}'));
    const result = await generateStructured(schema, request);
    expect(result).toMatchObject({ value: { word: "hi" }, provider: "openai", inputTokens: 10 });
    expect(anthropic.anthropicJson).not.toHaveBeenCalled();
  });
  it("asks once more, explaining the problem, when the answer does not fit", async () => {
    openai.openaiJson
      .mockResolvedValueOnce(reply('{"word":"far too long"}'))
      .mockResolvedValueOnce(reply('{"word":"ok"}'));
    const result = await generateStructured(schema, request);
    expect(result.value).toEqual({ word: "ok" });
    expect(result.outputTokens).toBe(10);
    expect(openai.openaiJson.mock.calls[1]![0].user).toContain("previous answer was rejected");
  });
  it("gives up after two bad answers", async () => {
    openai.openaiJson.mockResolvedValue(reply("not json"));
    await expect(generateStructured(schema, request)).rejects.toMatchObject({ code: "INTERNAL" });
    expect(openai.openaiJson).toHaveBeenCalledTimes(2);
  });
});
