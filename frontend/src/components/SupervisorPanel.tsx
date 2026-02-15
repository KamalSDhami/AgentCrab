import React, { useEffect, useState } from 'react'
import { api, DelegationRecord } from '../api'
import {
  BrainCircuit, GitBranch, Users, Activity, RefreshCw,
  ChevronDown, ChevronRight, Code2,
} from 'lucide-react'
import clsx from 'clsx'

/* ── Types for supervisor endpoints ──────────────────────────────── */
interface Capability {
  role: string
  skills: string[]
  isSupervisor: boolean
  canExecute: boolean
}

interface TransitionMap {
  [from: string]: string[]
}

export function SupervisorPanel() {
  const [tab, setTab] = useState<'delegations' | 'capabilities' | 'state-machine' | 'rpc'>('delegations')
  const [delegations, setDelegations] = useState<DelegationRecord[]>([])
  const [capabilities, setCapabilities] = useState<Record<string, Capability>>({})
  const [transitions, setTransitions] = useState<TransitionMap>({})
  const [rpcTaskId, setRpcTaskId] = useState('')
  const [rpcPayload, setRpcPayload] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  async function loadDelegations() {
    setLoading(true)
    try {
      const data = await api.getDelegationLog()
      setDelegations(data)
    } catch { /* empty */ }
    setLoading(false)
  }

  async function loadCapabilities() {
    setLoading(true)
    try {
      const data = await api.getCapabilities()
      setCapabilities(data)
    } catch { /* empty */ }
    setLoading(false)
  }

  async function loadStateMachine() {
    setLoading(true)
    try {
      const data = await api.getStateMachine()
      setTransitions(data.transitions ?? data)
    } catch { /* empty */ }
    setLoading(false)
  }

  async function loadRpcPayload() {
    if (!rpcTaskId.trim()) return
    setLoading(true)
    try {
      const data = await api.getRpcPayload(rpcTaskId.trim())
      setRpcPayload(data)
    } catch { setRpcPayload({ error: 'Failed to load' }) }
    setLoading(false)
  }

  useEffect(() => {
    if (tab === 'delegations') loadDelegations()
    if (tab === 'capabilities') loadCapabilities()
    if (tab === 'state-machine') loadStateMachine()
  }, [tab])

  const tabs = [
    { id: 'delegations' as const, label: 'Delegation Log', icon: <GitBranch size={14} /> },
    { id: 'capabilities' as const, label: 'Capabilities', icon: <Users size={14} /> },
    { id: 'state-machine' as const, label: 'State Machine', icon: <Activity size={14} /> },
    { id: 'rpc' as const, label: 'RPC Viewer', icon: <Code2 size={14} /> },
  ]

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <BrainCircuit size={24} className="text-violet-400" />
        <div>
          <h2 className="text-lg font-bold text-slate-100">Supervisor Orchestration</h2>
          <p className="text-xs text-slate-500">Jarvis delegation engine, capability registry, state machine</p>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 p-1 glass-panel rounded-xl">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={clsx(
              'flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium transition-all',
              tab === t.id
                ? 'bg-violet-600/20 text-violet-300 border border-violet-500/20'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/40 border border-transparent',
            )}
          >
            {t.icon} {t.label}
          </button>
        ))}
        <button
          onClick={() => { if (tab === 'delegations') loadDelegations(); if (tab === 'capabilities') loadCapabilities(); if (tab === 'state-machine') loadStateMachine() }}
          className="ml-auto px-2 text-slate-500 hover:text-slate-300 transition-colors"
          title="Refresh"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* ── Delegation Log ─────────────────────────────────────── */}
      {tab === 'delegations' && (
        <div className="space-y-2 animate-fade-in">
          {delegations.length === 0 && (
            <div className="glass-panel p-8 text-center text-slate-500 text-sm">
              No delegations recorded yet. Dispatch a task to Jarvis to see delegation activity.
            </div>
          )}
          {delegations.map((d, i) => (
            <DelegationCard key={i} delegation={d} />
          ))}
        </div>
      )}

      {/* ── Capabilities ───────────────────────────────────────── */}
      {tab === 'capabilities' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 animate-fade-in">
          {Object.entries(capabilities).map(([id, cap]) => (
            <div key={id} className={clsx('glass-card p-4 border-l-2', cap.isSupervisor ? 'border-l-violet-500' : 'border-l-blue-500')}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-bold text-slate-200 capitalize">{id}</span>
                <div className="flex gap-1">
                  {cap.isSupervisor && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-400 border border-violet-500/20">
                      Supervisor
                    </span>
                  )}
                  <span className={clsx(
                    'text-[10px] px-2 py-0.5 rounded-full border',
                    cap.canExecute ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border-rose-500/20',
                  )}>
                    {cap.canExecute ? 'Can Execute' : 'No Execution'}
                  </span>
                </div>
              </div>
              <p className="text-xs text-slate-500 mb-2">{cap.role}</p>
              <div className="flex flex-wrap gap-1">
                {cap.skills.map((s) => (
                  <span key={s} className="text-[10px] px-2 py-0.5 rounded bg-slate-800/60 text-slate-400 border border-slate-700/30">
                    {s}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── State Machine ──────────────────────────────────────── */}
      {tab === 'state-machine' && (
        <div className="glass-panel p-6 animate-fade-in">
          <h3 className="text-sm font-bold text-slate-300 mb-4">Valid State Transitions</h3>
          <div className="space-y-2">
            {Object.entries(transitions).map(([from, targets]) => (
              <div key={from} className="flex items-start gap-3">
                <span className="text-xs font-mono px-2 py-1 rounded bg-slate-800/80 text-slate-300 border border-slate-700/30 min-w-[100px] text-center">
                  {from}
                </span>
                <span className="text-slate-600 mt-1">→</span>
                <div className="flex flex-wrap gap-1">
                  {(targets as string[]).map((t) => (
                    <span key={t} className="text-xs font-mono px-2 py-1 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── RPC Payload Viewer ─────────────────────────────────── */}
      {tab === 'rpc' && (
        <div className="space-y-3 animate-fade-in">
          <div className="glass-panel p-4">
            <h3 className="text-sm font-bold text-slate-300 mb-3">Preview RPC Payload</h3>
            <p className="text-xs text-slate-500 mb-3">
              Enter a task ID to preview the exact RPC payload that would be sent to the gateway — without actually dispatching.
            </p>
            <div className="flex gap-2">
              <input
                value={rpcTaskId}
                onChange={(e) => setRpcTaskId(e.target.value)}
                placeholder="Task ID"
                className="flex-1 bg-slate-800/50 border border-slate-700/40 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 outline-none focus:border-violet-500/50"
              />
              <button
                onClick={loadRpcPayload}
                disabled={loading || !rpcTaskId.trim()}
                className="px-4 py-2 bg-violet-600/20 text-violet-300 rounded-lg text-sm font-medium hover:bg-violet-600/30 transition-colors disabled:opacity-40"
              >
                Inspect
              </button>
            </div>
          </div>
          {rpcPayload && (
            <div className="glass-panel p-4">
              <pre className="text-xs text-slate-300 font-mono overflow-auto max-h-[400px] whitespace-pre-wrap">
                {JSON.stringify(rpcPayload, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/* ── Delegation Card sub-component ───────────────────────────────── */
function DelegationCard({ delegation }: { delegation: DelegationRecord }) {
  const [expanded, setExpanded] = useState(false)
  return (
    <div className="glass-card p-3">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between text-left"
      >
        <div className="flex items-center gap-2">
          <GitBranch size={14} className="text-violet-400 shrink-0" />
          <div>
            <span className="text-sm text-slate-200 font-medium">{delegation.taskId}</span>
            <span className="text-xs text-slate-500 ml-2">
              {delegation.supervisorId} → {delegation.workerId}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-slate-500">{new Date(delegation.createdAtMs).toLocaleString()}</span>
          {expanded ? <ChevronDown size={14} className="text-slate-500" /> : <ChevronRight size={14} className="text-slate-500" />}
        </div>
      </button>
      {expanded && (
        <div className="mt-3 pt-3 border-t border-slate-700/30 space-y-2">
          {delegation.reason && (
            <div>
              <span className="text-[10px] text-slate-500 uppercase">Reason</span>
              <p className="text-xs text-slate-300">{delegation.reason}</p>
            </div>
          )}
          {delegation.skillsMatched && delegation.skillsMatched.length > 0 && (
            <div>
              <span className="text-[10px] text-slate-500 uppercase">Matched Skills</span>
              <div className="flex gap-1 mt-1">
                {delegation.skillsMatched.map((s: string) => (
                  <span key={s} className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    {s}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
