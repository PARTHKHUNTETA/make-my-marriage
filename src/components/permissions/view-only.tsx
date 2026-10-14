// For someone who may see a record but not change it: the form is shown with every field and
// button switched off, and a line saying why. A disabled fieldset disables everything inside it,
// so no form needs its own read-only mode. The server refuses the change regardless.
export function ViewOnly({ when, children }: { when: boolean; children: React.ReactNode }) {
  if (!when) return <>{children}</>;
  return (
    <div>
      <p role="note" className="mb-3 rounded-lg bg-rose-50 px-3.5 py-2.5 text-[13px] text-ink-2">
        You can view this, but your role does not let you change it.
      </p>
      <fieldset disabled className="min-w-0 [&_button]:hidden">
        {children}
      </fieldset>
    </div>
  );
}
