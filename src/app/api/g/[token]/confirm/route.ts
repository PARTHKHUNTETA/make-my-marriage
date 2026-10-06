import { jsonError, jsonOk, readJsonBody } from "@/lib/http";
import { clientIp, consumeRateLimit, subjectKey } from "@/lib/ratelimit";
import { confirmUploadsSchema } from "@/modules/photos/schema";
import { guestConfirmUploads, openGallery } from "@/modules/photos/gallery";

export const dynamic = "force-dynamic";

// POST /api/g/[token]/confirm: the photos have been sent; check them and put them in the queue for
// the couple's approval. Safe to repeat.
export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    await consumeRateLimit("photo-confirm", subjectKey("ip", clientIp(request.headers)), {
      limit: 120,
      windowSeconds: 15 * 60,
    });
    const { token } = await params;
    const access = await openGallery(token);
    const { photoIds } = confirmUploadsSchema.parse(await readJsonBody(request));
    return jsonOk(await guestConfirmUploads(access, photoIds));
  } catch (err) {
    return jsonError(err);
  }
}
