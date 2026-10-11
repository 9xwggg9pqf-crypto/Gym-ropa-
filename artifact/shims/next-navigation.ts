// Sustituto de next/navigation para la versión de prueba (enrutado por hash).
import { createContext, useContext, useMemo, useSyncExternalStore } from 'react'

function current() {
  const h = decodeURI(location.hash.slice(1)) || '/'
  return h.startsWith('/') ? h : '/' + h
}
function subscribe(cb: () => void) {
  window.addEventListener('hashchange', cb)
  return () => window.removeEventListener('hashchange', cb)
}
export function useHashLocation() {
  return useSyncExternalStore(subscribe, current, () => '/')
}
export function navigate(to: string, replace = false) {
  if (replace) {
    try {
      history.replaceState(null, '', '#' + to)
    } catch {
      location.hash = to
      return
    }
    window.dispatchEvent(new HashChangeEvent('hashchange'))
  } else location.hash = to
}
export function usePathname() {
  return useHashLocation().split('?')[0]
}
export function useSearchParams() {
  const q = useHashLocation().split('?')[1] ?? ''
  return useMemo(() => new URLSearchParams(q), [q])
}
export const ParamsContext = createContext<Record<string, string>>({})
export function useParams<T = Record<string, string>>() {
  return useContext(ParamsContext) as T
}
export function useRouter() {
  return { push: (p: string) => navigate(p), replace: (p: string) => navigate(p, true), back: () => history.back(), forward: () => history.forward(), refresh: () => {}, prefetch: () => {} }
}
export function redirect(p: string) {
  navigate(p)
}
export function notFound() {
  navigate('/404')
}
