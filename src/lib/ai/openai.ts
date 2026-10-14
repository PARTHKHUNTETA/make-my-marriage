import "server-only";
import OpenAI from "openai";
import type { AiEnv } from "@/lib/env";
import { AppError } from "@/lib/errors";
import type { JsonReply, JsonRequest } from "./index";

const DEFAULT_MODEL = "gpt-6.1-sol";

// OpenAI with a strict JSON schema response format.
export async function openaiJson(request: JsonRequest, env: AiEnv): Promise<JsonReply> {
  const client = new OpenAI({ apiKey: env.OPENAI_API_KEY });
  try {
    const response = await client.chat.completions.create({
      model: env.AI_MODEL ?? DEFAULT_MODEL,
      max_completion_tokens: 8000,
      response_format: {
        type: "json_schema",
        json_schema: { name: request.name, schema: request.jsonSchema, strict: true },
      },
      messages: [
        { role: "system", content: request.system },
        { role: "user", content: request.user },
      ],
    });
    const choice = response.choices[0];
    if (choice?.message.refusal) {
      throw new AppError(
        "VALIDATION_FAILED",
        "The AI couldn't write that. Try describing it differently.",
      );
    }
    if (choice?.finish_reason === "length") {
      throw new AppError("INTERNAL", "The AI's answer was cut short. Please try again.");
    }
    return {
      text: choice?.message.content ?? "",
      model: response.model,
      inputTokens: response.usage?.prompt_tokens ?? 0,
      outputTokens: response.usage?.completion_tokens ?? 0,
    };
  } catch (err) {
    if (err instanceof AppError) throw err;
    if (err instanceof OpenAI.RateLimitError) {
      throw new AppError("RATE_LIMITED", "The AI is busy right now. Please try again in a minute.");
    }
    if (err instanceof OpenAI.APIError) {
      console.error(`[ai] openai error ${err.status}: ${err.message}`);
      throw new AppError("INTERNAL", "The AI couldn't be reached. Please try again.");
    }
    throw err;
  }
}
