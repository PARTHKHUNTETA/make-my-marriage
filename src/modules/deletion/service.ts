import "server-only";
import { AppError } from "@/lib/errors";
import { deleteObjects } from "@/lib/storage";
import { getWedding } from "@/modules/wedding/service";
import { eraseWeddingRows, findDeletedBefore, listFileKeys, softDeleteWedding } from "./repository";
import { PURGE_AFTER_DAYS, sameTitle } from "./schema";

const DAY_MS = 24 * 60 * 60 * 1000;

// The admin's "Delete wedding". The wedding disappears at once, for the couple, the team, guests
// and the public website; its data is erased for good by the daily sweep after PURGE_AFTER_DAYS.
export async function deleteWedding(
  weddingId: string,
  confirmTitle: string,
  now = new Date(),
): Promise<void> {
  const wedding = await getWedding(weddingId);
  if (!wedding) throw new AppError("NOT_FOUND", "We couldn't find your wedding.");
  if (!sameTitle(confirmTitle, wedding.title)) {
    throw new AppError("VALIDATION_FAILED", "That does not match the wedding's title.");
  }
  if (!(await softDeleteWedding(weddingId, now))) {
    throw new AppError("NOT_FOUND", "We couldn't find your wedding.");
  }
}

// Erases one wedding for good: its files first (so a failure leaves the rows, and with them the
// list of files, to try again), then every row, the wedding itself last.
export async function purgeWedding(weddingId: string): Promise<Record<string, number>> {
  await deleteObjects(await listFileKeys(weddingId));
  return eraseWeddingRows(weddingId);
}

// The daily sweep: erases every wedding deleted more than PURGE_AFTER_DAYS ago. One wedding that
// fails does not hold up the others.
export async function purgeDeletedWeddings(
  now = new Date(),
): Promise<{ purged: number; failed: number }> {
  const cutoff = new Date(now.getTime() - PURGE_AFTER_DAYS * DAY_MS);
  let purged = 0;
  let failed = 0;
  for (const id of await findDeletedBefore(cutoff, 50)) {
    try {
      await purgeWedding(id);
      purged++;
    } catch (err) {
      failed++;
      console.error("Wedding erase failed", id, err instanceof Error ? err.message : "unknown");
    }
  }
  return { purged, failed };
}
