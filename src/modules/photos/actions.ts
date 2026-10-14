"use server";

import { revalidatePath } from "next/cache";
import { safeAction } from "@/lib/action";
import { requirePermission } from "@/lib/authz";
import { consumeRateLimit, subjectKey } from "@/lib/ratelimit";
import { listEvents } from "@/modules/events/service";
import { getWedding, resetGalleryToken, setUploadsOn } from "@/modules/wedding/service";
import { confirmCover, removeCover, requestCoverUpload } from "./covers";
import {
  approveFromSchema,
  confirmCoverSchema,
  removeCoverSchema,
  requestCoverSchema,
  confirmUploadsSchema,
  listPhotosSchema,
  movePhotosSchema,
  photoIdSchema,
  photoIdsSchema,
  requestUploadsSchema,
  reviewIdsSchema,
  uploadsSwitchSchema,
  zipPartSchema,
  zipPlanSchema,
} from "./schema";
import {
  approve,
  approveAllFrom,
  confirmUploads,
  deletePhotos,
  getDownload,
  getZipPart,
  getZipPlan,
  getZipSelection,
  getUsage,
  listAlbums,
  listPhotos,
  moveToAlbum,
  reject,
  requestUploads,
} from "./service";

// Server Actions for the member side of photos. The wedding always comes from the session.

const refresh = () => revalidatePath("/photos");

export async function listAlbumsAction() {
  return safeAction(async () => {
    const ctx = await requirePermission("photo.view");
    const events = (await listEvents(ctx.weddingId)).map((e) => ({ id: e.id, name: e.name }));
    return {
      albums: await listAlbums(ctx.weddingId, events),
      usage: await getUsage(ctx.weddingId),
    };
  });
}

export async function listPhotosAction(input: unknown) {
  return safeAction(async () => {
    const ctx = await requirePermission("photo.view");
    const { albumId, page } = listPhotosSchema.parse(input);
    return listPhotos(ctx.weddingId, { ...(albumId ? { albumId } : {}), status: "approved" }, page);
  });
}

export async function requestUploadsAction(input: unknown) {
  return safeAction(async () => {
    const ctx = await requirePermission("photo.upload");
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
    const ctx = await requirePermission("photo.upload");
    const { photoIds } = confirmUploadsSchema.parse(input);
    const results = await confirmUploads(ctx.weddingId, photoIds, "member");
    refresh();
    return { results, usage: await getUsage(ctx.weddingId) };
  });
}

export async function deletePhotosAction(input: unknown) {
  return safeAction(async () => {
    const ctx = await requirePermission("photo.manage");
    const { photoIds } = photoIdsSchema.parse(input);
    const removed = await deletePhotos(ctx.weddingId, photoIds);
    refresh();
    return { removed, usage: await getUsage(ctx.weddingId) };
  });
}

export async function movePhotosAction(input: unknown) {
  return safeAction(async () => {
    const ctx = await requirePermission("photo.manage");
    const { photoIds, albumId } = movePhotosSchema.parse(input);
    const moved = await moveToAlbum(ctx.weddingId, photoIds, albumId);
    refresh();
    return { moved };
  });
}

export async function getDownloadAction(input: unknown) {
  return safeAction(async () => {
    const ctx = await requirePermission("photo.view");
    const { photoId } = photoIdSchema.parse(input);
    return getDownload(ctx.weddingId, photoId);
  });
}

// ---- moderation and sharing -------------------------------------------------------------------

const refreshReview = () => {
  revalidatePath("/photos");
  revalidatePath("/photos/review");
  revalidatePath("/dashboard");
};

export async function approvePhotosAction(input: unknown) {
  return safeAction(async () => {
    const ctx = await requirePermission("photo.manage");
    const { photoIds } = reviewIdsSchema.parse(input);
    const approved = await approve(ctx.weddingId, photoIds);
    refreshReview();
    return { approved };
  });
}

export async function approveFromUploaderAction(input: unknown) {
  return safeAction(async () => {
    const ctx = await requirePermission("photo.manage");
    const { uploader } = approveFromSchema.parse(input);
    const approved = await approveAllFrom(ctx.weddingId, uploader);
    refreshReview();
    return { approved };
  });
}

// Rejecting deletes the photos and their files for good.
export async function rejectPhotosAction(input: unknown) {
  return safeAction(async () => {
    const ctx = await requirePermission("photo.manage");
    const { photoIds } = reviewIdsSchema.parse(input);
    const rejected = await reject(ctx.weddingId, photoIds);
    refreshReview();
    return { rejected, usage: await getUsage(ctx.weddingId) };
  });
}

export async function setUploadsAction(input: unknown) {
  return safeAction(async () => {
    const ctx = await requirePermission("gallery.share");
    const { on } = uploadsSwitchSchema.parse(input);
    await setUploadsOn(ctx.weddingId, on);
    revalidatePath("/photos/share");
    return { on };
  });
}

// A new link. Every printed or shared copy of the old one stops working.
export async function resetGalleryLinkAction() {
  return safeAction(async () => {
    const ctx = await requirePermission("gallery.reset_link");
    await resetGalleryToken(ctx.weddingId);
    // The public website may show the old link; refresh it right away.
    const wedding = await getWedding(ctx.weddingId);
    if (wedding) revalidatePath(`/${wedding.website.slug}`);
    revalidatePath("/photos/share");
    return { reset: true };
  });
}

// ---- ZIP downloads ----------------------------------------------------------------------------

export async function getZipPlanAction(input: unknown) {
  return safeAction(async () => {
    const ctx = await requirePermission("photo.view");
    const { albumId } = zipPlanSchema.parse(input);
    return getZipPlan(ctx.weddingId, albumId);
  });
}

export async function getZipPartAction(input: unknown) {
  return safeAction(async () => {
    const ctx = await requirePermission("photo.view");
    const { albumId, index } = zipPartSchema.parse(input);
    return getZipPart(ctx.weddingId, albumId, index);
  });
}

export async function getZipSelectionAction(input: unknown) {
  return safeAction(async () => {
    const ctx = await requirePermission("photo.view");
    const { photoIds } = photoIdsSchema.parse(input);
    return getZipSelection(ctx.weddingId, photoIds);
  });
}

// ---- cover pictures ---------------------------------------------------------------------------

// A cover shows on the dashboard, the website and the event cards.
const refreshCovers = () => {
  revalidatePath("/dashboard");
  revalidatePath("/events");
  revalidatePath("/settings/wedding");
  revalidatePath("/", "layout");
};

// The wedding's cover is part of the wedding's details; an event's cover is part of the event.
const coverPermission = (target: { kind: "wedding" | "event" }) =>
  target.kind === "event" ? ("event.edit" as const) : ("wedding.update" as const);

export async function requestCoverUploadAction(input: unknown) {
  return safeAction(async () => {
    const { target, size } = requestCoverSchema.parse(input);
    const ctx = await requirePermission(coverPermission(target));
    await consumeRateLimit("cover-slots", subjectKey("member", ctx.memberId), {
      limit: 40,
      windowSeconds: 15 * 60,
    });
    return requestCoverUpload(ctx.weddingId, target, size);
  });
}

export async function confirmCoverAction(input: unknown) {
  return safeAction(async () => {
    const { target, coverId } = confirmCoverSchema.parse(input);
    const ctx = await requirePermission(coverPermission(target));
    await confirmCover(ctx.weddingId, target, coverId);
    refreshCovers();
    return { saved: true };
  });
}

export async function removeCoverAction(input: unknown) {
  return safeAction(async () => {
    const { target } = removeCoverSchema.parse(input);
    const ctx = await requirePermission(coverPermission(target));
    await removeCover(ctx.weddingId, target);
    refreshCovers();
    return { removed: true };
  });
}
