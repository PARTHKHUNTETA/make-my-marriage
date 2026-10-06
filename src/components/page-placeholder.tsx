export function PagePlaceholder({ title, phase }: { title: string; phase: string }) {
  return (
    <main className="mx-auto flex min-h-[60vh] max-w-2xl flex-col items-start justify-center gap-2 px-4 py-16">
      <p className="text-xs font-semibold tracking-[0.6px] text-bronze uppercase">{phase}</p>
      <h1 className="font-serif text-4xl leading-11 tracking-[-0.9px] text-black">{title}</h1>
      <p className="text-ink-2">
        This page is a placeholder. The feature is built in its release phase.
      </p>
    </main>
  );
}
