import { Shirt } from "lucide-react";

type PlaceholderImageProps = {
  label?: string;
  className?: string;
};

/**
 * Marcador de posición visual hasta que haya fotos reales de producto/lifestyle.
 * Sustitúyelo por next/image apuntando a tus imágenes cuando estén listas.
 */
export default function PlaceholderImage({ label, className = "" }: PlaceholderImageProps) {
  return (
    <div
      className={`diagonal-stripes relative flex items-center justify-center overflow-hidden bg-surface ${className}`}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-black/40 via-transparent to-black/60" />
      <Shirt
        className="h-10 w-10 text-white/15 sm:h-14 sm:w-14"
        strokeWidth={1.25}
      />
      {label && (
        <span className="absolute bottom-3 left-3 font-display text-xs tracking-[0.2em] text-white/40 uppercase sm:bottom-4 sm:left-4 sm:text-sm">
          {label}
        </span>
      )}
    </div>
  );
}
