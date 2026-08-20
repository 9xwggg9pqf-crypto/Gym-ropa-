"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { siteConfig } from "@/data/site";

export default function Header() {
  const [open, setOpen] = useState(false);

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-white/10 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6 sm:h-20 sm:px-10">
        <Link href="#" className="font-display text-2xl tracking-widest uppercase sm:text-3xl">
          {siteConfig.brand}
          <span className="text-red">.</span>
        </Link>

        <nav className="hidden items-center gap-10 md:flex">
          {siteConfig.nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="font-display text-sm tracking-[0.15em] text-muted uppercase transition-colors hover:text-red"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <Link
          href="#newsletter"
          className="hidden font-display text-sm tracking-[0.15em] uppercase border border-red px-5 py-2.5 text-red transition-colors hover:bg-red hover:text-white md:inline-block"
        >
          Únete
        </Link>

        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-label="Abrir menú"
          aria-expanded={open}
          className="text-foreground md:hidden"
        >
          {open ? <X className="h-7 w-7" /> : <Menu className="h-7 w-7" />}
        </button>
      </div>

      {open && (
        <nav className="flex flex-col gap-1 border-t border-white/10 bg-background px-6 py-4 md:hidden">
          {siteConfig.nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className="py-3 font-display text-lg tracking-wider text-muted uppercase transition-colors hover:text-red"
            >
              {item.label}
            </Link>
          ))}
          <Link
            href="#newsletter"
            onClick={() => setOpen(false)}
            className="mt-2 border border-red px-5 py-3 text-center font-display tracking-wider text-red uppercase"
          >
            Únete
          </Link>
        </nav>
      )}
    </header>
  );
}
