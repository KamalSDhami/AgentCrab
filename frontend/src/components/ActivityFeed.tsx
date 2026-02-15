import React from 'react'
import { ActivityEvent, Agent } from '../api'
import { timeAgo } from '../hooks'
import {
  PlusCircle,
  RefreshCw,
  MessageSquare,
  Trash2,
  Activity,
  Send,
  CheckCircle2,
  XCircle,
  Clock,
} from 'lucide-react'

const EVENT_ICONS: Record<string, React.ReactNode> = {
  'task.created': <PlusCircle size={14} className="text-emerald-400" />,
  'task.updated': <RefreshCw size={14} className="text-blue-400" />,
  'task.deleted': <Trash2 size={14} className="text-rose-400" />,
  'message.sent': <MessageSquare size={14} className="text-indigo-400" />,
  'dispatch.started': <Send size={14} className="text-amber-400" />,
  'dispatch.completed': <CheckCircle2 size={14} className="text-emerald-400" />,
  'dispatch.failed': <XCircle size={14} className="text-rose-400" />,
  'dispatch.timeout': <Clock size={14} className="text-orange-400" />,
}

interface Props {
  activity: ActivityEvent[] | null
  agents?: Agent[] | null
  limit?: number
}

export function ActivityFeed({ activity, agents, limit }: Props) {
  const agentMap = new Map((agents ?? []).map((a) => [a.id, a]))

  if (!activity) {
    return (
      <div className="space-y-2">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="glass-card h-14 animate-pulse" />
        ))}
      </div>
    )
  }

  const items = limit ? activity.slice(0, limit) : activity

  if (items.length === 0) {
    return (
      <div className="text-center py-8 text-slate-600 text-sm">
        No activity yet
      </div>
    )
  }

  return (
    <div className="space-y-1.5">
      {items.map((evt) => (
        <div key={evt.id} className="glass-card px-3 py-2.5 flex items-start gap-3">
          <div className="mt-0.5">
            {EVENT_ICONS[evt.type] ?? <Activity size={14} className="text-slate-500" />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm text-slate-300 leading-snug truncate">
              {evt.message}
            </div>
            <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-600">
              <span>{evt.type}</span>
              {evt.agentId && (
                <>
                  <span>·</span>
                  <span className="text-slate-500">@{agentMap.get(evt.agentId)?.name ?? evt.agentId}</span>
                </>
              )}
              <span>·</span>
              <span>{timeAgo(evt.createdAtMs)}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
