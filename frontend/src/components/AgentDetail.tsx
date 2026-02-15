import React, { useEffect, useState } from 'react'
import { AgentDetail as AgentDetailType, api } from '../api'
import { timeAgo, fmtTime } from '../hooks'
import { X, FileText, Brain, Heart, Clock } from 'lucide-react'

interface Props {
  agentId: string
  onClose: () => void
}

export function AgentDetail({ agentId, onClose }: Props) {
  const [detail, setDetail] = useState<AgentDetailType | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'soul' | 'memory' | 'heartbeat' | 'agents'>('soul')

  useEffect(() => {
    api.agentDetail(agentId).then(setDetail).catch((e) => setError(e.message))
  }, [agentId])

  const tabs = [
    { id: 'soul' as const, label: 'SOUL', icon: <Brain size={14} /> },
    { id: 'memory' as const, label: 'Working Memory', icon: <FileText size={14} /> },
    { id: 'heartbeat' as const, label: 'Heartbeat', icon: <Heart size={14} /> },
    { id: 'agents' as const, label: 'AGENTS.md', icon: <FileText size={14} /> },
  ]

  const fileMap: Record<string, string> = {
    soul: 'SOUL.md',
    memory: 'memory/WORKING.md',
    heartbeat: 'HEARTBEAT.md',
    agents: 'AGENTS.md',
  }

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

      {/* Panel */}
      <div
        className="relative w-full max-w-2xl h-full glass-panel rounded-none border-l border-slate-700/40 overflow-y-auto animate-slide-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 bg-slate-900/90 backdrop-blur-md px-6 py-4 border-b border-slate-700/30 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-100">
              {detail?.name ?? agentId}
            </h2>
            <p className="text-xs text-slate-500">{detail?.role ?? 'Agent'}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-slate-700/50 transition-colors text-slate-400"
          >
            <X size={18} />
          </button>
        </div>

        {error && (
          <div className="mx-6 mt-4 p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm">
            {error}
          </div>
        )}

        {/* Stats row */}
        {detail && (
          <div className="px-6 py-4 grid grid-cols-3 gap-3">
            <div className="glass-card p-3 text-center">
              <div className="text-lg font-bold text-slate-100">{detail.assignedTaskCount}</div>
              <div className="text-xs text-slate-500">Tasks</div>
            </div>
            <div className="glass-card p-3 text-center">
              <div className="text-lg font-bold text-slate-100">
                {detail.lastHeartbeatAgeSec != null
                  ? `${Math.floor(detail.lastHeartbeatAgeSec / 60)}m`
                  : '—'}
              </div>
              <div className="text-xs text-slate-500">Last Heartbeat</div>
            </div>
            <div className="glass-card p-3 text-center">
              <div className="text-lg font-bold text-slate-100">{detail.derivedStatus}</div>
              <div className="text-xs text-slate-500">Status</div>
            </div>
          </div>
        )}

        {/* Tab bar */}
        <div className="px-6 flex gap-1 border-b border-slate-700/30">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors border-b-2 ${
                activeTab === tab.id
                  ? 'border-indigo-500 text-indigo-300'
                  : 'border-transparent text-slate-500 hover:text-slate-300'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="px-6 py-4">
          {!detail ? (
            <div className="text-slate-500 text-sm">Loading…</div>
          ) : !detail.workspaceExists ? (
            <div className="text-slate-500 text-sm">
              Agent workspace not found on this host.
              <br />
              <span className="text-xs">This is expected in local development.</span>
            </div>
          ) : (
            <pre className="text-xs text-slate-300 whitespace-pre-wrap font-mono leading-relaxed bg-slate-800/30 rounded-lg p-4 border border-slate-700/20 max-h-[60vh] overflow-y-auto">
              {detail.files?.[fileMap[activeTab]] || '(empty)'}
            </pre>
          )}
        </div>
      </div>
    </div>
  )
}
