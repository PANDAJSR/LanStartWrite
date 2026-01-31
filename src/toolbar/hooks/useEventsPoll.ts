import { useEffect, useRef, useState } from 'react'
import { deleteUiStateKey, getEvents, getUiState, postCommand, putUiStateKey, type BackendEventItem } from './useBackend'
import { usePersistedState } from './usePersistedState'
import { APPEARANCE_KV_KEY, APPEARANCE_UI_STATE_KEY, UI_STATE_APP_WINDOW_ID } from '../utils/constants'

export function useEventsPoll(intervalMs = 800) {
  const [items, setItems] = useState<BackendEventItem[]>([])
  const latestRef = useRef(0)

  useEffect(() => {
    let cancelled = false
    const api = window.lanstart

    const tick = async () => {
      try {
        const res = await getEvents(latestRef.current)
        if (cancelled) return
        if (res.items.length) setItems((prev) => [...prev.slice(-80), ...res.items])
        latestRef.current = res.latest
      } catch {
        return
      }
    }

    if (api?.onEvent) {
      const unsubscribe = api.onEvent((item) => {
        if (cancelled) return
        if (!item || typeof item.id !== 'number') return
        if (item.id <= latestRef.current) return
        latestRef.current = item.id
        setItems((prev) => [...prev.slice(-80), item])
      })
      tick()
      return () => {
        cancelled = true
        unsubscribe()
      }
    }

    const id = window.setInterval(tick, intervalMs)
    tick()
    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [intervalMs])

  return items
}

function coerceString(v: unknown): string {
  return typeof v === 'string' ? v : ''
}

export function useUiStateBus(windowId: string, options?: { intervalMs?: number }) {
  const intervalMs = options?.intervalMs ?? 600
  const latestRef = useRef(0)
  const [state, setState] = useState<Record<string, unknown>>({})

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const initial = await getUiState(windowId)
        if (cancelled) return
        setState(initial)
      } catch {
        return
      }
    })()
    return () => {
      cancelled = true
    }
  }, [windowId])

  useEffect(() => {
    let cancelled = false
    const api = window.lanstart

    const tick = async () => {
      try {
        const res = await getEvents(latestRef.current)
        if (cancelled) return
        latestRef.current = res.latest
        if (!res.items.length) return

        const nextPatches: Array<(prev: Record<string, unknown>) => Record<string, unknown>> = []

        for (const item of res.items) {
          if (item.type !== 'UI_STATE_PUT' && item.type !== 'UI_STATE_DEL') continue
          const payload = (item.payload ?? {}) as any
          if (coerceString(payload.windowId) !== windowId) continue
          const key = coerceString(payload.key)
          if (!key) continue

          if (item.type === 'UI_STATE_PUT') {
            const value = payload.value as unknown
            nextPatches.push((prev) => ({ ...prev, [key]: value }))
          } else {
            nextPatches.push((prev) => {
              if (!(key in prev)) return prev
              const { [key]: _drop, ...rest } = prev
              return rest
            })
          }
        }

        if (!nextPatches.length) return
        setState((prev) => nextPatches.reduce((acc, patch) => patch(acc), prev))
      } catch {
        return
      }
    }

    const applyItems = (items: BackendEventItem[]) => {
      if (!items.length) return
      const nextPatches: Array<(prev: Record<string, unknown>) => Record<string, unknown>> = []

      for (const item of items) {
        if (item.type !== 'UI_STATE_PUT' && item.type !== 'UI_STATE_DEL') continue
        const payload = (item.payload ?? {}) as any
        if (coerceString(payload.windowId) !== windowId) continue
        const key = coerceString(payload.key)
        if (!key) continue

        if (item.type === 'UI_STATE_PUT') {
          const value = payload.value as unknown
          nextPatches.push((prev) => ({ ...prev, [key]: value }))
        } else {
          nextPatches.push((prev) => {
            if (!(key in prev)) return prev
            const { [key]: _drop, ...rest } = prev
            return rest
          })
        }
      }

      if (!nextPatches.length) return
      setState((prev) => nextPatches.reduce((acc, patch) => patch(acc), prev))
    }

    if (api?.onEvent) {
      const unsubscribe = api.onEvent((item) => {
        if (cancelled) return
        if (!item || typeof item.id !== 'number') return
        if (item.id <= latestRef.current) return
        latestRef.current = item.id
        applyItems([item])
      })

      tick()
      return () => {
        cancelled = true
        unsubscribe()
      }
    }

    const id = window.setInterval(tick, intervalMs)
    tick()
    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [intervalMs, windowId])

  const setKey = async (key: string, value: unknown) => {
    await putUiStateKey(windowId, key, value)
    setState((prev) => ({ ...prev, [key]: value }))
  }

  const deleteKey = async (key: string) => {
    await deleteUiStateKey(windowId, key)
    setState((prev) => {
      if (!(key in prev)) return prev
      const { [key]: _drop, ...rest } = prev
      return rest
    })
  }

  const refresh = async () => {
    const latest = await getUiState(windowId)
    setState(latest)
  }

  return { state, setKey, deleteKey, refresh }
}

export type Appearance = 'light' | 'dark'

function isAppearance(v: unknown): v is Appearance {
  return v === 'light' || v === 'dark'
}

export function useAppAppearance() {
  const [appearance, setAppearanceState] = usePersistedState<Appearance>(APPEARANCE_KV_KEY, 'light', {
    validate: isAppearance
  })
  const bus = useUiStateBus(UI_STATE_APP_WINDOW_ID)

  const busAppearanceRaw = bus.state[APPEARANCE_UI_STATE_KEY]
  const busAppearance: Appearance | undefined = isAppearance(busAppearanceRaw) ? busAppearanceRaw : undefined

  useEffect(() => {
    if (!busAppearance) return
    if (busAppearance === appearance) return
    setAppearanceState(busAppearance)
  }, [appearance, busAppearance, setAppearanceState])

  useEffect(() => {
    try {
      document.documentElement.setAttribute('data-appearance', appearance)
    } catch {}
  }, [appearance])

  const setAppearance = (next: Appearance) => {
    if (next === appearance) return
    setAppearanceState(next)
    postCommand('set-appearance', { appearance: next }).catch(() => undefined)
  }

  return { appearance, setAppearance }
}
