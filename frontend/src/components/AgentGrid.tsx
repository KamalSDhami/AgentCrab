import React from 'react'
import clsx from 'clsx'
import { Agent, AgentStatus } from '../api'
import { timeAgo } from '../hooks'
import { Wifi, WifiOff, Zap, Clock, HelpCircle } from 'lucide-react'

function statusBadge(status: AgentStatus) {
  const map: Record<string, { cls: string; icon: React.ReactNode; label: string }> = {
    running: { cls: 'badge-running', icon: <Zap size={10} />, label: 'Running' },
    idle: { cls: 'badge-idle', icon: <Clock size={10} />, label: 'Idle' },
    offline: { cls: 'badge-offline', icon: <WifiOff size={10} />, label: 'Offline' },
    unknown: { cls: 'badge-unknown', icon: <HelpCircle size={10} />, label: 'Unknown' },
  }
  const s = map[status] ?? map.unknown!
  return (
    <span className={clsx('badge', s.cls)}>
      {s.icon}
      <span className="ml-1">{s.label}</span>
    </span>
  )
}

// Agent avatar colors by name hash
const AVATAR_COLORS = [
  'bg-indigo-600', 'bg-emerald-600', 'bg-rose-600', 'bg-amber-600',
  'bg-cyan-600', 'bg-violet-600', 'bg-pink-600', 'bg-teal-600',
  'bg-orange-600', 'bg-sky-600',
]

function avatarColor(name: string) {
  let hash = 0
  for (const c of name) hash = (hash * 31 + c.charCodeAt(0)) | 0
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

interface Props {
  agents: Agent[] | null
  onSelect: (id: string) => void
}

export function AgentGrid({ agents, onSelect }: Props) {
  if (!agents) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="glass-card h-28 animate-pulse" />
        ))}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
      {agents.map((a) => (
        <div
          key={a.id}
          onClick={() => onSelect(a.id)}
          className="glass-card-interactive p-4"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div
                className={clsx(
                  'w-9 h-9 rounded-lg flex items-center justify-center text-white text-sm font-bold',
                  avatarColor(a.name),
                )}
              >
                {a.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <div className="font-semibold text-sm text-slate-100">{a.name}</div>
                <div className="text-xs text-slate-500 mt-0.5">{a.role}</div>
              </div>
            </div>
            {statusBadge(a.derivedStatus)}
          </div>

          <div className="mt-3 flex items-center gap-3 text-xs text-slate-500">
            <span>
              {a.assignedTaskCount > 0
                ? `${a.assignedTaskCount} task${a.assignedTaskCount > 1 ? 's' : ''}`
                : 'No tasks'}
            </span>
            <span className="text-slate-700">·</span>
            <span>
              <Wifi size={10} className="inline mr-1" />
              {timeAgo(a.lastHeartbeatMs)}
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}
