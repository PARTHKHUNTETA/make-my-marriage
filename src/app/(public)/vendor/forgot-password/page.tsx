import type { Metadata } from "next";
import { VendorForgotForm } from "@/components/vendor-portal/vendor-auth-forms";

export const metadata: Metadata = {
  title: "Reset password · Make My Marriage",
  robots: { index: false },
};

export default function Page() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-blush px-4 py-10">
      <VendorForgotForm />
    </main>
  );
}
