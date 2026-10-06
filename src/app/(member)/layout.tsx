import type { Metadata } from "next";
import { Sidebar } from "@/components/dashboard/sidebar";
import { Topbar } from "@/components/dashboard/topbar";

export const metadata: Metadata = { robots: { index: false } };

// Phase 1: call requireMember() here before rendering the shell.
export default function MemberLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="min-h-screen bg-blush">
      <Sidebar />
      <div className="lg:pl-64">
        <Topbar />
        <div className="px-6 pt-16 pb-6">{children}</div>
      </div>
    </div>
  );
}
