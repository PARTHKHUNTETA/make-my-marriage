import { redirect } from "next/navigation";
import { Features } from "@/components/home/features";
import { GuestExperience } from "@/components/home/guest-experience";
import { Header } from "@/components/home/header";
import { Hero } from "@/components/home/hero";
import { FinalCta, Footer, HowItWorks, SignOff, Traditions, Trust } from "@/components/home/lower";
import { Problem } from "@/components/home/problem";
import { resolveContext, resolveVendorContext } from "@/lib/context";

// The homepage is for visitors. Someone already signed in goes straight to where they work: their
// dashboard, the wedding setup they haven't finished, or their vendor listing.
export default async function HomePage() {
  const ctx = await resolveContext();
  if (ctx.kind === "member") redirect("/dashboard");
  if (ctx.kind === "user") redirect("/setup");
  if (await resolveVendorContext()) redirect("/listing");
  return (
    <>
      <Header />
      <main>
        <Hero />
        <Problem />
        <Features />
        <GuestExperience />
        <HowItWorks />
        <Traditions />
        <Trust />
        <FinalCta />
        <SignOff />
      </main>
      <Footer />
    </>
  );
}
