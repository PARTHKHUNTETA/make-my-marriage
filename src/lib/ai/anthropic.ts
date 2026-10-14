import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import type { AiEnv } from "@/lib/env";
import { AppError } from "@/lib/errors";
import type { JsonReply, JsonRequest } from "./index";

const DEFAULT_MODEL = "claude-opus-5-5";

// Claude with structured outputs: the reply is constrained to the JSON schema. Medium effort gives
// the writing some care without long waits. If Claude's safety checks decline, the server-side
// fallback lets another model answer instead of failing the request.
export async function anthropicJson(request: JsonRequest, env: AiEnv): Promise<JsonReply> {
  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  try {
    const response = await client.beta.messages.create({
      model: env.AI_MODEL ?? DEFAULT_MODEL,
      max_tokens: 8000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: {
        effort: "medium",
        format: { type: "json_schema", schema: request.jsonSchema },
      },
      system: request.system,
      messages: [{ role: "user", content: request.user }],
    });
    if (response.stop_reason === "refusal") {
      throw new AppError(
        "VALIDATION_FAILED",
        "The AI couldn't write that. Try describing it differently.",
      );
    }
    if (response.stop_reason === "max_tokens") {
      throw new AppError("INTERNAL", "The AI's answer was cut short. Please try again.");
    }
    const text = response.content
      .map((block) => (block.type === "text" ? block.text : ""))
      .join("");
    return {
      text,
      model: response.model,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
    };
  } catch (err) {
    if (err instanceof AppError) throw err;
    if (err instanceof Anthropic.RateLimitError) {
      throw new AppError("RATE_LIMITED", "The AI is busy right now. Please try again in a minute.");
    }
    if (err instanceof Anthropic.APIError) {
      console.error(`[ai] anthropic error ${err.status}: ${err.message}`);
      throw new AppError("INTERNAL", "The AI couldn't be reached. Please try again.");
    }
    throw err;
  }
}
