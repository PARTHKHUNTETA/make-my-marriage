import type { Metadata } from "next";
import { VendorResetForm } from "@/components/vendor-portal/vendor-auth-forms";

// The emailed link is the credential, so this page is never indexed.
export const metadata: Metadata = {
  title: "Choose a new password · Make My Marriage",
  robots: { index: false },
};

export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return (
    <main className="flex min-h-screen items-center justify-center bg-blush px-4 py-10">
      <VendorResetForm token={token} />
    </main>
  );
}
