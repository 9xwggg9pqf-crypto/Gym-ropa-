export function LogoMark({ className = 'h-8 w-8' }: { className?: string }) {
  // Un círculo de azafrán "mordido" sobre berenjena: snack + bocado.
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <rect width="64" height="64" rx="16" fill="rgb(var(--brand))" />
      <mask id="bite">
        <rect width="64" height="64" fill="#fff" />
        <circle cx="45" cy="19" r="9" fill="#000" />
        <circle cx="51" cy="29" r="6" fill="#000" />
      </mask>
      <circle cx="31" cy="34" r="19" fill="rgb(var(--saffron))" mask="url(#bite)" />
      <circle cx="25" cy="30" r="2.6" fill="rgb(var(--brand))" opacity="0.55" />
      <circle cx="33" cy="41" r="2" fill="rgb(var(--brand))" opacity="0.55" />
    </svg>
  )
}

export function Wordmark({ className = '' }: { className?: string }) {
  return (
    <span className={`font-display text-[17px] font-bold tracking-[-0.02em] ${className}`}>
      SNACK<span className="text-saffron-ink">EATS</span>
    </span>
  )
}
