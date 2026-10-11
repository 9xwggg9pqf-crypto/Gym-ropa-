// Acceso a las capacidades del visor de claude.ai (db, user, sample, downloads).
/* eslint-disable @typescript-eslint/no-explicit-any */
type Claude = { use(name: string): Promise<any> }
const claude = (): Claude | null => ((window as any).claude as Claude) ?? null

const memo: Record<string, Promise<any>> = {}
export function cap<T = any>(name: string): Promise<T | null> {
  if (!memo[name]) memo[name] = claude() ? claude()!.use(name).catch(() => null) : Promise.resolve(null)
  return memo[name]
}

let uidPromise: Promise<string | null> | null = null
export function userId(): Promise<string | null> {
  if (!uidPromise)
    uidPromise = cap('user').then(async (u) => {
      if (!u) return null
      try {
        return (await u.id()) ?? null
      } catch {
        return null
      }
    })
  return uidPromise
}
