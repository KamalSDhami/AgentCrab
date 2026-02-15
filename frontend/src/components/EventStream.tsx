import React, { useEffect, useRef, useState } from 'react'
import { Radio, Pause, Play, Trash2 } from 'lucide-react'
import { timeAgo } from '../hooks'

interface SSEEvent {
  id: string
  type: string
  data: any
  receivedAt: number
}

export function EventStream() {
  const [events, setEvents] = useState<SSEEvent[]>([])
  const [paused, setPaused] = useState(false)
  const [connected, setConnected] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const pausedRef = useRef(paused)
  pausedRef.current = paused

  useEffect(() => {
    let es: EventSource | null = null
    let retryTimeout: ReturnType<typeof setTimeout>

    function connect() {
      es = new EventSource('/api/streams/events')

      es.onopen = () => setConnected(true)
      es.onerror = () => {
        setConnected(false)
        es?.close()
        retryTimeout = setTimeout(connect, 5000)
      }

      // Listen to all named events
      const types = [
        'task.created', 'task.updated', 'task.deleted',
        'dispatch.started', 'dispatch.completed', 'dispatch.failed',
        'dispatch.timeout', 'message.sent',
      ]

      for (const type of types) {
        es.addEventListener(type, (e) => {
          if (pausedRef.current) return
          try {
            const data = JSON.parse(e.data)
            setEvents((prev) => {
              const next = [...prev, {
                id: e.lastEventId || `${Date.now()}-${Math.random()}`,
                type,
                data,
                receivedAt: Date.now(),
              }]
              return next.slice(-200) // keep last 200
            })
          } catch {}
        })
      }
    }

    connect()
    return () => {
      es?.close()
      clearTimeout(retryTimeout)
    }
  }, [])

  // Auto-scroll
  useEffect(() => {
    if (!paused && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [events, paused])

  const typeColors: Record<string, string> = {
    'task.created': 'text-emerald-400',
    'task.updated': 'text-blue-400',
    'task.deleted': 'text-rose-400',
    'dispatch.started': 'text-amber-400',
    'dispatch.completed': 'text-emerald-400',
    'dispatch.failed': 'text-rose-400',
    'dispatch.timeout': 'text-amber-400',
    'message.sent': 'text-indigo-400',
  }

  return (
    <div className="glass-panel flex flex-col h-[600px]">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-700/30 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Radio size={16} className={connected ? 'text-emerald-400' : 'text-rose-400'} />
          <h3 className="text-sm font-bold text-slate-200">Event Stream</h3>
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
            connected
              ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25'
              : 'bg-rose-500/15 text-rose-400 border border-rose-500/25'
          }`}>
            {connected ? 'Connected' : 'Disconnected'}
          </span>
          <span className="text-[10px] text-slate-600">{events.length} events</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setPaused(!paused)}
            className="p-1.5 rounded-lg hover:bg-slate-700/50 text-slate-400 transition-colors"
            title={paused ? 'Resume' : 'Pause'}
          >
            {paused ? <Play size={14} /> : <Pause size={14} />}
          </button>
          <button
            onClick={() => setEvents([])}
            className="p-1.5 rounded-lg hover:bg-slate-700/50 text-slate-400 transition-colors"
            title="Clear"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* Events */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-2 space-y-0.5 font-mono text-xs">
        {events.length === 0 && (
          <div className="text-center py-12 text-slate-600">
            Waiting for events…
          </div>
        )}
        {events.map((evt) => (
          <div key={evt.id} className="flex items-start gap-2 py-0.5 hover:bg-slate-800/30 px-1 rounded">
            <span className="text-slate-700 shrink-0 w-16">
              {new Date(evt.receivedAt).toLocaleTimeString()}
            </span>
            <span className={`shrink-0 w-36 font-medium ${typeColors[evt.type] ?? 'text-slate-400'}`}>
              {evt.type}
            </span>
            <span className="text-slate-400 truncate">
              {typeof evt.data === 'object'
                ? evt.data.title || evt.data.taskId || evt.data.agentId || JSON.stringify(evt.data).slice(0, 120)
                : String(evt.data).slice(0, 120)
              }
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
