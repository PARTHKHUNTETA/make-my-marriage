import type { Metadata } from "next";
import { VendorVerifyCard } from "@/components/vendor-portal/vendor-auth-forms";

export const metadata: Metadata = {
  title: "Confirm your email · Make My Marriage",
  robots: { index: false },
};

export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return (
    <main className="flex min-h-screen items-center justify-center bg-blush px-4 py-10">
      <VendorVerifyCard token={token} />
    </main>
  );
}
