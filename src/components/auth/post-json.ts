// Browser-side helper for the auth endpoints: POSTs JSON and returns the api-design envelope,
// turning network failures and non-JSON replies into the same error shape.
export type ApiResult<T> =
  | { ok: true; data: T }
  | {
      ok: false;
      error: { code: string; message: string; details?: Record<string, string[] | undefined> };
    };

export async function postJson<T>(url: string, body: unknown): Promise<ApiResult<T>> {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = (await res.json()) as ApiResult<T>;
    if (typeof json === "object" && json !== null && "ok" in json) return json;
  } catch {
    // fall through to the generic error below
  }
  return {
    ok: false,
    error: { code: "NETWORK", message: "We couldn't reach the server. Please try again." },
  };
}
