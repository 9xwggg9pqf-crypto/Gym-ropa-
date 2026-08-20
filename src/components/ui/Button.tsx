import Link from "next/link";
import type { ReactNode } from "react";

type ButtonProps = {
  href: string;
  children: ReactNode;
  variant?: "primary" | "outline";
  className?: string;
};

const baseStyles =
  "inline-flex items-center justify-center px-8 py-3.5 font-display text-lg tracking-wider uppercase transition-all duration-300 whitespace-nowrap";

const variants = {
  primary:
    "bg-red text-white hover:bg-red-light shadow-[0_0_0_1px_rgba(228,0,43,0.4)] hover:shadow-[0_0_30px_rgba(228,0,43,0.5)]",
  outline:
    "border border-white/25 text-foreground hover:border-red hover:text-red",
};

export default function Button({
  href,
  children,
  variant = "primary",
  className = "",
}: ButtonProps) {
  return (
    <Link href={href} className={`${baseStyles} ${variants[variant]} ${className}`}>
      {children}
    </Link>
  );
}
