import { NextResponse } from "next/server";
import { localPutBinding, localRead, localWrite, verifyLocalSignature } from "@/lib/storage";

// Development stand-in for R2: serves and accepts the files behind the signed local addresses. It
// does not exist in production, and every request needs a genuine, unexpired signature.
export const dynamic = "force-dynamic";
const MAX_BYTES = 30 * 1024 * 1024;

type Ctx = { params: Promise<{ key: string[] }> };

function refuse() {
  return new NextResponse(null, { status: 404 });
}

export async function PUT(request: Request, { params }: Ctx) {
  if (process.env.NODE_ENV === "production") return refuse();
  const key = (await params).key.join("/");
  const q = new URL(request.url).searchParams;
  const type = q.get("t") ?? "";
  const size = Number(q.get("n"));
  if (
    !Number.isInteger(size) ||
    !verifyLocalSignature(
      "PUT",
      key,
      Number(q.get("e")),
      localPutBinding(type, size),
      q.get("s") ?? "",
    ) ||
    request.headers.get("content-type") !== type
  )
    return new NextResponse(null, { status: 403 });
  // The address was signed for exactly this many bytes, as the real storage enforces.
  if (size > MAX_BYTES) return new NextResponse(null, { status: 413 });
  const bytes = new Uint8Array(await request.arrayBuffer());
  if (bytes.length !== size) return new NextResponse(null, { status: 400 });
  await localWrite(key, bytes);
  return new NextResponse(null, { status: 200 });
}

export async function GET(request: Request, { params }: Ctx) {
  if (process.env.NODE_ENV === "production") return refuse();
  const key = (await params).key.join("/");
  const q = new URL(request.url).searchParams;
  const download = q.get("d") ?? "";
  if (!verifyLocalSignature("GET", key, Number(q.get("e")), download, q.get("s") ?? ""))
    return new NextResponse(null, { status: 403 });
  const bytes = await localRead(key);
  if (!bytes) return refuse();
  // Always served as an opaque download or image, never as a page.
  const headers: Record<string, string> = {
    "Content-Type": "application/octet-stream",
    "X-Content-Type-Options": "nosniff",
    "Cache-Control": "private, max-age=300",
  };
  if (download)
    headers["Content-Disposition"] = `attachment; filename="${download.replace(/"/g, "")}"`;
  else if (
    key.endsWith("/thumb") ||
    key.endsWith("/display") ||
    key.includes("/covers/") ||
    key.startsWith("listings/")
  )
    headers["Content-Type"] = "image/jpeg";
  return new NextResponse(new Uint8Array(bytes), { headers });
}
