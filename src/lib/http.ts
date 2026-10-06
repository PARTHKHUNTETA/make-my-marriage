import "server-only";
import { NextResponse } from "next/server";
import { AppError, okEnvelope } from "@/lib/errors";
import { toFailure } from "@/lib/failure";

const NO_STORE = { "Cache-Control": "no-store" };

export function jsonOk<T>(data: T, status = 200): NextResponse {
  return NextResponse.json(okEnvelope(data), { status, headers: NO_STORE });
}

// Turns anything thrown inside a route handler into the api-design error envelope.
export function jsonError(err: unknown): NextResponse {
  const { status, body } = toFailure(err);
  return NextResponse.json(body, { status, headers: NO_STORE });
}

// Mutating JSON routes insist on application/json. A cross-site <form> cannot send that
// content type without a CORS preflight, which is what blocks login-CSRF (the session cookie
// is also SameSite=Lax).
export async function readJsonBody(request: Request): Promise<unknown> {
  if (!request.headers.get("content-type")?.toLowerCase().includes("application/json")) {
    throw new AppError("VALIDATION_FAILED", "Send the request as JSON.");
  }
  try {
    return await request.json();
  } catch {
    throw new AppError("VALIDATION_FAILED", "The request body is not valid JSON.");
  }
}
