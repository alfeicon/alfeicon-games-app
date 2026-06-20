import { HeroSection } from "@/components/premium-test/HeroSection";
import { ParallaxBackground } from "@/components/premium-test/ParallaxBackground";
import { PremiumNavbar } from "@/components/premium-test/PremiumNavbar";

export default function PremiumTestPage() {
  return (
    <div className="relative min-h-dvh overflow-hidden bg-[#070a12]">
      <ParallaxBackground />
      <PremiumNavbar />
      <HeroSection />
    </div>
  );
}
