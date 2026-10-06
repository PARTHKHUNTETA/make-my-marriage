"use server";

import { revalidatePath } from "next/cache";
import { safeAction } from "@/lib/action";
import { requireMember } from "@/lib/authz";
import { consumeRateLimit, subjectKey } from "@/lib/ratelimit";
import { listEvents } from "@/modules/events/service";
import {
  confirmUploadsSchema,
  listPhotosSchema,
  movePhotosSchema,
  photoIdSchema,
  photoIdsSchema,
  requestUploadsSchema,
} from "./schema";
import {
  confirmUploads,
  deletePhotos,
  getDownload,
  getUsage,
  listAlbums,
  listPhotos,
  moveToAlbum,
  requestUploads,
} from "./service";

// Server Actions for the member side of photos. The wedding always comes from the session.

const refresh = () => revalidatePath("/photos");

export async function listAlbumsAction() {
  return safeAction(async () => {
    const ctx = await requireMember();
    const events = (await listEvents(ctx.weddingId)).map((e) => ({ id: e.id, name: e.name }));
    return {
      albums: await listAlbums(ctx.weddingId, events),
      usage: await getUsage(ctx.weddingId),
    };
  });
}

export async function listPhotosAction(input: unknown) {
  return safeAction(async () => {
    const ctx = await requireMember();
    const { albumId, page } = listPhotosSchema.parse(input);
    return listPhotos(ctx.weddingId, { ...(albumId ? { albumId } : {}), status: "approved" }, page);
  });
}

export async function requestUploadsAction(input: unknown) {
  return safeAction(async () => {
    const ctx = await requireMember();
    await consumeRateLimit("photo-slots", subjectKey("member", ctx.memberId), {
      limit: 120,
      windowSeconds: 15 * 60,
    });
    const parsed = requestUploadsSchema.parse(input);
    return requestUploads(ctx.weddingId, parsed, { type: "member", memberId: ctx.memberId });
  });
}

// Member photos go live at once: nothing to approve.
export async function confirmUploadsAction(input: unknown) {
  return safeAction(async () => {
    const ctx = await requireMember();
    const { photoIds } = confirmUploadsSchema.parse(input);
    const results = await confirmUploads(ctx.weddingId, photoIds, "approved");
    refresh();
    return { results, usage: await getUsage(ctx.weddingId) };
  });
}

export async function deletePhotosAction(input: unknown) {
  return safeAction(async () => {
    const ctx = await requireMember();
    const { photoIds } = photoIdsSchema.parse(input);
    const removed = await deletePhotos(ctx.weddingId, photoIds);
    refresh();
    return { removed, usage: await getUsage(ctx.weddingId) };
  });
}

export async function movePhotosAction(input: unknown) {
  return safeAction(async () => {
    const ctx = await requireMember();
    const { photoIds, albumId } = movePhotosSchema.parse(input);
    const moved = await moveToAlbum(ctx.weddingId, photoIds, albumId);
    refresh();
    return { moved };
  });
}

export async function getDownloadAction(input: unknown) {
  return safeAction(async () => {
    const ctx = await requireMember();
    const { photoId } = photoIdSchema.parse(input);
    return getDownload(ctx.weddingId, photoId);
  });
}
