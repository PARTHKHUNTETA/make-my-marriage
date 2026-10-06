import type { Metadata } from "next";

// Guest pages are private links: never indexed. The token in the URL is the whole credential,
// so these pages must not render or log it. Keep the JavaScript budget tiny (system-design §5).
export const metadata: Metadata = { robots: { index: false } };

export default function GuestLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <>{children}</>;
}
