'use client'
import { AlertTriangle, Loader2, Minus, Plus, RotateCw, X } from 'lucide-react'
import Link from 'next/link'
import { createContext, forwardRef, useCallback, useContext, useEffect, useId, useRef, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(' ')
}

type Variant = 'primary' | 'brand' | 'ghost' | 'outline' | 'danger' | 'subtle'
const VARIANTS: Record<Variant, string> = {
  primary: 'bg-saffron text-on-saffron hover:brightness-105 active:brightness-95 shadow-sm',
  brand: 'bg-brand text-white hover:brightness-110 active:brightness-95',
  ghost: 'bg-transparent text-ink hover:bg-sunken',
  outline: 'bg-surface text-ink border border-line hover:border-brand/40',
  danger: 'bg-danger text-white hover:brightness-110',
  subtle: 'bg-sunken text-ink hover:bg-line/60',
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
  icon?: ReactNode
  block?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button({ variant = 'outline', size = 'md', loading, icon, block, className, children, disabled, ...rest }, ref) {
  const sizes = { sm: 'h-9 px-3 text-sm gap-1.5', md: 'h-11 px-4 text-[15px] gap-2', lg: 'h-14 px-6 text-base gap-2.5' }
  return (
    <button
      ref={ref}
      className={cx('inline-flex items-center justify-center rounded-xl font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed select-none', VARIANTS[variant], sizes[size], block && 'w-full', className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : icon}
      {children}
    </button>
  )
})

export function LinkButton({ href, variant = 'outline', size = 'md', icon, className, children, block }: { href: string; variant?: Variant; size?: 'sm' | 'md' | 'lg'; icon?: ReactNode; className?: string; children: ReactNode; block?: boolean }) {
  const sizes = { sm: 'h-9 px-3 text-sm gap-1.5', md: 'h-11 px-4 text-[15px] gap-2', lg: 'h-14 px-6 text-base gap-2.5' }
  return (
    <Link href={href} className={cx('inline-flex items-center justify-center rounded-xl font-semibold transition select-none', VARIANTS[variant], sizes[size], block && 'w-full', className)}>
      {icon}
      {children}
    </Link>
  )
}

export function IconButton({ label, children, className, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button aria-label={label} title={label} className={cx('inline-flex h-11 w-11 items-center justify-center rounded-xl text-ink hover:bg-sunken transition disabled:opacity-40', className)} {...rest}>
      {children}
    </button>
  )
}

export function Field({ label, hint, error, children, htmlFor }: { label: string; hint?: string; error?: string | null; children: ReactNode; htmlFor?: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-sm font-semibold text-ink">
        {label}
      </label>
      {children}
      {hint && !error && <p className="text-xs text-muted">{hint}</p>}
      {error && (
        <p className="text-xs font-medium text-danger" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}

const inputBase = 'w-full rounded-xl border border-line bg-surface px-3.5 text-[15px] text-ink placeholder:text-muted/80 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20'

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...rest }, ref) {
  return <input ref={ref} className={cx(inputBase, 'h-11', className)} {...rest} />
})

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className, ...rest }, ref) {
  return <textarea ref={ref} className={cx(inputBase, 'min-h-[96px] py-3 leading-relaxed', className)} {...rest} />
})

export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cx(inputBase, 'h-11 pr-8', className)} {...rest}>
      {children}
    </select>
  )
}

export function Chip({ active, children, onClick, className, tone = 'brand', ...rest }: { active?: boolean; children: ReactNode; onClick?: () => void; className?: string; tone?: 'brand' | 'danger' } & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onClick'>) {
  const on = tone === 'danger' ? 'bg-danger text-white border-danger' : 'bg-brand text-white border-brand'
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cx('inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium transition', active ? on : 'border-line bg-surface text-ink hover:border-brand/50', className)}
      {...rest}
    >
      {children}
    </button>
  )
}

export function Badge({ children, tone = 'neutral', className }: { children: ReactNode; tone?: 'neutral' | 'ok' | 'warn' | 'danger' | 'brand' | 'saffron'; className?: string }) {
  const tones = {
    neutral: 'bg-sunken text-muted',
    ok: 'bg-ok/10 text-ok',
    warn: 'bg-warn/15 text-warn',
    danger: 'bg-danger/10 text-danger',
    brand: 'bg-brand/10 text-brand-ink',
    saffron: 'bg-saffron/25 text-ink',
  }
  return <span className={cx('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold', tones[tone], className)}>{children}</span>
}

/** Control numérico accesible con botones grandes (uso con una mano). */
export function Stepper({ value, onChange, step = 1, min = 0, max = 100000, label, suffix, format }: { value: number; onChange: (v: number) => void; step?: number; min?: number; max?: number; label: string; suffix?: string; format?: (v: number) => string }) {
  const id = useId()
  const [draft, setDraft] = useState<string | null>(null)
  const clamp = (v: number) => Math.min(max, Math.max(min, Math.round(v * 100) / 100))
  return (
    <div className="inline-flex items-center rounded-xl border border-line bg-surface" role="group" aria-label={label}>
      <button type="button" className="flex h-10 w-10 items-center justify-center rounded-l-xl hover:bg-sunken disabled:opacity-30" onClick={() => onChange(clamp(value - step))} disabled={value <= min} aria-label={`Reducir ${label}`}>
        <Minus className="h-4 w-4" aria-hidden />
      </button>
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <input
        id={id}
        inputMode="decimal"
        className="num h-10 w-[4.5rem] bg-transparent text-center text-[15px] font-semibold focus:outline-none"
        value={draft ?? (format ? format(value) : String(value))}
        onFocus={() => setDraft(String(value))}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          const n = Number((draft ?? '').replace(',', '.'))
          if (Number.isFinite(n)) onChange(clamp(n))
          setDraft(null)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
        }}
      />
      {suffix && <span className="pr-1 text-sm text-muted">{suffix}</span>}
      <button type="button" className="flex h-10 w-10 items-center justify-center rounded-r-xl hover:bg-sunken disabled:opacity-30" onClick={() => onChange(clamp(value + step))} disabled={value >= max} aria-label={`Aumentar ${label}`}>
        <Plus className="h-4 w-4" aria-hidden />
      </button>
    </div>
  )
}

export function Spinner({ label = 'Cargando' }: { label?: string }) {
  return (
    <span role="status" className="inline-flex items-center gap-2 text-muted">
      <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
      <span className="text-sm">{label}</span>
    </span>
  )
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx('animate-pulse rounded-xl bg-sunken', className)} aria-hidden />
}

export function ErrorBox({ title = 'No se ha podido completar', message, onRetry, action }: { title?: string; message: string; onRetry?: () => void; action?: ReactNode }) {
  return (
    <div role="alert" className="flex gap-3 rounded-2xl border border-danger/30 bg-danger/5 p-4">
      <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-danger" aria-hidden />
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <p className="font-semibold text-ink">{title}</p>
        <p className="text-sm text-muted">{message}</p>
        {(onRetry || action) && (
          <div className="flex flex-wrap gap-2">
            {onRetry && (
              <Button size="sm" variant="outline" icon={<RotateCw className="h-4 w-4" aria-hidden />} onClick={onRetry}>
                Reintentar
              </Button>
            )}
            {action}
          </div>
        )}
      </div>
    </div>
  )
}

export function EmptyState({ icon, title, children, action }: { icon: ReactNode; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-3xl border border-dashed border-line px-6 py-10 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-sunken text-brand-ink">{icon}</div>
      <h3 className="font-display text-lg font-semibold">{title}</h3>
      {children && <div className="max-w-sm text-sm text-muted">{children}</div>}
      {action}
    </div>
  )
}

/** Hoja inferior en móvil / diálogo centrado en escritorio. Cierra con Escape y devuelve el foco. */
export function Sheet({ open, onClose, title, children, footer }: { open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const titleId = useId()
  useEffect(() => {
    if (!open) return
    const prev = document.activeElement as HTMLElement | null
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    const t = setTimeout(() => ref.current?.querySelector<HTMLElement>('input,select,textarea,button')?.focus(), 30)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      clearTimeout(t)
      document.body.style.overflow = ''
      prev?.focus?.()
    }
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="presentation">
      <div className="absolute inset-0 bg-black/45" onClick={onClose} aria-hidden />
      <div ref={ref} role="dialog" aria-modal="true" aria-labelledby={titleId} className="safe-bottom relative flex max-h-[92dvh] w-full max-w-lg animate-rise flex-col rounded-t-3xl bg-surface shadow-lift sm:rounded-3xl">
        <div className="flex items-center justify-between gap-2 border-b border-line px-5 py-3">
          <h2 id={titleId} className="font-display text-base font-semibold">
            {title}
          </h2>
          <IconButton label="Cerrar" onClick={onClose}>
            <X className="h-5 w-5" aria-hidden />
          </IconButton>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="border-t border-line px-5 py-3">{footer}</div>}
      </div>
    </div>
  )
}

export function Tabs<T extends string>({ value, onChange, items, label }: { value: T; onChange: (v: T) => void; items: { value: T; label: string; count?: number }[]; label: string }) {
  return (
    <div role="tablist" aria-label={label} className="flex gap-1 overflow-x-auto rounded-2xl bg-sunken p-1">
      {items.map((it) => (
        <button
          key={it.value}
          role="tab"
          type="button"
          aria-selected={value === it.value}
          onClick={() => onChange(it.value)}
          className={cx('flex-1 whitespace-nowrap rounded-xl px-3 py-2 text-sm font-semibold transition', value === it.value ? 'bg-surface text-ink shadow-sm' : 'text-muted hover:text-ink')}
        >
          {it.label}
          {it.count !== undefined && <span className="num ml-1.5 text-xs text-muted">{it.count}</span>}
        </button>
      ))}
    </div>
  )
}

// ── Avisos (toasts) ─────────────────────────────────────────────────────────
type Toast = { id: number; message: string; tone: 'ok' | 'error' | 'info' }
const ToastContext = createContext<(message: string, tone?: Toast['tone']) => void>(() => {})
export function useToast() {
  return useContext(ToastContext)
}
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const push = useCallback((message: string, tone: Toast['tone'] = 'ok') => {
    const id = Date.now() + Math.random()
    setToasts((t) => [...t, { id, message, tone }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), tone === 'error' ? 6000 : 3200)
  }, [])
  return (
    <ToastContext.Provider value={push}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-24 z-[60] flex flex-col items-center gap-2 px-4 lg:bottom-6">
        {toasts.map((t) => (
          <div
            key={t.id}
            role={t.tone === 'error' ? 'alert' : 'status'}
            className={cx('pointer-events-auto max-w-md animate-rise rounded-2xl px-4 py-3 text-sm font-medium shadow-lift', t.tone === 'error' ? 'bg-danger text-white' : t.tone === 'info' ? 'bg-ink text-bg' : 'bg-brand text-white')}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function SectionTitle({ children, action, id }: { children: ReactNode; action?: ReactNode; id?: string }) {
  return (
    <div className="flex items-end justify-between gap-3">
      <h2 id={id} className="font-display text-lg font-semibold tracking-tight">
        {children}
      </h2>
      {action}
    </div>
  )
}

export function PageHeader({ title, subtitle, action, eyebrow }: { title: string; subtitle?: ReactNode; action?: ReactNode; eyebrow?: string }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        {eyebrow && <p className="label-caps text-brand-ink">{eyebrow}</p>}
        <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 max-w-prose text-[15px] text-muted">{subtitle}</p>}
      </div>
      {action}
    </header>
  )
}
