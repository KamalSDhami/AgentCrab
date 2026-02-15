import { useCallback, useEffect, useRef, useState } from 'react'

/* ── useInterval ─────────────────────────────────────────────────────────── */
export function useInterval(callback: () => void, ms: number) {
  const saved = useRef(callback)
  useEffect(() => { saved.current = callback }, [callback])
  useEffect(() => {
    const id = setInterval(() => saved.current(), ms)
    return () => clearInterval(id)
  }, [ms])
}

/* ── useFetch — lightweight data fetching with auto-refresh ──────────────── */
export function useFetch<T>(
  fetcher: () => Promise<T>,
  deps: unknown[] = [],
  intervalMs = 15_000,
) {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const result = await fetcher()
      setData(result)
      setError(null)
    } catch (e: any) {
      setError(e?.message ?? String(e))
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  useEffect(() => { load() }, [load])
  useInterval(load, intervalMs)

  return { data, error, loading, refresh: load }
}

/* ── useSSE — subscribe to server-sent events ────────────────────────────── */
export function useSSE(onEvent: (type: string, data: any) => void) {
  const callbackRef = useRef(onEvent)
  useEffect(() => { callbackRef.current = onEvent }, [onEvent])

  useEffect(() => {
    let es: EventSource | null = null
    let retryTimeout: ReturnType<typeof setTimeout>

    function connect() {
      es = new EventSource('/api/streams/events')

      es.addEventListener('task.created', (e) => {
        callbackRef.current('task.created', JSON.parse(e.data))
      })
      es.addEventListener('task.updated', (e) => {
        callbackRef.current('task.updated', JSON.parse(e.data))
      })
      es.addEventListener('task.deleted', (e) => {
        callbackRef.current('task.deleted', JSON.parse(e.data))
      })

      es.onerror = () => {
        es?.close()
        retryTimeout = setTimeout(connect, 5000)
      }
    }

    connect()
    return () => {
      es?.close()
      clearTimeout(retryTimeout)
    }
  }, [])
}

/* ── Formatting helpers ───────────────────────────────────────────────────── */
export function timeAgo(ms: number | null | undefined): string {
  if (!ms) return '—'
  const sec = Math.floor((Date.now() - ms) / 1000)
  if (sec < 60) return `${sec}s ago`
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`
  return `${Math.floor(sec / 86400)}d ago`
}

export function fmtTime(ms: number | null | undefined): string {
  if (!ms) return '—'
  return new Date(ms).toLocaleString()
}
