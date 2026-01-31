import { useCallback, useEffect, useState } from 'react'

function safeParse<T>(raw: string | null): T | undefined {
  if (!raw) return undefined
  try {
    return JSON.parse(raw) as T
  } catch {
    return undefined
  }
}

/**
 * Minimal localStorage-backed state hook.
 * - Syncs to localStorage on set
 * - Listens to "storage" events (multi-tab)
 */
export function useLocalStorageState<T>(
  key: string,
  initialValue: T,
): readonly [T, (next: T | ((prev: T) => T)) => void] {
  const [value, setValue] = useState<T>(() => {
    const parsed = safeParse<T>(localStorage.getItem(key))
    return parsed ?? initialValue
  })

  // Keep in sync when key changes.
  useEffect(() => {
    const parsed = safeParse<T>(localStorage.getItem(key))
    setValue(parsed ?? initialValue)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  // Multi-tab sync.
  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key !== key) return
      const parsed = safeParse<T>(e.newValue)
      setValue(parsed ?? initialValue)
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [key, initialValue])

  const setAndPersist = useCallback(
    (next: T | ((prev: T) => T)) => {
      setValue(prev => {
        const resolved = typeof next === 'function' ? (next as (p: T) => T)(prev) : next
        localStorage.setItem(key, JSON.stringify(resolved))
        return resolved
      })
    },
    [key],
  )

  return [value, setAndPersist] as const
}
