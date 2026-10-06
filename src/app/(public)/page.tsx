import { Features } from "@/components/home/features";
import { GuestExperience } from "@/components/home/guest-experience";
import { Header } from "@/components/home/header";
import { Hero } from "@/components/home/hero";
import { FinalCta, Footer, HowItWorks, SignOff, Traditions, Trust } from "@/components/home/lower";
import { Problem } from "@/components/home/problem";

export default function HomePage() {
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
