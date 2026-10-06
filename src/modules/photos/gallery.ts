import "server-only";
import { AppError } from "@/lib/errors";
import { signView } from "@/lib/storage";
import { getGalleryByToken, type GalleryAccess } from "@/modules/wedding/service";
import { findPhoto } from "./repository";
import type { AlbumSummary, ConfirmResult, GuestPhoto, UploadFile, UploadSlot } from "./schema";
import { confirmUploads, listAlbums, listPhotos, requestUploads } from "./service";

// What a guest can do with the wedding's gallery link (PRD 5.10, api-design §11). It sits beside
// service.ts, not inside it, because it needs the wedding module to turn a link into a wedding,
// and the wedding module must never depend on photos. The link is the only credential, and it
// reaches exactly one wedding: a guest never learns a member, or who added a photo. (The image
// addresses do contain the storage path, and so the wedding id. That id is not a credential:
// every request is checked against the link, and ids grant nothing.)

export async function openGallery(token: string): Promise<GalleryAccess> {
  const access = await getGalleryByToken(token);
  if (!access) throw new AppError("LINK_INVALID", "This photo link is no longer valid.");
  return access;
}

export async function guestAlbums(access: GalleryAccess): Promise<AlbumSummary[]> {
  // Albums are created on the couple's side as events appear; a guest only reads what exists.
  const albums = await listAlbums(access.weddingId, []);
  return albums.map((a) => ({ ...a, pendingCount: 0 }));
}

export async function guestPhotos(
  access: GalleryAccess,
  albumId: string | undefined,
  page: number,
): Promise<{ items: GuestPhoto[]; total: number; pages: number }> {
  const { items, total, pages } = await listPhotos(
    access.weddingId,
    { ...(albumId ? { albumId } : {}), status: "approved" },
    page,
  );
  return {
    items: items.map((p) => ({
      id: p.id,
      albumName: p.albumName,
      ...(p.thumbUrl ? { thumbUrl: p.thumbUrl } : {}),
      ...(p.displayUrl ? { displayUrl: p.displayUrl } : {}),
      viewable: p.viewable,
    })),
    total,
    pages,
  };
}

function assertOpen(access: GalleryAccess) {
  if (!access.uploadsOn)
    throw new AppError("UPLOADS_CLOSED", "The couple has turned photo uploads off for now.");
}

export async function guestRequestUploads(
  access: GalleryAccess,
  input: { albumId: string; files: UploadFile[]; name?: string | undefined },
): Promise<UploadSlot[]> {
  assertOpen(access);
  return requestUploads(
    access.weddingId,
    { albumId: input.albumId, files: input.files },
    { type: "guest", ...(input.name ? { name: input.name } : {}) },
  );
}

export async function guestConfirmUploads(
  access: GalleryAccess,
  photoIds: string[],
): Promise<ConfirmResult[]> {
  assertOpen(access);
  return confirmUploads(access.weddingId, photoIds, "guest");
}

// A save-as address for an approved photo's original. Waiting photos are not downloadable.
export async function guestDownloadUrl(access: GalleryAccess, photoId: string): Promise<string> {
  const doc = await findPhoto(access.weddingId, photoId);
  if (!doc || doc.status !== "approved")
    throw new AppError("NOT_FOUND", "That photo is not available.");
  return signView(doc.originalKey, { download: doc.fileName, seconds: 5 * 60 });
}
