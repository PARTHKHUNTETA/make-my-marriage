import type { Metadata } from "next";
import { PhotoGallery } from "@/components/photos/photo-gallery";
import { PhotosHeader } from "@/components/photos/photos-header";
import { absoluteUrl } from "@/lib/app-url";
import { requireMember } from "@/lib/authz";
import { listEvents } from "@/modules/events/service";
import { listPhotosSchema } from "@/modules/photos/schema";
import { getGallerySettings } from "@/modules/wedding/service";
import { getSummary, listAlbums, listPhotos } from "@/modules/photos/service";

export const metadata: Metadata = { title: "Photos — Make My Marriage" };
export const dynamic = "force-dynamic";

export default async function PhotosPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const ctx = await requireMember();
  const raw = await searchParams;
  // What does not depend on anything else is fetched together; the rest follows in as few steps as
  // the data allows (events -> albums -> this page of photos).
  const [summary, gallery, eventList] = await Promise.all([
    getSummary(ctx.weddingId),
    getGallerySettings(ctx.weddingId),
    listEvents(ctx.weddingId),
  ]);
  const albums = await listAlbums(
    ctx.weddingId,
    eventList.map((e) => ({ id: e.id, name: e.name })),
  );
  const parsed = listPhotosSchema.safeParse({
    albumId: typeof raw.album === "string" ? raw.album : undefined,
    page: typeof raw.page === "string" ? raw.page : undefined,
  });
  const query = parsed.success ? parsed.data : { albumId: undefined, page: 1 };
  const albumId = albums.some((a) => a.id === query.albumId) ? query.albumId : undefined;
  const list = await listPhotos(
    ctx.weddingId,
    { ...(albumId ? { albumId } : {}), status: "approved" },
    query.page,
    albums,
  );
  return (
    <main className="mx-auto w-full max-w-5xl pt-6">
      <PhotosHeader active="gallery" pending={summary.pending} />
      <PhotoGallery
        albums={albums}
        albumId={albumId}
        usage={summary.usage}
        items={list.items}
        page={query.page}
        pages={list.pages}
        total={list.total}
        guestLink={absoluteUrl(`/g/${gallery.token}`)}
      />
    </main>
  );
}
