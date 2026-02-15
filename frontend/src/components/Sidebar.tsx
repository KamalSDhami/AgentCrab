import React from 'react'
import clsx from 'clsx'
import {
  LayoutDashboard,
  Users,
  KanbanSquare,
  Activity,
  Radio,
  Send,
  Terminal,
  BrainCircuit,
} from 'lucide-react'

export type Page = 'dashboard' | 'agents' | 'tasks' | 'activity' | 'cron' | 'dispatch' | 'events' | 'supervisor'

const NAV: { id: Page; label: string; icon: React.ReactNode }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={18} /> },
  { id: 'agents', label: 'Agents', icon: <Users size={18} /> },
  { id: 'tasks', label: 'Tasks', icon: <KanbanSquare size={18} /> },
  { id: 'supervisor', label: 'Supervisor', icon: <BrainCircuit size={18} /> },
  { id: 'dispatch', label: 'Dispatch', icon: <Send size={18} /> },
  { id: 'activity', label: 'Activity', icon: <Activity size={18} /> },
  { id: 'events', label: 'Event Stream', icon: <Terminal size={18} /> },
  { id: 'cron', label: 'Heartbeats', icon: <Radio size={18} /> },
]

interface Props {
  current: Page
  onChange: (p: Page) => void
}

export function Sidebar({ current, onChange }: Props) {
  return (
    <aside className="fixed left-0 top-0 bottom-0 w-56 glass-panel rounded-none border-r border-slate-700/40 flex flex-col z-30">
      {/* Logo */}
      <div className="px-4 py-5 border-b border-slate-700/30">
        <div className="flex items-center gap-2">
          <span className="text-xl">🦀</span>
          <div>
            <h1 className="text-sm font-bold tracking-wide text-slate-100">AgentCrab</h1>
            <p className="text-[10px] text-slate-500 uppercase tracking-widest">Mission Control</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
        {NAV.map((item) => (
          <button
            key={item.id}
            onClick={() => onChange(item.id)}
            className={clsx(
              'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-150',
              current === item.id
                ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/20 shadow-sm shadow-indigo-500/10'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/40 border border-transparent',
            )}
          >
            {item.icon}
            {item.label}
          </button>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-slate-700/30">
        <div className="text-[10px] text-slate-600">
          AgentCrab v2.2
        </div>
      </div>
    </aside>
  )
}
