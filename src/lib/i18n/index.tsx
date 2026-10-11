'use client'
import { createContext, useContext, type ReactNode } from 'react'
import { es, type Messages } from './es'
import { en } from './en'

export const LOCALES = { es, en } as const
export type Locale = keyof typeof LOCALES

const I18nContext = createContext<{ locale: Locale; m: Messages }>({ locale: 'es', m: es })

export function I18nProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  return <I18nContext.Provider value={{ locale, m: LOCALES[locale] ?? es }}>{children}</I18nContext.Provider>
}

export function useI18n() {
  return useContext(I18nContext)
}

export function formatNumber(n: number, locale: Locale = 'es', digits = 0) {
  return new Intl.NumberFormat(locale === 'en' ? 'en-GB' : 'es-ES', { maximumFractionDigits: digits, minimumFractionDigits: 0 }).format(n)
}
