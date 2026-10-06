// Shown for a gallery link that never existed or was replaced. The page answers 404.
export default function GalleryLinkNotFound() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-6 text-center">
      <h1 className="font-serif text-3xl text-plum">This link isn’t working</h1>
      <p className="mt-2 text-sm text-ink-2">
        The photo link may have been replaced. Please ask the couple for the latest one.
      </p>
    </main>
  );
}
