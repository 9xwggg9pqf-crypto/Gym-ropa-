import type { Config } from 'tailwindcss'

const v = (name: string) => `rgb(var(--${name}) / <alpha-value>)`

export default {
  content: ['./src/**/*.{ts,tsx}'],
  darkMode: ['variant', ['@media (prefers-color-scheme: dark) { &:not([data-theme=light] *) }', '&:is([data-theme=dark] *)']],
  theme: {
    extend: {
      colors: {
        bg: v('bg'),
        surface: v('surface'),
        sunken: v('sunken'),
        line: v('line'),
        ink: v('ink'),
        muted: v('muted'),
        brand: v('brand'),
        'brand-ink': v('brand-ink'),
        saffron: v('saffron'),
        'saffron-ink': v('saffron-ink'),
        'on-saffron': v('on-saffron'),
        protein: v('protein'),
        carbs: v('carbs'),
        fat: v('fat'),
        ok: v('ok'),
        warn: v('warn'),
        danger: v('danger'),
      },
      fontFamily: {
        display: ['var(--font-display)', 'ui-rounded', 'system-ui', 'sans-serif'],
        sans: ['var(--font-body)', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      borderRadius: { xl: '14px', '2xl': '20px', '3xl': '28px' },
      boxShadow: {
        lift: '0 1px 2px rgb(var(--shadow) / 0.06), 0 8px 24px -8px rgb(var(--shadow) / 0.18)',
        bar: '0 -1px 0 rgb(var(--line) / 1), 0 -8px 24px -12px rgb(var(--shadow) / 0.2)',
      },
      keyframes: {
        rise: { from: { transform: 'translateY(6px)', opacity: '0.4' }, to: { transform: 'translateY(0)', opacity: '1' } },
        scanline: { '0%': { transform: 'translateY(0%)' }, '100%': { transform: 'translateY(100%)' } },
      },
      animation: { rise: 'rise 260ms ease-out both', scanline: 'scanline 1.6s ease-in-out infinite alternate' },
    },
  },
  plugins: [],
} satisfies Config
