import { NextResponse, type NextRequest } from 'next/server'
import type { EmailOtpType } from '@supabase/supabase-js'
import { createSupabaseServer } from '@/lib/supabase/server'

// Destino de los enlaces de email (confirmación, enlace mágico, recuperación).
export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const tokenHash = url.searchParams.get('token_hash')
  const type = url.searchParams.get('type') as EmailOtpType | null
  const nextParam = url.searchParams.get('next') ?? '/'
  // Sólo rutas internas (evita redirecciones abiertas).
  const next = nextParam.startsWith('/') && !nextParam.startsWith('//') ? nextParam : '/'
  const supabase = await createSupabaseServer()
  if (!supabase) return NextResponse.redirect(new URL('/configuracion', url.origin))

  let ok = false
  if (code) ok = !(await supabase.auth.exchangeCodeForSession(code)).error
  else if (tokenHash && type) ok = !(await supabase.auth.verifyOtp({ type, token_hash: tokenHash })).error
  return NextResponse.redirect(new URL(ok ? next : '/entrar?error=enlace', url.origin))
}
