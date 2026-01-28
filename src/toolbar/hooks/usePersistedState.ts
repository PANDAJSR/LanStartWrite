import { useEffect, useRef, useState } from 'react'
import { getKv, putKv } from './useBackend'

export function usePersistedState<T>(
  key: string,
  defaultValue: T,
  options?: { validate?: (value: unknown) => value is T }
) {
  const [value, setValue] = useState<T>(defaultValue)
  const didHydrate = useRef(false)

  useEffect(() => {
    let cancelled = false

    const run = async () => {
      try {
        const loaded = await getKv<unknown>(key)
        if (cancelled) return
        if (loaded === undefined) return
        if (options?.validate && !options.validate(loaded)) return
        setValue(loaded as T)
      } catch {
        return
      } finally {
        if (!cancelled) didHydrate.current = true
      }
    }

    run()
    return () => {
      cancelled = true
    }
  }, [key])

  useEffect(() => {
    if (!didHydrate.current) return

    const id = window.setTimeout(() => {
      putKv(key, value).catch(() => undefined)
    }, 250)

    return () => window.clearTimeout(id)
  }, [key, value])

  return [value, setValue] as const
}
