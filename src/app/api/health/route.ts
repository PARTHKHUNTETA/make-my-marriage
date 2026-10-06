import { NextResponse } from "next/server";
import { pingDb } from "@/lib/db";
import { ERROR_STATUS, errorEnvelope, okEnvelope } from "@/lib/errors";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { latencyMs } = await pingDb();
    return NextResponse.json(okEnvelope({ db: "up", latencyMs }), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    // Log the error name only: driver messages can include hostnames or URIs.
    console.error("health check failed", err instanceof Error ? err.name : "unknown");
    return NextResponse.json(errorEnvelope("INTERNAL", "Database unavailable"), {
      status: ERROR_STATUS.INTERNAL,
      headers: { "Cache-Control": "no-store" },
    });
  }
}
