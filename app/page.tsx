import { Navbar } from "@/components/layouts/Navbar";
import { Hero } from "@/components/features/Hero";
import { Features } from "@/components/features/Features";
import { HowItWorks } from "@/components/features/HowItWorks";
import { Footer } from "@/components/layouts/Footer";

export default function Home() {
  return (
    <main className="min-h-screen bg-background text-foreground selection:bg-primary/20">
      <Navbar />
      <Hero />
      <Features />
      <HowItWorks />
      <Footer />
    </main>
  );
}
