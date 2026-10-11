'use client'
import { Mail } from 'lucide-react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense, useState } from 'react'
import { getSupabaseBrowser } from '@/lib/supabase/client'
import { useSession } from '@/lib/session'
import { Button, ErrorBox, Field, Input, PageHeader, Tabs, useToast } from '@/components/ui'
import { LogoMark } from '@/components/shell/Logo'

function Inner() {
  const params = useSearchParams()
  const router = useRouter()
  const toast = useToast()
  const { user, isGuest, ensureSession, configured, refreshProfile } = useSession()
  const supabase = getSupabaseBrowser()
  const converting = params.get('convertir') === '1' && isGuest
  const resetting = params.get('reset') === '1' && user && !isGuest
  const next = (() => {
    const n = params.get('siguiente') ?? '/'
    return n.startsWith('/') && !n.startsWith('//') ? n : '/'
  })()
  const [tab, setTab] = useState<'entrar' | 'registro'>(params.get('modo') === 'registro' ? 'registro' : 'entrar')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [accept, setAccept] = useState(false)
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(params.get('error') === 'enlace' ? 'El enlace no es válido o ha caducado. Pide uno nuevo.' : null)
  const redirect = (path: string) => `${window.location.origin}/auth/callback?next=${encodeURIComponent(path)}`

  if (!configured || !supabase) {
    return <ErrorBox title="Acceso no disponible" message="La autenticación necesita configurar Supabase en el servidor." action={<Link href="/configuracion" className="text-sm font-semibold underline">Ver configuración</Link>} />
  }

  async function run(fn: () => Promise<{ error: { message: string } | null }>, onOk: () => void) {
    setBusy(true)
    setError(null)
    const { error: e } = await fn()
    setBusy(false)
    if (e) {
      const m = e.message.toLowerCase()
      setError(m.includes('invalid login') ? 'Email o contraseña incorrectos.' : m.includes('already registered') ? 'Ya existe una cuenta con ese email. Entra en lugar de registrarte.' : m.includes('password') ? 'La contraseña no cumple los requisitos (mínimo 8 caracteres).' : m.includes('rate') ? 'Demasiados intentos. Espera un momento.' : 'No se ha podido completar. Revisa los datos e inténtalo de nuevo.')
      return
    }
    onOk()
  }

  const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)

  if (sent) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-4 py-10 text-center">
        <Mail className="h-12 w-12 text-brand-ink" aria-hidden />
        <h1 className="font-display text-2xl font-semibold">Revisa tu correo</h1>
        <p className="text-muted">{sent}</p>
      </div>
    )
  }

  if (resetting) {
    return (
      <div className="mx-auto flex w-full max-w-md flex-col gap-5">
        <PageHeader title="Nueva contraseña" />
        {error && <ErrorBox message={error} />}
        <Field label="Contraseña nueva" htmlFor="np" hint="Mínimo 8 caracteres">
          <Input id="np" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        <Button variant="primary" loading={busy} disabled={password.length < 8} onClick={() => run(() => supabase.auth.updateUser({ password }), () => { toast('Contraseña actualizada'); router.push('/') })}>
          Guardar contraseña
        </Button>
      </div>
    )
  }

  if (converting) {
    return (
      <div className="mx-auto flex w-full max-w-md flex-col gap-5">
        <PageHeader title="Crea tu cuenta" subtitle="Conservarás las recetas, la despensa y el plan que ya tienes como invitado." />
        {error && <ErrorBox message={error} />}
        <Field label="Email" htmlFor="ce">
          <Input id="ce" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" className="mt-0.5 h-5 w-5 accent-[rgb(var(--brand))]" checked={accept} onChange={(e) => setAccept(e.target.checked)} />
          <span>
            Acepto los <Link href="/terminos" className="font-semibold underline">términos</Link> y la <Link href="/privacidad" className="font-semibold underline">política de privacidad</Link>.
          </span>
        </label>
        <Button variant="primary" loading={busy} disabled={!validEmail || !accept} onClick={() => run(() => supabase.auth.updateUser({ email }, { emailRedirectTo: redirect('/perfil') }), () => setSent(`Te hemos enviado un enlace a ${email} para confirmar tu cuenta. Después podrás entrar con un enlace mágico o fijar una contraseña.`))}>
          Confirmar email
        </Button>
      </div>
    )
  }

  if (user && !isGuest) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-4 py-10 text-center">
        <p className="text-muted">Ya has iniciado sesión como {user.email}.</p>
        <Button variant="primary" onClick={() => router.push(next)}>
          Continuar
        </Button>
      </div>
    )
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-5">
      <div className="flex flex-col items-center gap-3 pt-2 text-center">
        <LogoMark className="h-14 w-14" />
        <h1 className="font-display text-2xl font-semibold">Tu cocina, en tu cuenta</h1>
        <p className="text-sm text-muted">Guarda recetas, despensa y plan semanal en cualquier dispositivo.</p>
      </div>
      <Tabs label="Acceso" value={tab} onChange={setTab} items={[{ value: 'entrar', label: 'Entrar' }, { value: 'registro', label: 'Crear cuenta' }]} />
      {error && <ErrorBox message={error} />}
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault()
          if (tab === 'entrar') run(() => supabase.auth.signInWithPassword({ email, password }), async () => { await refreshProfile(); router.push(next) })
          else run(() => supabase.auth.signUp({ email, password, options: { emailRedirectTo: redirect('/perfil') } }), () => setSent(`Si el registro requiere confirmación, te hemos enviado un enlace a ${email}.`))
        }}
      >
        <Field label="Email" htmlFor="em">
          <Input id="em" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </Field>
        <Field label="Contraseña" htmlFor="pw" hint={tab === 'registro' ? 'Mínimo 8 caracteres' : undefined}>
          <Input id="pw" type="password" autoComplete={tab === 'entrar' ? 'current-password' : 'new-password'} value={password} onChange={(e) => setPassword(e.target.value)} required minLength={tab === 'registro' ? 8 : undefined} />
        </Field>
        {tab === 'registro' && (
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" className="mt-0.5 h-5 w-5 accent-[rgb(var(--brand))]" checked={accept} onChange={(e) => setAccept(e.target.checked)} />
            <span>
              Acepto los <Link href="/terminos" className="font-semibold underline">términos</Link> y la <Link href="/privacidad" className="font-semibold underline">política de privacidad</Link>.
            </span>
          </label>
        )}
        <Button type="submit" variant="primary" size="lg" loading={busy} disabled={!validEmail || !password || (tab === 'registro' && (!accept || password.length < 8))}>
          {tab === 'entrar' ? 'Entrar' : 'Crear cuenta'}
        </Button>
      </form>
      <div className="flex flex-col gap-2">
        <Button variant="outline" disabled={!validEmail || busy} onClick={() => run(() => supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: redirect(next) } }), () => setSent(`Te hemos enviado un enlace de acceso a ${email}.`))}>
          Enviarme un enlace mágico
        </Button>
        {tab === 'entrar' && (
          <button type="button" className="text-sm font-semibold text-muted underline disabled:opacity-50" disabled={!validEmail} onClick={() => run(() => supabase.auth.resetPasswordForEmail(email, { redirectTo: redirect('/entrar?reset=1') }), () => setSent(`Si existe una cuenta con ${email}, te hemos enviado un enlace para cambiar la contraseña.`))}>
            He olvidado mi contraseña
          </button>
        )}
      </div>
      <div className="border-t border-line pt-4 text-center">
        <Button
          variant="ghost"
          onClick={async () => {
            const r = await ensureSession()
            if (!r.ok) return setError(r.reason)
            router.push(next)
          }}
        >
          Probar sin cuenta (invitado)
        </Button>
        <p className="mt-1 text-xs text-muted">Con límites reducidos. Podrás crear tu cuenta después sin perder nada.</p>
      </div>
    </div>
  )
}

export default function SignInPage() {
  return (
    <Suspense>
      <Inner />
    </Suspense>
  )
}
