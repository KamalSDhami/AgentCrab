import React from 'react'
import { Overview } from '../api'
import {
  Users,
  Zap,
  WifiOff,
  ListChecks,
  Loader,
  CheckCircle2,
  Clock,
} from 'lucide-react'

interface Props {
  overview: Overview | null
}

function Stat({
  icon,
  label,
  value,
  accent,
}: {
  icon: React.ReactNode
  label: string
  value: string | number
  accent?: string
}) {
  return (
    <div className="stat-card">
      <div className="flex items-center gap-2 text-slate-500">
        {icon}
        <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
      </div>
      <div className={`text-2xl font-bold mt-1 ${accent ?? 'text-slate-100'}`}>
        {value}
      </div>
    </div>
  )
}

export function StatsCards({ overview }: Props) {
  if (!overview) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="stat-card animate-pulse h-20" />
        ))}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <Stat
        icon={<Users size={14} />}
        label="Total Agents"
        value={overview.agents.total}
      />
      <Stat
        icon={<Zap size={14} />}
        label="Online"
        value={overview.agents.online}
        accent="text-emerald-400"
      />
      <Stat
        icon={<Loader size={14} />}
        label="Tasks Pending"
        value={overview.tasks.pending}
        accent="text-amber-400"
      />
      <Stat
        icon={<CheckCircle2 size={14} />}
        label="Completed"
        value={overview.tasks.completed}
        accent="text-indigo-400"
      />
    </div>
  )
}
