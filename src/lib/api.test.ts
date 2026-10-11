import { describe, expect, it, vi } from 'vitest'

const adminRpc = vi.fn().mockResolvedValue({ error: null })
vi.mock('@/lib/supabase/server', () => ({ createSupabaseAdmin: () => ({ rpc: adminRpc }), getSessionUser: vi.fn() }))
const { withQuota } = await import('./api')
const { AIError } = await import('./ai/client')

function ctx(quota: unknown) {
  return { user: { id: 'u1' }, supabase: { rpc: vi.fn().mockResolvedValue({ data: quota, error: null }) } } as never
}

describe('cuotas y fallos del servicio (Caso I)', () => {
  it('devuelve la cuota y un error claro si la IA falla', async () => {
    const res = await withQuota(ctx({ allowed: true, event_id: 42, plan: 'free', used: 1, limit: 10 }), 'scan', async () => {
      throw new AIError('unavailable', 'El servicio de IA no responde', true, 503)
    })
    expect(res.status).toBe(503)
    const body = await res.json()
    expect(body.error).toMatchObject({ code: 'unavailable', retryable: true })
    expect(body.items).toBeUndefined()
    expect(adminRpc).toHaveBeenCalledWith('release_quota', { p_event_id: 42 })
  })
  it('bloquea al superar la cuota sin llamar a la IA', async () => {
    const fn = vi.fn()
    const res = await withQuota(ctx({ allowed: false, reason: 'quota', plan: 'free', used: 10, limit: 10 }), 'scan', fn)
    expect(res.status).toBe(402)
    expect(fn).not.toHaveBeenCalled()
  })
  it('aplica el límite por minuto', async () => {
    const res = await withQuota(ctx({ allowed: false, reason: 'rate', plan: 'free', used: 3, limit: 10 }), 'generate', vi.fn())
    expect(res.status).toBe(429)
  })
  it('registra tokens consumidos cuando todo va bien', async () => {
    adminRpc.mockClear()
    const res = await withQuota(ctx({ allowed: true, event_id: 7, plan: 'free', used: 2, limit: 10 }), 'scan', async () => ({ result: { ok: 1 }, usage: { model: 'm', inputTokens: 10, outputTokens: 5 } }))
    expect(res.status).toBe(200)
    expect(adminRpc).toHaveBeenCalledWith('record_usage_tokens', { p_event_id: 7, p_model: 'm', p_in: 10, p_out: 5 })
  })
})
