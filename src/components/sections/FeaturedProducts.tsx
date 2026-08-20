import { products } from "@/data/products";
import SectionKicker from "@/components/ui/SectionKicker";
import ProductCard from "@/components/ui/ProductCard";
import Reveal from "@/components/ui/Reveal";

export default function FeaturedProducts() {
  return (
    <section id="productos" className="bg-background py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-6 sm:px-10">
        <Reveal>
          <SectionKicker>Colección</SectionKicker>
          <h2 className="mt-4 font-display text-4xl tracking-wide uppercase sm:text-6xl">
            Productos destacados
          </h2>
        </Reveal>

        <div className="mt-14 grid grid-cols-1 gap-x-8 gap-y-14 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((product, index) => (
            <Reveal key={product.name} delay={index * 80}>
              <ProductCard product={product} />
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
