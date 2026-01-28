import { useEffect, useState } from 'react'
import { type BackendEventItem, getEvents } from './useBackend'

export function useEventsPoll(intervalMs = 800) {
  const [latest, setLatest] = useState(0)
  const [items, setItems] = useState<BackendEventItem[]>([])

  useEffect(() => {
    let cancelled = false

    const tick = async () => {
      try {
        const res = await getEvents(latest)
        if (cancelled) return
        if (res.items.length) setItems((prev) => [...prev.slice(-80), ...res.items])
        setLatest(res.latest)
      } catch {
        return
      }
    }

    const id = window.setInterval(tick, intervalMs)
    tick()
    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [intervalMs, latest])

  return items
}

