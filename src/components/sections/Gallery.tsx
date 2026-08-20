import { galleryItems } from "@/data/gallery";
import { siteConfig } from "@/data/site";
import SectionKicker from "@/components/ui/SectionKicker";
import Reveal from "@/components/ui/Reveal";
import PlaceholderImage from "@/components/ui/PlaceholderImage";

const spanClasses = [
  "sm:row-span-2",
  "",
  "",
  "",
  "sm:row-span-2",
  "",
];

export default function Gallery() {
  return (
    <section id="galeria" className="bg-background py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-6 sm:px-10">
        <Reveal>
          <SectionKicker>{siteConfig.gallery.kicker}</SectionKicker>
          <h2 className="mt-4 font-display text-4xl tracking-wide uppercase sm:text-6xl">
            {siteConfig.gallery.title}
          </h2>
          <p className="mt-4 max-w-lg text-muted">{siteConfig.gallery.subtitle}</p>
        </Reveal>

        <div className="mt-14 grid grid-cols-2 gap-4 sm:grid-cols-3 sm:[grid-auto-rows:12rem]">
          {galleryItems.map((item, index) => (
            <Reveal key={item.caption} delay={index * 70} className={spanClasses[index]}>
              <PlaceholderImage
                label={item.caption}
                className="h-full min-h-[10rem] w-full transition-transform duration-500 hover:scale-[1.03]"
              />
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
