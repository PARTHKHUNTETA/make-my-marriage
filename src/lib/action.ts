import { toFailure } from "@/lib/failure";
import { okEnvelope, type ApiError, type ApiOk } from "@/lib/errors";

export type ActionResult<T> = ApiOk<T> | ApiError;

// Wraps a Server Action body so failures come back as typed values the form can switch on.
export async function safeAction<T>(run: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return okEnvelope(await run());
  } catch (err) {
    return toFailure(err).body;
  }
}
