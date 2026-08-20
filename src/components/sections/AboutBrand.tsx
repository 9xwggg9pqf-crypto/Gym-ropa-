import { Dumbbell, Flame, Target } from "lucide-react";
import { siteConfig } from "@/data/site";
import SectionKicker from "@/components/ui/SectionKicker";
import Reveal from "@/components/ui/Reveal";
import PlaceholderImage from "@/components/ui/PlaceholderImage";

const icons = { dumbbell: Dumbbell, flame: Flame, target: Target };

export default function AboutBrand() {
  const { about } = siteConfig;

  return (
    <section id="marca" className="bg-surface py-24 sm:py-32">
      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-16 px-6 sm:px-10 lg:grid-cols-2 lg:gap-24">
        <Reveal>
          <SectionKicker>{about.kicker}</SectionKicker>
          <h2 className="mt-4 font-display text-3xl leading-tight tracking-wide uppercase sm:text-5xl">
            {about.title}
          </h2>

          <div className="mt-8 flex flex-col gap-5">
            {about.paragraphs.map((paragraph) => (
              <p key={paragraph} className="leading-relaxed text-muted">
                {paragraph}
              </p>
            ))}
          </div>

          <div className="mt-12 grid grid-cols-1 gap-8 sm:grid-cols-3">
            {about.values.map((value) => {
              const Icon = icons[value.icon as keyof typeof icons];
              return (
                <div key={value.title}>
                  <Icon className="h-7 w-7 text-red" strokeWidth={1.5} />
                  <h3 className="mt-4 font-display text-lg tracking-wider uppercase">
                    {value.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted">
                    {value.description}
                  </p>
                </div>
              );
            })}
          </div>
        </Reveal>

        <Reveal delay={150} className="h-full min-h-[24rem]">
          <PlaceholderImage label="Pro Play" className="h-full min-h-[24rem] w-full" />
        </Reveal>
      </div>
    </section>
  );
}
