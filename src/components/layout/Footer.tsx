import Link from "next/link";
import { siteConfig } from "@/data/site";
import NewsletterForm from "@/components/ui/NewsletterForm";
import Reveal from "@/components/ui/Reveal";
import { socialIconMap } from "@/components/ui/SocialIcons";

export default function Footer() {
  return (
    <footer id="newsletter" className="border-t border-white/10 bg-surface">
      <div className="mx-auto max-w-7xl px-6 py-20 sm:px-10 sm:py-28">
        <Reveal>
          <div className="flex flex-col items-start gap-6 border-b border-white/10 pb-16">
            <h2 className="font-display text-4xl tracking-wide uppercase sm:text-5xl">
              {siteConfig.newsletter.title}
            </h2>
            <p className="max-w-md text-muted">{siteConfig.newsletter.subtitle}</p>
            <NewsletterForm />
            <p className="text-xs text-muted">{siteConfig.newsletter.disclaimer}</p>
          </div>
        </Reveal>

        <div className="flex flex-col gap-10 pt-12 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <span className="font-display text-2xl tracking-widest uppercase">
              {siteConfig.brand}
              <span className="text-red">.</span>
            </span>
            <p className="mt-2 text-sm text-muted">{siteConfig.footer.tagline}</p>
          </div>

          <nav className="flex flex-wrap gap-x-8 gap-y-3">
            {siteConfig.nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="font-display text-sm tracking-wider text-muted uppercase transition-colors hover:text-red"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-5">
            {siteConfig.social.map((item) => {
              const Icon = socialIconMap[item.icon];
              return (
                <Link
                  key={item.label}
                  href={item.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={item.label}
                  className="text-muted transition-colors hover:text-red"
                >
                  <Icon className="h-5 w-5" />
                </Link>
              );
            })}
          </div>
        </div>

        <div className="mt-12 flex flex-col gap-2 border-t border-white/10 pt-8 text-xs text-muted sm:flex-row sm:justify-between">
          <p>{siteConfig.footer.copyright}</p>
          <p>{siteConfig.footer.note}</p>
        </div>
      </div>
    </footer>
  );
}
