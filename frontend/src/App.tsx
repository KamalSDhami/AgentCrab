import React, { useCallback, useState } from 'react'
import { api, Agent, Task, ActivityEvent, Overview, CronList } from './api'
import { useFetch, useSSE } from './hooks'

import { Sidebar, Page } from './components/Sidebar'
import { StatsCards } from './components/StatsCards'
import { AgentGrid } from './components/AgentGrid'
import { AgentDetail } from './components/AgentDetail'
import { TaskBoard } from './components/TaskBoard'
import { TaskCreate } from './components/TaskCreate'
import { ActivityFeed } from './components/ActivityFeed'
import { CronPanel } from './components/CronPanel'

export function App() {
  const [page, setPage] = useState<Page>('dashboard')
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null)

  // Data fetching
  const overview = useFetch<Overview>(api.overview, [], 15_000)
  const agents = useFetch<Agent[]>(api.agents, [], 15_000)
  const tasks = useFetch<Task[]>(api.tasks, [], 15_000)
  const activity = useFetch<ActivityEvent[]>(() => api.activity(200), [], 15_000)
  const cron = useFetch<CronList>(api.cron, [], 30_000)

  // SSE for real-time task updates
  useSSE(
    useCallback((_type: string, _data: any) => {
      // Refresh tasks and activity on any SSE event
      tasks.refresh()
      activity.refresh()
      overview.refresh()
    }, []),
  )

  function refreshAll() {
    overview.refresh()
    agents.refresh()
    tasks.refresh()
    activity.refresh()
  }

  const globalError = overview.error || agents.error

  return (
    <div className="flex min-h-screen">
      <Sidebar current={page} onChange={setPage} />

      <main className="ml-56 flex-1 p-6 max-w-[1400px]">
        {/* Page header */}
        <div className="mb-6">
          <h2 className="text-xl font-bold text-slate-100 capitalize">{page}</h2>
          <p className="text-xs text-slate-500 mt-1">
            {page === 'dashboard' && 'System overview and recent activity'}
            {page === 'agents' && 'All registered agents and their status'}
            {page === 'tasks' && 'Task management and Kanban board'}
            {page === 'activity' && 'Complete activity timeline'}
            {page === 'cron' && 'OpenClaw heartbeat and cron job status'}
          </p>
        </div>

        {globalError && (
          <div className="mb-4 p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm">
            {globalError}
          </div>
        )}

        {/* ── Dashboard ──────────────────────────────────────────────────── */}
        {page === 'dashboard' && (
          <div className="space-y-6 animate-fade-in">
            <StatsCards overview={overview.data} />

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
              {/* Agents overview — 2 cols */}
              <div className="xl:col-span-2">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wide">Agents</h3>
                  <button onClick={() => setPage('agents')} className="btn-ghost text-xs">
                    View all →
                  </button>
                </div>
                <AgentGrid agents={agents.data} onSelect={(id) => { setSelectedAgent(id) }} />
              </div>

              {/* Activity - 1 col */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wide">Recent Activity</h3>
                  <button onClick={() => setPage('activity')} className="btn-ghost text-xs">
                    View all →
                  </button>
                </div>
                <ActivityFeed activity={activity.data} agents={agents.data} limit={10} />
              </div>
            </div>
          </div>
        )}

        {/* ── Agents ─────────────────────────────────────────────────────── */}
        {page === 'agents' && (
          <div className="animate-fade-in">
            <AgentGrid agents={agents.data} onSelect={(id) => setSelectedAgent(id)} />
          </div>
        )}

        {/* ── Tasks ──────────────────────────────────────────────────────── */}
        {page === 'tasks' && (
          <div className="space-y-4 animate-fade-in">
            <TaskCreate agents={agents.data} onCreated={refreshAll} />
            <TaskBoard tasks={tasks.data} agents={agents.data} onRefresh={refreshAll} />
          </div>
        )}

        {/* ── Activity ───────────────────────────────────────────────────── */}
        {page === 'activity' && (
          <div className="animate-fade-in">
            <ActivityFeed activity={activity.data} agents={agents.data} />
          </div>
        )}

        {/* ── Cron / Heartbeats ──────────────────────────────────────────── */}
        {page === 'cron' && (
          <div className="animate-fade-in">
            <CronPanel cron={cron.data} />
          </div>
        )}
      </main>

      {/* Agent detail slide-over */}
      {selectedAgent && (
        <AgentDetail agentId={selectedAgent} onClose={() => setSelectedAgent(null)} />
      )}
    </div>
  )
}
