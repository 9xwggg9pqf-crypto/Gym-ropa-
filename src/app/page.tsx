import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import Hero from "@/components/sections/Hero";
import FeaturedProducts from "@/components/sections/FeaturedProducts";
import AboutBrand from "@/components/sections/AboutBrand";
import Gallery from "@/components/sections/Gallery";

export default function Home() {
  return (
    <>
      <Header />
      <main className="flex-1">
        <Hero />
        <FeaturedProducts />
        <AboutBrand />
        <Gallery />
      </main>
      <Footer />
    </>
  );
}
