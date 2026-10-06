import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { GuestGrid } from "@/components/photos/guest-grid";
import { GuestUploader } from "@/components/photos/guest-uploader";
import { AppError } from "@/lib/errors";
import { guestAlbums, guestPhotos, openGallery } from "@/modules/photos/gallery";
import { listPhotosSchema } from "@/modules/photos/schema";

export const metadata: Metadata = { title: "Wedding photos", robots: { index: false } };
export const dynamic = "force-dynamic";

// The private photo link a couple shares (and prints as a QR): browse the approved photos, and add
// your own while uploads are open. The link is the only credential, so this page never shows it
// anywhere but the address bar.
export default async function GalleryPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { token } = await params;
  const raw = await searchParams;
  let access;
  try {
    access = await openGallery(token);
  } catch (err) {
    if (!(err instanceof AppError)) throw err;
    notFound();
  }

  const albums = await guestAlbums(access);
  const parsed = listPhotosSchema.safeParse({
    albumId: typeof raw.album === "string" ? raw.album : undefined,
    page: typeof raw.page === "string" ? raw.page : undefined,
  });
  const query = parsed.success ? parsed.data : { albumId: undefined, page: 1 };
  const albumId = albums.some((a) => a.id === query.albumId) ? query.albumId : undefined;
  const { items, total, pages } = await guestPhotos(access, albumId, query.page);
  const visibleAlbums = albums.filter((a) => a.approvedCount > 0);
  const href = (album?: string, page = 1) => {
    const q = new URLSearchParams();
    if (album) q.set("album", album);
    if (page > 1) q.set("page", String(page));
    const s = q.toString();
    return `/g/${token}${s ? `?${s}` : ""}`;
  };
  const chip = (on: boolean) =>
    `rounded-full px-3.5 py-1.5 text-[13px] font-semibold ${on ? "bg-bronze text-white" : "bg-white text-ink-2"}`;

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8">
      <header className="text-center">
        <p className="text-xs font-semibold tracking-[0.6px] text-bronze uppercase">
          Wedding photos
        </p>
        <h1 className="mt-1 font-serif text-4xl tracking-tight text-plum">
          {access.brideName} &amp; {access.groomName}
        </h1>
      </header>

      <div className="mt-6">
        {access.uploadsOn ? (
          <GuestUploader
            token={token}
            albums={albums.map((a) => ({ id: a.id, name: a.name, isGeneral: a.isGeneral }))}
          />
        ) : (
          <p className="rounded-xl bg-white p-4 text-center text-[13px] text-ink-2">
            Photo uploads are closed right now. You can still look through the photos below.
          </p>
        )}
      </div>

      <section className="mt-8">
        {visibleAlbums.length > 1 ? (
          <nav aria-label="Albums" className="mb-4 flex flex-wrap gap-2">
            <Link
              href={href()}
              aria-current={!albumId ? "page" : undefined}
              className={chip(!albumId)}
            >
              All
            </Link>
            {visibleAlbums.map((a) => (
              <Link
                key={a.id}
                href={href(a.id)}
                aria-current={a.id === albumId ? "page" : undefined}
                className={chip(a.id === albumId)}
              >
                {a.name}
              </Link>
            ))}
          </nav>
        ) : null}
        {items.length === 0 ? (
          <p className="rounded-xl bg-white p-8 text-center text-sm text-ink-2">
            No photos here yet. Check back soon.
          </p>
        ) : (
          <GuestGrid token={token} items={items} />
        )}
        {pages > 1 ? (
          <nav
            aria-label="Pages"
            className="mt-5 flex items-center justify-center gap-4 text-[13px]"
          >
            {query.page > 1 ? (
              <Link
                href={href(albumId, query.page - 1)}
                className="rounded-lg bg-white px-3.5 py-2 font-semibold text-ink"
              >
                Newer
              </Link>
            ) : null}
            <span className="text-ink-2">
              Page {query.page} of {pages} · {total} photos
            </span>
            {query.page < pages ? (
              <Link
                href={href(albumId, query.page + 1)}
                className="rounded-lg bg-white px-3.5 py-2 font-semibold text-ink"
              >
                Older
              </Link>
            ) : null}
          </nav>
        ) : null}
      </section>
    </main>
  );
}
