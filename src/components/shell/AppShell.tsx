'use client'
import { BookOpen, CalendarDays, Camera, Home, Package, Plus, ShoppingBasket, Sparkles, UserRound } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'
import { cx } from '@/components/ui'
import { useI18n } from '@/lib/i18n'
import { useSession } from '@/lib/session'
import { LogoMark, Wordmark } from './Logo'

const HIDE_CHROME = ['/cocinar']

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const { m } = useI18n()
  const { configured, user, isGuest } = useSession()
  const immersive = HIDE_CHROME.some((p) => pathname.endsWith(p))
  const is = (href: string) => (href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(href + '/'))

  const primary = [
    { href: '/', label: m.nav.home, icon: Home },
    { href: '/escanear', label: m.nav.scan, icon: Camera },
    { href: '/crear', label: m.nav.create, icon: Sparkles },
    { href: '/recetas', label: m.nav.recipes, icon: BookOpen },
    { href: '/plan', label: m.nav.plan, icon: CalendarDays },
  ]
  const secondary = [
    { href: '/compra', label: m.nav.shoppingList, icon: ShoppingBasket },
    { href: '/despensa', label: m.nav.pantry, icon: Package },
    { href: '/perfil', label: m.nav.profile, icon: UserRound },
  ]

  if (immersive) return <>{children}</>

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[248px_1fr]">
      <a href="#contenido" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[70] focus:rounded-xl focus:bg-surface focus:px-4 focus:py-2">
        Saltar al contenido
      </a>

      {/* Barra lateral (escritorio) */}
      <aside className="sticky top-0 hidden h-dvh flex-col gap-6 border-r border-line bg-surface px-4 py-5 lg:flex">
        <Link href="/" className="flex items-center gap-2.5 px-2" aria-label="SNACKEATS, inicio">
          <LogoMark className="h-9 w-9" />
          <Wordmark />
        </Link>
        <nav aria-label="Principal" className="flex flex-col gap-1">
          {[...primary, ...secondary].map((it) => (
            <Link key={it.href} href={it.href} aria-current={is(it.href) ? 'page' : undefined} className={cx('flex items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] font-medium transition', is(it.href) ? 'bg-brand/10 text-brand-ink' : 'text-muted hover:bg-sunken hover:text-ink')}>
              <it.icon className="h-5 w-5" aria-hidden />
              {it.label}
            </Link>
          ))}
        </nav>
        <div className="mt-auto flex flex-col gap-2 px-2 text-xs text-muted">
          <Link href="/planes" className="font-semibold text-brand-ink hover:underline">
            Planes y precios
          </Link>
          <div className="flex gap-3">
            <Link href="/privacidad" className="hover:underline">
              Privacidad
            </Link>
            <Link href="/terminos" className="hover:underline">
              Términos
            </Link>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-col">
        {/* Cabecera (móvil) */}
        <header className="safe-top sticky top-0 z-30 flex items-center justify-between gap-2 border-b border-line/70 bg-bg/90 px-4 py-2 backdrop-blur lg:hidden">
          <Link href="/" className="flex items-center gap-2" aria-label="SNACKEATS, inicio">
            <LogoMark className="h-8 w-8" />
            <Wordmark />
          </Link>
          <nav aria-label="Accesos rápidos" className="flex items-center">
            {secondary.map((it) => (
              <Link key={it.href} href={it.href} aria-label={it.label} aria-current={is(it.href) ? 'page' : undefined} className={cx('flex h-11 w-11 items-center justify-center rounded-xl transition', is(it.href) ? 'bg-brand/10 text-brand-ink' : 'text-ink hover:bg-sunken')}>
                <it.icon className="h-[22px] w-[22px]" aria-hidden />
              </Link>
            ))}
          </nav>
        </header>

        {!configured && (
          <div className="border-b border-warn/30 bg-warn/10 px-4 py-2 text-sm text-ink">
            Vista sin servidor configurado: puedes explorar la interfaz, pero no guardar datos ni usar la IA.{' '}
            <Link href="/configuracion" className="font-semibold underline">
              Ver qué falta
            </Link>
          </div>
        )}
        {configured && user && isGuest && (
          <div className="border-b border-line bg-sunken px-4 py-2 text-sm text-muted">
            Estás como invitado.{' '}
            <Link href="/entrar?convertir=1" className="font-semibold text-brand-ink underline">
              Crea tu cuenta
            </Link>{' '}
            para no perder tus recetas.
          </div>
        )}

        <main id="contenido" className="mx-auto w-full max-w-5xl flex-1 px-4 pb-32 pt-5 sm:px-6 lg:pb-12 lg:pt-8">
          {children}
        </main>
      </div>

      {/* Navegación inferior (móvil), pensada para usar con el pulgar */}
      <nav aria-label="Principal" className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 shadow-bar backdrop-blur lg:hidden">
        <ul className="mx-auto grid max-w-lg grid-cols-5 items-end px-1">
          {primary.map((it) => {
            const active = is(it.href)
            const center = it.href === '/crear'
            return (
              <li key={it.href} className="flex justify-center">
                <Link href={it.href} aria-current={active ? 'page' : undefined} className={cx('flex min-h-[60px] w-full flex-col items-center justify-center gap-0.5 text-[11px] font-semibold', active ? 'text-brand-ink' : 'text-muted')}>
                  {center ? (
                    <span className={cx('-mt-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-saffron text-on-saffron shadow-lift ring-4 ring-surface', active && 'ring-brand/20')}>
                      <Plus className="h-7 w-7" aria-hidden strokeWidth={2.5} />
                    </span>
                  ) : (
                    <it.icon className="h-6 w-6" aria-hidden strokeWidth={active ? 2.4 : 2} />
                  )}
                  <span>{it.label}</span>
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>
    </div>
  )
}
