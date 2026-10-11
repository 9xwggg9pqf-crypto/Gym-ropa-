'use client'
import { ChevronLeft, ChevronRight, List, Pause, Play, RotateCcw, Sun, SunDim, Thermometer, Volume2, VolumeX, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { resolveFood } from '@/lib/nutrition/catalog'
import { scaleIngredients } from '@/lib/nutrition/compute'
import { formatIngredientAmount } from '@/lib/nutrition/units'
import type { Recipe } from '@/lib/nutrition/types'
import { Button, cx, IconButton, Sheet, Stepper } from '@/components/ui'

function fmtTime(s: number) {
  const m = Math.floor(s / 60)
  const r = s % 60
  return `${m}:${String(r).padStart(2, '0')}`
}

function beep() {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    const ctx = new Ctx()
    ;[0, 0.35, 0.7].forEach((t) => {
      const o = ctx.createOscillator()
      const g = ctx.createGain()
      o.frequency.value = 880
      o.connect(g)
      g.connect(ctx.destination)
      g.gain.setValueAtTime(0.25, ctx.currentTime + t)
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.3)
      o.start(ctx.currentTime + t)
      o.stop(ctx.currentTime + t + 0.3)
    })
  } catch {
    /* sin audio disponible */
  }
  navigator.vibrate?.([300, 150, 300])
}

export function CookMode({ recipe, exitHref }: { recipe: Recipe; exitHref: string }) {
  const [i, setI] = useState(0)
  const [servings, setServings] = useState(recipe.servings)
  const [showIngredients, setShowIngredients] = useState(false)
  const [voice, setVoice] = useState(false)
  const [wake, setWake] = useState<'off' | 'on' | 'unsupported'>('off')
  const wakeRef = useRef<WakeLockSentinel | null>(null)
  const [timers, setTimers] = useState<Record<number, { left: number; running: boolean }>>({})
  const step = recipe.steps[i]
  const total = recipe.steps.length
  const ingredients = scaleIngredients(recipe.ingredients, recipe.servings, servings)

  const speak = useCallback((text: string) => {
    if (!('speechSynthesis' in window)) return
    window.speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance(text)
    u.lang = 'es-ES'
    u.rate = 0.95
    const v = window.speechSynthesis.getVoices().find((x) => x.lang.startsWith('es'))
    if (v) u.voice = v
    window.speechSynthesis.speak(u)
  }, [])

  useEffect(() => {
    if (voice && step) speak(`Paso ${i + 1}. ${step.text}`)
  }, [i, voice, step, speak])
  useEffect(() => () => window.speechSynthesis?.cancel(), [])

  // Temporizadores: cuenta atrás por paso.
  useEffect(() => {
    const t = setInterval(() => {
      setTimers((prev) => {
        let changed = false
        const next = { ...prev }
        for (const [k, v] of Object.entries(prev)) {
          if (v.running && v.left > 0) {
            next[Number(k)] = { ...v, left: v.left - 1 }
            changed = true
            if (v.left - 1 === 0) {
              next[Number(k)].running = false
              beep()
              if (voice) speak(`Temporizador del paso ${Number(k) + 1} terminado`)
            }
          }
        }
        return changed ? next : prev
      })
    }, 1000)
    return () => clearInterval(t)
  }, [voice, speak])

  // Pantalla siempre encendida (si el navegador lo permite).
  async function toggleWake() {
    if (!('wakeLock' in navigator)) return setWake('unsupported')
    if (wakeRef.current) {
      await wakeRef.current.release().catch(() => {})
      wakeRef.current = null
      return setWake('off')
    }
    try {
      wakeRef.current = await navigator.wakeLock.request('screen')
      setWake('on')
      wakeRef.current.addEventListener('release', () => setWake('off'))
    } catch {
      setWake('unsupported')
    }
  }
  useEffect(() => {
    const onVis = async () => {
      if (document.visibilityState === 'visible' && wake === 'on' && !wakeRef.current) {
        wakeRef.current = await navigator.wakeLock.request('screen').catch(() => null)
      }
    }
    document.addEventListener('visibilitychange', onVis)
    return () => {
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [wake])
  useEffect(() => () => void wakeRef.current?.release().catch(() => {}), [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return
      if (e.key === 'ArrowRight') setI((x) => Math.min(total - 1, x + 1))
      if (e.key === 'ArrowLeft') setI((x) => Math.max(0, x - 1))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [total])

  const timer = step?.timerSeconds ? timers[i] ?? { left: step.timerSeconds, running: false } : null
  const activeTimers = Object.entries(timers).filter(([k, v]) => Number(k) !== i && (v.running || v.left === 0))

  return (
    <div className="safe-top safe-bottom fixed inset-0 z-50 flex flex-col bg-bg">
      <header className="flex items-center justify-between gap-2 border-b border-line px-3 py-2">
        <a href={exitHref} className="flex h-11 w-11 items-center justify-center rounded-xl hover:bg-sunken" aria-label="Salir del modo cocina">
          <X className="h-6 w-6" aria-hidden />
        </a>
        <p className="min-w-0 flex-1 truncate text-center font-display text-sm font-semibold">{recipe.title}</p>
        <div className="flex">
          <IconButton label={voice ? 'Desactivar lectura en voz alta' : 'Leer los pasos en voz alta'} aria-pressed={voice} onClick={() => { setVoice((v) => !v); if (voice) window.speechSynthesis?.cancel() }}>
            {voice ? <Volume2 className="h-6 w-6 text-brand-ink" aria-hidden /> : <VolumeX className="h-6 w-6" aria-hidden />}
          </IconButton>
          <IconButton label={wake === 'on' ? 'Permitir que la pantalla se apague' : 'Mantener la pantalla encendida'} aria-pressed={wake === 'on'} onClick={toggleWake}>
            {wake === 'on' ? <Sun className="h-6 w-6 text-saffron" aria-hidden /> : <SunDim className="h-6 w-6" aria-hidden />}
          </IconButton>
          <IconButton label="Ver ingredientes" onClick={() => setShowIngredients(true)}>
            <List className="h-6 w-6" aria-hidden />
          </IconButton>
        </div>
      </header>
      {wake === 'unsupported' && <p className="bg-warn/10 px-4 py-1.5 text-center text-xs">Este navegador no permite mantener la pantalla encendida.</p>}

      <div className="h-1.5 bg-sunken" role="progressbar" aria-valuemin={1} aria-valuemax={total} aria-valuenow={i + 1} aria-label="Progreso de la receta">
        <div className="h-full bg-saffron transition-all" style={{ width: `${((i + 1) / total) * 100}%` }} />
      </div>

      <main className="flex flex-1 flex-col gap-6 overflow-y-auto px-5 py-6 sm:px-10">
        <p className="label-caps text-brand-ink">
          Paso {i + 1} de {total}
        </p>
        <p className="max-w-3xl text-2xl font-medium leading-snug sm:text-3xl" aria-live="polite">
          {step?.text}
        </p>
        <div className="flex flex-wrap gap-3">
          {step?.temperatureC ? (
            <span className="inline-flex items-center gap-2 rounded-2xl bg-saffron/20 px-4 py-2 text-lg font-semibold">
              <Thermometer className="h-5 w-5" aria-hidden /> {step.temperatureC} °C
            </span>
          ) : null}
          {timer && (
            <div className="flex items-center gap-2 rounded-2xl border-2 border-brand/40 bg-surface px-3 py-2">
              <span className={cx('num font-display text-3xl font-semibold', timer.left === 0 && 'text-ok')} role="timer" aria-live="off">
                {fmtTime(timer.left)}
              </span>
              <IconButton label={timer.running ? 'Pausar temporizador' : 'Iniciar temporizador'} onClick={() => setTimers((t) => ({ ...t, [i]: { left: timer.left === 0 ? step!.timerSeconds! : timer.left, running: !timer.running } }))}>
                {timer.running ? <Pause className="h-6 w-6" aria-hidden /> : <Play className="h-6 w-6" aria-hidden />}
              </IconButton>
              <IconButton label="Reiniciar temporizador" onClick={() => setTimers((t) => ({ ...t, [i]: { left: step!.timerSeconds!, running: false } }))}>
                <RotateCcw className="h-5 w-5" aria-hidden />
              </IconButton>
            </div>
          )}
        </div>
        {activeTimers.length > 0 && (
          <div className="flex flex-wrap gap-2 text-sm">
            {activeTimers.map(([k, v]) => (
              <button key={k} type="button" onClick={() => setI(Number(k))} className={cx('num rounded-full px-3 py-1.5 font-semibold', v.left === 0 ? 'bg-ok/15 text-ok' : 'bg-sunken')}>
                Paso {Number(k) + 1}: {v.left === 0 ? '¡listo!' : fmtTime(v.left)}
              </button>
            ))}
          </div>
        )}
        <div className="flex flex-col gap-1 rounded-2xl bg-sunken p-4">
          <p className="label-caps text-muted">Ingredientes ({servings} {servings === 1 ? 'ración' : 'raciones'})</p>
          <ul className="num grid gap-x-6 gap-y-1 text-[15px] sm:grid-cols-2">
            {ingredients.map((ing) => (
              <li key={ing.id}>
                <span className="font-semibold">{formatIngredientAmount(ing.quantity, ing.unit, resolveFood(ing.foodKey, ing.inlineFood)?.portions.unit?.name)}</span> {ing.name}
              </li>
            ))}
          </ul>
        </div>
      </main>

      <footer className="grid grid-cols-2 gap-3 border-t border-line p-3">
        <Button size="lg" variant="outline" onClick={() => setI((x) => Math.max(0, x - 1))} disabled={i === 0} icon={<ChevronLeft className="h-6 w-6" aria-hidden />}>
          Anterior
        </Button>
        {i < total - 1 ? (
          <Button size="lg" variant="primary" onClick={() => setI((x) => Math.min(total - 1, x + 1))}>
            Siguiente <ChevronRight className="h-6 w-6" aria-hidden />
          </Button>
        ) : (
          <a href={exitHref} className="inline-flex h-14 items-center justify-center rounded-xl bg-brand px-6 font-semibold text-white">
            ¡Terminado!
          </a>
        )}
      </footer>

      <Sheet open={showIngredients} onClose={() => setShowIngredients(false)} title="Ingredientes">
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-semibold">Raciones</span>
            <Stepper label="raciones" value={servings} min={1} max={50} onChange={(v) => setServings(Math.max(1, Math.round(v)))} />
          </div>
          <ul className="num flex flex-col divide-y divide-line">
            {ingredients.map((ing) => (
              <li key={ing.id} className="flex justify-between gap-3 py-2 text-[15px]">
                <span>{ing.name}</span>
                <span className="font-semibold">{formatIngredientAmount(ing.quantity, ing.unit, resolveFood(ing.foodKey, ing.inlineFood)?.portions.unit?.name)}</span>
              </li>
            ))}
          </ul>
        </div>
      </Sheet>
    </div>
  )
}
