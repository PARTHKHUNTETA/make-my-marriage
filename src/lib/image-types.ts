// Telling what a file really is from its first bytes, not from the name or type the sender
// claimed. Used before a photo is accepted, so a guest cannot upload a script or a program and have
// it stored and served as a "photo" (PRD 5.10: JPEG, PNG, HEIC and WebP only).
export type ImageType = "image/jpeg" | "image/png" | "image/webp" | "image/heic";

export const ACCEPTED_IMAGE_TYPES: readonly ImageType[] = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
];

// Phones send HEIF and HEIC under several names.
const ALIASES: Record<string, ImageType> = {
  "image/jpg": "image/jpeg",
  "image/pjpeg": "image/jpeg",
  "image/heif": "image/heic",
  "image/heic-sequence": "image/heic",
  "image/heif-sequence": "image/heic",
};

export function normalizeImageType(type: string): ImageType | null {
  const t = type.trim().toLowerCase();
  const mapped = ALIASES[t] ?? t;
  return (ACCEPTED_IMAGE_TYPES as readonly string[]).includes(mapped)
    ? (mapped as ImageType)
    : null;
}

const ascii = (bytes: Uint8Array, from: number, to: number) =>
  String.fromCharCode(...bytes.subarray(from, to));
const HEIF_BRANDS = new Set([
  "heic",
  "heix",
  "hevc",
  "hevx",
  "heim",
  "heis",
  "mif1",
  "msf1",
  "heif",
]);

// The type the first bytes say, or null if they match nothing we accept. Needs at least 12 bytes.
export function sniffImageType(bytes: Uint8Array): ImageType | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff)
    return "image/jpeg";
  if (
    bytes.length >= 8 &&
    [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((b, i) => bytes[i] === b)
  )
    return "image/png";
  if (bytes.length >= 12 && ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 12) === "WEBP")
    return "image/webp";
  if (bytes.length >= 12 && ascii(bytes, 4, 8) === "ftyp" && HEIF_BRANDS.has(ascii(bytes, 8, 12)))
    return "image/heic";
  return null;
}

export const EXTENSION: Record<ImageType, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
};

// A safe name for a download: letters, digits, dots, dashes, underscores and spaces only, never a path.
export function safeFileName(name: string, type: ImageType): string {
  const base = name
    .split(/[\\/]/)
    .pop()!
    .replace(/\.[A-Za-z0-9]{1,5}$/, "")
    .replace(/[^A-Za-z0-9 ._-]+/g, "_")
    .replace(/^[. ]+/, "")
    .slice(0, 80)
    .trim();
  return `${base || "photo"}.${EXTENSION[type]}`;
}
