import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/dashboard/sidebar";
import { Topbar } from "@/components/dashboard/topbar";
import { VerifyEmailBanner } from "@/components/verify-email-banner";
import { paletteStyle } from "@/lib/palettes";
import { resolveContext } from "@/lib/context";
import { daysToGoLabel, daysUntil, formatMonthYear } from "@/lib/dates";
import { getProfile } from "@/modules/members/service";
import { getWedding } from "@/modules/wedding/service";

export const metadata: Metadata = { robots: { index: false } };

// Everything under (member) needs an account that belongs to a wedding. Signed-out visitors go
// to sign-in; accounts without a wedding go to first-time setup.
export default async function MemberLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const ctx = await resolveContext();
  if (ctx.kind === "user") redirect("/setup");
  if (ctx.kind !== "member") redirect("/login");

  const [profile, wedding] = await Promise.all([getProfile(ctx.userId), getWedding(ctx.weddingId)]);
  if (!profile) redirect("/login");
  // A membership always has a wedding (they are created together, in one transaction).
  if (!wedding) throw new Error("Wedding record is missing for a member");

  const shell = {
    user: { name: profile.name },
    wedding: {
      couple: `${wedding.brideName} & ${wedding.groomName}`,
      place: `${wedding.city} • ${formatMonthYear(wedding.date)}`,
      countdown: daysToGoLabel(daysUntil(wedding.date)),
    },
  };

  return (
    // This person's colour theme: variables on the shell recolour everything inside it. It is rendered
    // on the server, so the first paint is already the right colours. The default adds no style.
    <div
      id="app-shell"
      data-palette={ctx.palette}
      style={paletteStyle(ctx.palette)}
      className="min-h-screen bg-blush"
    >
      <Sidebar user={shell.user} wedding={shell.wedding} />
      <div className="lg:pl-64 print:pl-0">
        <Topbar user={shell.user} wedding={shell.wedding} />
        <div className="px-6 pt-16 pb-6 print:p-0">
          {profile.emailVerified ? null : (
            <div className="pt-4 print:hidden">
              <VerifyEmailBanner email={profile.email} />
            </div>
          )}
          {children}
        </div>
      </div>
    </div>
  );
}
