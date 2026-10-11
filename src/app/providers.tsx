'use client'
import { useEffect, type ReactNode } from 'react'
import { ToastProvider } from '@/components/ui'
import { I18nProvider } from '@/lib/i18n'
import { SessionProvider, useSession } from '@/lib/session'
import { AppShell } from '@/components/shell/AppShell'

function LocaleBridge({ children }: { children: ReactNode }) {
  const { profile } = useSession()
  const locale = profile?.locale === 'en' ? 'en' : 'es'
  useEffect(() => {
    document.documentElement.lang = locale
  }, [locale])
  return <I18nProvider locale={locale}>{children}</I18nProvider>
}

export function Providers({ children }: { children: ReactNode }) {
  useEffect(() => {
    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
      navigator.serviceWorker.register('/sw.js').catch(() => {})
    }
  }, [])
  return (
    <SessionProvider>
      <LocaleBridge>
        <ToastProvider>
          <AppShell>{children}</AppShell>
        </ToastProvider>
      </LocaleBridge>
    </SessionProvider>
  )
}
