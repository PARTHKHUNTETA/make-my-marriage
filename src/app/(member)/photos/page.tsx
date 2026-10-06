import type { Metadata } from "next";
import { PhotoGallery } from "@/components/photos/photo-gallery";
import { PhotosHeader } from "@/components/photos/photos-header";
import { absoluteUrl } from "@/lib/app-url";
import { requireMember } from "@/lib/authz";
import { listEvents } from "@/modules/events/service";
import { listPhotosSchema } from "@/modules/photos/schema";
import { getGallerySettings } from "@/modules/wedding/service";
import { getSummary, getUsage, listAlbums, listPhotos } from "@/modules/photos/service";

export const metadata: Metadata = { title: "Photos — Make My Marriage" };
export const dynamic = "force-dynamic";

export default async function PhotosPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const ctx = await requireMember();
  const raw = await searchParams;
  const events = (await listEvents(ctx.weddingId)).map((e) => ({ id: e.id, name: e.name }));
  const albums = await listAlbums(ctx.weddingId, events);
  const parsed = listPhotosSchema.safeParse({
    albumId: typeof raw.album === "string" ? raw.album : undefined,
    page: typeof raw.page === "string" ? raw.page : undefined,
  });
  const query = parsed.success ? parsed.data : { albumId: undefined, page: 1 };
  const albumId = albums.some((a) => a.id === query.albumId) ? query.albumId : undefined;
  const [list, usage, summary, gallery] = await Promise.all([
    listPhotos(ctx.weddingId, { ...(albumId ? { albumId } : {}), status: "approved" }, query.page),
    getUsage(ctx.weddingId),
    getSummary(ctx.weddingId),
    getGallerySettings(ctx.weddingId),
  ]);
  return (
    <main className="mx-auto w-full max-w-5xl pt-6">
      <PhotosHeader active="gallery" pending={summary.pending} />
      <PhotoGallery
        albums={albums}
        albumId={albumId}
        usage={usage}
        items={list.items}
        page={query.page}
        pages={list.pages}
        total={list.total}
        guestLink={absoluteUrl(`/g/${gallery.token}`)}
      />
    </main>
  );
}
