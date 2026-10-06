import type { Metadata } from "next";
import { PhotosHeader } from "@/components/photos/photos-header";
import { ReviewBoard } from "@/components/photos/review-board";
import { requireMember } from "@/lib/authz";
import { listPendingGroups, PENDING_KEEP_DAYS } from "@/modules/photos/service";

export const metadata: Metadata = { title: "Photos to review — Make My Marriage" };
export const dynamic = "force-dynamic";

export default async function ReviewPage() {
  const ctx = await requireMember();
  const review = await listPendingGroups(ctx.weddingId);
  return (
    <main className="mx-auto w-full max-w-5xl pt-6">
      <PhotosHeader active="review" pending={review.total} />
      <ReviewBoard
        groups={review.groups}
        total={review.total}
        expiring={review.expiring}
        keepDays={PENDING_KEEP_DAYS}
      />
    </main>
  );
}
