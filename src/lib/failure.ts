import { z } from "zod";
import { AppError, errorEnvelope, type ApiError } from "@/lib/errors";

// One place that turns anything thrown into the api-design error envelope plus its HTTP status.
// Route handlers use the status; Server Actions return just the envelope (Next hides thrown
// error messages in production, so actions report failures as values instead).
// Unknown errors are logged by name only and reported as INTERNAL, never with their message.
export function toFailure(err: unknown): { status: number; body: ApiError } {
  if (err instanceof z.ZodError) {
    return {
      status: 400,
      body: errorEnvelope(
        "VALIDATION_FAILED",
        "Please check the highlighted fields.",
        z.flattenError(err).fieldErrors,
      ),
    };
  }
  if (err instanceof AppError) {
    return { status: err.status, body: errorEnvelope(err.code, err.message, err.details) };
  }
  console.error("unhandled error", err instanceof Error ? err.name : "unknown");
  return {
    status: 500,
    body: errorEnvelope("INTERNAL", "Something went wrong. Please try again."),
  };
}
