import "server-only";
import type { z } from "zod";
import { getAiEnv } from "@/lib/env";
import { AppError } from "@/lib/errors";
import { anthropicJson } from "./anthropic";
import { openaiJson } from "./openai";

// One small doorway to a language model: ask for JSON matching a schema, get back a value that has
// passed Zod. The provider (Claude or OpenAI) is chosen by AI_PROVIDER; the rest of the app never
// knows which one answered.

export type AiProvider = "anthropic" | "openai";

export type JsonRequest = {
  system: string;
  user: string;
  // A plain JSON schema the provider can enforce: every property required, no extra properties.
  jsonSchema: Record<string, unknown>;
  // A short name for the output, used by providers that ask for one.
  name: string;
};

export type JsonReply = { text: string; model: string; inputTokens: number; outputTokens: number };

export type AiResult<T> = {
  value: T;
  provider: AiProvider;
  model: string;
  inputTokens: number;
  outputTokens: number;
};

// The provider to use, or null when its key is not set (the feature is then hidden).
export function aiProvider(): AiProvider | null {
  try {
    const env = getAiEnv();
    const key = env.AI_PROVIDER === "openai" ? env.OPENAI_API_KEY : env.ANTHROPIC_API_KEY;
    return key ? env.AI_PROVIDER : null;
  } catch {
    return null; // a bad setting turns the feature off rather than breaking the page
  }
}

function parseReply<T>(schema: z.ZodType<T>, text: string): z.ZodSafeParseResult<T> | null {
  try {
    return schema.safeParse(JSON.parse(text));
  } catch {
    return null;
  }
}

// Asks once, and once more with the problem explained if the answer does not fit the schema.
export async function generateStructured<T>(
  schema: z.ZodType<T>,
  request: JsonRequest,
): Promise<AiResult<T>> {
  const provider = aiProvider();
  if (!provider) throw new AppError("INTERNAL", "AI writing is not set up on this server.");
  const env = getAiEnv();
  const call = provider === "openai" ? openaiJson : anthropicJson;

  let user = request.user;
  let inputTokens = 0;
  let outputTokens = 0;
  for (let attempt = 0; attempt < 2; attempt++) {
    const reply = await call({ ...request, user }, env);
    inputTokens += reply.inputTokens;
    outputTokens += reply.outputTokens;
    const parsed = parseReply(schema, reply.text);
    if (parsed?.success) {
      return { value: parsed.data, provider, model: reply.model, inputTokens, outputTokens };
    }
    const problem = parsed
      ? parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")
      : "the answer was not valid JSON";
    user = `${request.user}\n\nYour previous answer was rejected (${problem}). Answer again, keeping every field within its limits.`;
  }
  throw new AppError("INTERNAL", "The AI's answer didn't fit. Please try again.");
}
