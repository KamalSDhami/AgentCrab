import React from 'react'
import { DispatchRecord } from '../api'
import { timeAgo } from '../hooks'
import {
  Send,
  CheckCircle2,
  XCircle,
  Clock,
  RotateCcw,
  AlertTriangle,
  Loader2,
} from 'lucide-react'

const STATUS_CONFIG: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
  pending: { icon: <Clock size={14} />, color: 'text-slate-400', label: 'Pending' },
  dispatching: { icon: <Loader2 size={14} className="animate-spin" />, color: 'text-blue-400', label: 'Dispatching' },
  dispatched: { icon: <Send size={14} />, color: 'text-emerald-400', label: 'Dispatched' },
  delivered: { icon: <CheckCircle2 size={14} />, color: 'text-emerald-400', label: 'Delivered' },
  claimed: { icon: <CheckCircle2 size={14} />, color: 'text-indigo-400', label: 'Claimed' },
  executing: { icon: <Loader2 size={14} className="animate-spin" />, color: 'text-amber-400', label: 'Executing' },
  completed: { icon: <CheckCircle2 size={14} />, color: 'text-emerald-400', label: 'Completed' },
  failed: { icon: <XCircle size={14} />, color: 'text-rose-400', label: 'Failed' },
  timeout: { icon: <AlertTriangle size={14} />, color: 'text-amber-400', label: 'Timeout' },
}

interface Props {
  logs: DispatchRecord[] | null
  onRetry?: (taskId: string, agentId: string) => void
  showTask?: boolean
}

export function DispatchLog({ logs, onRetry, showTask = true }: Props) {
  if (!logs) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="glass-card h-16 animate-pulse" />
        ))}
      </div>
    )
  }

  if (logs.length === 0) {
    return (
      <div className="text-center py-8 text-slate-600 text-sm">
        No dispatch activity yet. Create a task and assign it to an agent.
      </div>
    )
  }

  return (
    <div className="space-y-1.5">
      {logs.map((rec) => {
        const cfg = STATUS_CONFIG[rec.status] ?? STATUS_CONFIG.pending
        return (
          <div key={rec.id} className="glass-card px-3 py-2.5 flex items-start gap-3">
            <div className={`mt-0.5 ${cfg.color}`}>
              {cfg.icon}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-xs font-semibold uppercase ${cfg.color}`}>
                  {cfg.label}
                </span>
                <span className="badge badge-idle text-[10px]">@{rec.agentId}</span>
                {rec.attempt > 1 && (
                  <span className="text-[10px] text-amber-400">
                    attempt #{rec.attempt}
                  </span>
                )}
              </div>
              {showTask && (
                <div className="text-xs text-slate-500 mt-0.5 truncate">
                  Task: {rec.taskId}
                </div>
              )}
              {rec.error && (
                <div className="text-xs text-rose-400 mt-1 bg-rose-500/10 px-2 py-1 rounded">
                  {rec.error}
                </div>
              )}
              {rec.response && rec.status === 'dispatched' && (
                <div className="text-xs text-emerald-400/70 mt-0.5">
                  ✓ {rec.response}
                </div>
              )}
            </div>
            <div className="text-right shrink-0 flex flex-col items-end gap-1">
              <span className="text-[11px] text-slate-600">
                {timeAgo(rec.dispatchedAtMs || rec.createdAtMs)}
              </span>
              {rec.status === 'failed' && onRetry && (
                <button
                  onClick={() => onRetry(rec.taskId, rec.agentId)}
                  className="flex items-center gap-1 text-[10px] text-indigo-400 hover:text-indigo-300 transition-colors"
                >
                  <RotateCcw size={10} /> Retry
                </button>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
