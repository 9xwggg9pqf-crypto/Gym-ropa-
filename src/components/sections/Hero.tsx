import { ChevronDown } from "lucide-react";
import { siteConfig } from "@/data/site";
import Button from "@/components/ui/Button";

export default function Hero() {
  const { hero } = siteConfig;

  return (
    <section className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background">
      <div className="grid-texture absolute inset-0 opacity-60" />
      <div className="absolute top-1/2 left-1/2 h-[36rem] w-[36rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-red/25 blur-[140px]" />
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-background" />

      <div className="relative z-10 mx-auto flex max-w-4xl flex-col items-center px-6 pt-16 text-center">
        <span className="mb-6 font-display text-sm tracking-[0.4em] text-red uppercase">
          {hero.kicker}
        </span>

        <h1 className="font-display text-[4.2rem] leading-[0.9] tracking-wide uppercase sm:text-[7rem] md:text-[9rem]">
          {hero.title}
        </h1>

        <p className="mt-4 font-display text-lg tracking-[0.2em] text-white/80 uppercase sm:text-2xl">
          {hero.subtitle}
        </p>

        <p className="mt-6 max-w-lg font-display text-2xl tracking-wide text-red uppercase sm:text-3xl">
          {hero.slogan}
        </p>

        <div className="mt-10 flex flex-col gap-4 sm:flex-row">
          <Button href={hero.ctaHref}>{hero.ctaLabel}</Button>
          <Button href={hero.secondaryHref} variant="outline">
            {hero.secondaryLabel}
          </Button>
        </div>
      </div>

      <ChevronDown className="absolute bottom-8 left-1/2 h-7 w-7 -translate-x-1/2 animate-bounce text-white/40" />
    </section>
  );
}
