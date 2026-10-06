import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { VendorSignupForm } from "@/components/vendor-portal/vendor-auth-forms";
import { resolveVendorContext } from "@/lib/context";

export const metadata: Metadata = {
  title: "List your business · Make My Marriage",
  robots: { index: false },
};
export const dynamic = "force-dynamic";

export default async function Page() {
  if (await resolveVendorContext()) redirect("/listing");
  return (
    <main className="flex min-h-screen items-center justify-center bg-blush px-4 py-10">
      <VendorSignupForm />
    </main>
  );
}
