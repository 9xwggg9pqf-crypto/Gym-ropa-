import PlaceholderImage from "./PlaceholderImage";
import type { Product } from "@/data/products";

const tagStyles: Record<NonNullable<Product["tag"]>, string> = {
  NUEVO: "bg-red text-white",
  "MÁS VENDIDO": "bg-white text-black",
  LIMITADO: "border border-red text-red",
};

export default function ProductCard({ product }: { product: Product }) {
  return (
    <div className="group flex flex-col">
      <div className="relative aspect-[4/5] w-full overflow-hidden">
        <PlaceholderImage label={product.category} className="h-full w-full transition-transform duration-500 group-hover:scale-105" />
        {product.tag && (
          <span
            className={`absolute top-3 left-3 px-2.5 py-1 font-display text-xs tracking-wider uppercase ${tagStyles[product.tag]}`}
          >
            {product.tag}
          </span>
        )}
      </div>
      <div className="mt-4 flex items-start justify-between gap-4">
        <div>
          <h3 className="font-display text-xl tracking-wide uppercase">{product.name}</h3>
          <p className="mt-1 text-sm text-muted">{product.category}</p>
        </div>
        <span className="font-display text-lg text-red whitespace-nowrap">{product.price}</span>
      </div>
      <span className="mt-3 inline-block w-fit border border-white/15 px-4 py-2 font-display text-xs tracking-[0.2em] text-muted uppercase">
        Próximamente
      </span>
    </div>
  );
}
