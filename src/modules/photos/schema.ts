import { z } from "zod";
import { normalizeImageType, type ImageType } from "@/lib/image-types";

// Zod schemas and types for the photos module (PRD 5.10, api-design §10).

export const MAX_FILE_BYTES = 25 * 1024 * 1024; // each photo, as the PRD sets it
export const MAX_COVER_BYTES = 8 * 1024 * 1024;
export const MAX_COPY_BYTES = 8 * 1024 * 1024; // the 1600 px and 400 px copies are far smaller
export const MAX_FILES_PER_BATCH = 50;
export const PAGE_SIZE = 48;

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, "Not a valid id");

// Chosen by the phone for each file, so one sent twice (a retry after a dropped signal) is
// recognised as the same photo and never saved twice.
const clientKey = z
  .string()
  .min(8, "Missing key")
  .max(64, "Missing key")
  .regex(/^[A-Za-z0-9_-]+$/, "Bad key");

export const uploadFileSchema = z
  .object({
    clientKey,
    name: z.string().trim().max(200).default("photo"),
    type: z.string().transform((t, ctx): ImageType => {
      const type = normalizeImageType(t);
      if (!type) {
        ctx.addIssue({
          code: "custom",
          message: "Only JPEG, PNG, HEIC and WebP photos can be added",
        });
        return z.NEVER;
      }
      return type;
    }),
    size: z
      .number()
      .int()
      .min(1, "That file is empty")
      .max(MAX_FILE_BYTES, "Each photo can be up to 25 MB"),
    // The browser makes a 1600 px and a 400 px copy for fast viewing. A browser that cannot read the
    // format (HEIC on most desktops) sends the original alone.
    hasDisplay: z.boolean().default(false),
    hasThumb: z.boolean().default(false),
    // Their exact sizes in bytes, needed when the copy is sent: the upload address is signed for that
    // size and no other.
    displaySize: z.number().int().min(1).max(MAX_COPY_BYTES).optional(),
    thumbSize: z.number().int().min(1).max(MAX_COPY_BYTES).optional(),
  })
  .superRefine((file, ctx) => {
    if (file.hasDisplay && file.displaySize === undefined)
      ctx.addIssue({ code: "custom", path: ["displaySize"], message: "Missing size" });
    if (file.hasThumb && file.thumbSize === undefined)
      ctx.addIssue({ code: "custom", path: ["thumbSize"], message: "Missing size" });
  });
export type UploadFile = z.infer<typeof uploadFileSchema>;

export const requestUploadsSchema = z.object({
  albumId: objectId,
  files: z
    .array(uploadFileSchema)
    .min(1, "Choose at least one photo")
    .max(MAX_FILES_PER_BATCH, `Add up to ${MAX_FILES_PER_BATCH} photos at a time`),
});
export const confirmUploadsSchema = z.object({
  photoIds: z.array(objectId).min(1).max(MAX_FILES_PER_BATCH),
});
export const photoIdsSchema = z.object({ photoIds: z.array(objectId).min(1).max(200) });
export const movePhotosSchema = z.object({
  photoIds: z.array(objectId).min(1).max(200),
  albumId: objectId,
});
export const photoIdSchema = z.object({ photoId: objectId });
export const listPhotosSchema = z.object({
  albumId: objectId.optional(),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
});

export type AlbumSummary = {
  id: string;
  name: string;
  eventId?: string;
  isGeneral: boolean;
  approvedCount: number;
  pendingCount: number;
};

export type PhotoItem = {
  id: string;
  albumId: string;
  albumName: string;
  fileName: string;
  contentType: ImageType;
  sizeBytes: number;
  uploaderType: "member" | "guest";
  uploaderName?: string;
  status: "pending" | "approved";
  uploadedAt: string;
  // Addresses that expire; a browser cannot show a HEIC without a made copy, so `viewable` says.
  thumbUrl?: string;
  displayUrl?: string;
  viewable: boolean;
};

export type UploadSlot = {
  clientKey: string;
  photoId: string;
  // "done" means this photo was already saved on an earlier try: send nothing.
  state: "upload" | "done";
  contentType: ImageType;
  originalUrl?: string;
  displayUrl?: string;
  thumbUrl?: string;
};

export type ConfirmResult = { photoId: string; ok: boolean; error?: string };
export type Usage = { usedBytes: number; quotaBytes: number };

// What a guest with the gallery link sees of a photo: nothing about who added it.
export type GuestPhoto = {
  id: string;
  albumName: string;
  thumbUrl?: string;
  displayUrl?: string;
  viewable: boolean;
};

export const guestNameSchema = z
  .string()
  .transform((v) =>
    v
      .replace(/[\u0000-\u001f\u007f]/g, " ")
      .replace(/\s+/g, " ")
      .trim(),
  )
  .pipe(z.string().max(60, "That name is too long"))
  .optional()
  .transform((v) => (v ? v : undefined));

export const guestSignSchema = requestUploadsSchema.extend({ name: guestNameSchema });
export const reviewIdsSchema = z.object({ photoIds: z.array(objectId).min(1).max(300) });
export const approveFromSchema = z.object({
  // The uploader's name exactly as listed, or null for guests who gave none.
  uploader: z.string().min(1).max(60).nullable(),
});
export const uploadsSwitchSchema = z.object({ on: z.boolean() });

export const zipPlanSchema = z.object({ albumId: objectId.optional() });
export const zipPartSchema = z.object({
  albumId: objectId.optional(),
  index: z.number().int().min(0).max(1000),
});

export const coverTargetSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("wedding") }),
  z.object({ kind: z.literal("event"), eventId: objectId }),
]);
export const confirmCoverSchema = z.object({ target: coverTargetSchema, coverId: objectId });
export const removeCoverSchema = z.object({ target: coverTargetSchema });
export const requestCoverSchema = z.object({
  target: coverTargetSchema,
  // The picture's exact size in bytes; the upload address is signed for that size.
  size: z.number().int().min(1).max(MAX_COVER_BYTES),
});
