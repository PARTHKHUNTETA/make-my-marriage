import type { Metadata } from "next";
import { PhotosHeader } from "@/components/photos/photos-header";
import { SharePanel } from "@/components/photos/share-panel";
import { absoluteUrl } from "@/lib/app-url";
import { canManageMembers, requireMember } from "@/lib/authz";
import { qrDataUrl } from "@/lib/qr";
import { getSummary } from "@/modules/photos/service";
import { getGallerySettings } from "@/modules/wedding/service";

export const metadata: Metadata = { title: "Share photos — Make My Marriage" };
export const dynamic = "force-dynamic";

export default async function SharePage() {
  const ctx = await requireMember();
  const [settings, summary] = await Promise.all([
    getGallerySettings(ctx.weddingId),
    getSummary(ctx.weddingId),
  ]);
  const link = absoluteUrl(`/g/${settings.token}`);
  return (
    <main className="mx-auto w-full max-w-5xl pt-6">
      <PhotosHeader active="share" pending={summary.pending} />
      <SharePanel
        link={link}
        qr={await qrDataUrl(link)}
        uploadsOn={settings.uploadsOn}
        isAdmin={canManageMembers(ctx)}
      />
    </main>
  );
}
