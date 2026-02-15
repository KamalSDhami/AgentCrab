import React, { useEffect, useMemo, useState } from 'react'

type AgentRow = {
  id: string
  name: string
  role: string
  status: 'idle' | 'active' | 'blocked' | string
  currentTaskId: string | null
}

type TaskStatus = 'inbox' | 'assigned' | 'in_progress' | 'review' | 'done' | string

type TaskRow = {
  id: string
  title: string
  description?: string
  status: TaskStatus
  assigneeIds?: string[]
}

type CronList = {
  ok?: boolean
  error?: unknown
  jobs: Array<{
    id: string
    name: string
    enabled: boolean
    schedule: { kind: 'cron' | 'every' | 'at'; expr?: string; tz?: string }
    sessionTarget: 'main' | 'isolated'
    agentId?: string
    state?: {
      nextRunAtMs?: number
      lastRunAtMs?: number
      lastStatus?: string
      lastError?: string
    }
  }>
}

type ActivityRow = {
  type?: string
  agentId?: string
  message?: string
  ts?: string
  createdAt?: string
}

const API_BASE = (import.meta as any).env.VITE_API_URL ?? window.location.origin

async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`)
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
  return (await res.json()) as T
}

function fmtTime(ms?: number) {
  if (!ms) return '—'
  return new Date(ms).toLocaleString()
}

export function App() {
  const [agents, setAgents] = useState<AgentRow[] | null>(null)
  const [tasks, setTasks] = useState<TaskRow[] | null>(null)
  const [cron, setCron] = useState<CronList | null>(null)
  const [activity, setActivity] = useState<ActivityRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [lastRefresh, setLastRefresh] = useState<number | null>(null)

  async function refresh() {
    setError(null)
    try {
      const [agentsData, cronData, activityData] = await Promise.all([
        fetchJson<AgentRow[]>('/api/mc/agents.json'),
        fetchJson<CronList>('/api/cron'),
        fetchJson<ActivityRow[]>('/api/mc/activities.json'),
      ])
      const tasksData = await fetchJson<TaskRow[]>('/api/mc/tasks.json')
      setAgents(agentsData)
      setCron(cronData?.jobs ? cronData : { jobs: [] })
      setActivity(activityData)
      setTasks(tasksData)
      setLastRefresh(Date.now())
    } catch (e: any) {
      setError(e?.message ?? String(e))
    }
  }

  useEffect(() => {
    refresh()
    const t = window.setInterval(refresh, 15000)
    return () => window.clearInterval(t)
  }, [])

  const heartbeatJobs = useMemo(() => {
    const jobs = (cron?.jobs ?? []).filter((j: CronList['jobs'][number]) => j.id.endsWith('-heartbeat'))
    jobs.sort(
      (a: CronList['jobs'][number], b: CronList['jobs'][number]) =>
        (a.agentId ?? a.id).localeCompare(b.agentId ?? b.id),
    )
    return jobs
  }, [cron])

  const activityRows = useMemo(() => {
    const rows = [...(activity ?? [])]
    rows.reverse()
    return rows.slice(0, 30)
  }, [activity])

  const agentById = useMemo(() => {
    const map = new Map<string, AgentRow>()
    for (const a of agents ?? []) map.set(a.id, a)
    return map
  }, [agents])

  const tasksByStatus = useMemo(() => {
    const statuses: TaskStatus[] = ['inbox', 'assigned', 'in_progress', 'review', 'done']
    const map = new Map<TaskStatus, TaskRow[]>()
    for (const s of statuses) map.set(s, [])
    for (const t of tasks ?? []) {
      const bucket = map.get(t.status) ?? []
      bucket.push(t)
      map.set(t.status, bucket)
    }
    for (const arr of map.values()) {
      arr.sort((a, b) => (a.title ?? '').localeCompare(b.title ?? ''))
    }
    return { map, statuses }
  }, [tasks])

  function agentName(agentId?: string) {
    if (!agentId) return '—'
    return agentById.get(agentId)?.name ?? agentId
  }

  function assigneeBadges(task: TaskRow) {
    const assignees = task.assigneeIds ?? []
    if (assignees.length === 0) return null
    return (
      <div className="assignees">
        {assignees.map((id) => (
          <span key={id} className="pill">@{agentName(id)}</span>
        ))}
      </div>
    )
  }

  function statusLabel(status: TaskStatus) {
    switch (status) {
      case 'inbox':
        return 'Inbox'
      case 'assigned':
        return 'Assigned'
      case 'in_progress':
        return 'In Progress'
      case 'review':
        return 'Review'
      case 'done':
        return 'Done'
      default:
        return status
    }
  }

  return (
    <div className="container">
      <div className="topbar">
        <h1 className="title">Mission Control</h1>
        <div className="meta">
          API: {API_BASE} · refresh: 15s · last: {lastRefresh ? new Date(lastRefresh).toLocaleTimeString() : '—'}
        </div>
      </div>

      {error ? <div className="error">{error}</div> : null}

      <div className="grid">
        <section className="panel">
          <h2>Agents</h2>
          {!agents ? (
            <div className="meta">Loading…</div>
          ) : (
            <div className="agentList">
              {agents.map((a) => {
                const assignedCount = (tasks ?? []).filter((t) => (t.assigneeIds ?? []).includes(a.id) && t.status !== 'done').length
                const currentTask = a.currentTaskId ? (tasks ?? []).find((t) => t.id === a.currentTaskId) : undefined
                return (
                  <div key={a.id} className="agentCard">
                    <div className="agentRow">
                      <div>
                        <div className="agentName">{a.name}</div>
                        <div className="agentRole">{a.role}</div>
                      </div>
                      <div className="pill">{a.status}</div>
                    </div>
                    <div className="small">
                      {currentTask ? (
                        <>Current: {currentTask.title}</>
                      ) : (
                        <>Assigned: {assignedCount}</>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>

        <section className="panel">
          <h2>Mission Queue</h2>
          {!tasks ? (
            <div className="meta">Loading…</div>
          ) : tasks.length === 0 ? (
            <div className="meta">No tasks yet. Add items to `mission_control/tasks.json`.</div>
          ) : (
            <div className="board">
              {tasksByStatus.statuses.map((s) => {
                const items = tasksByStatus.map.get(s) ?? []
                return (
                  <div key={s} className="column">
                    <div className="columnHeader">
                      <div className="columnTitle">{statusLabel(s)}</div>
                      <div className="count">{items.length}</div>
                    </div>
                    {items.map((t) => (
                      <div key={t.id} className="task">
                        <div className="taskTitle">{t.title}</div>
                        {t.description ? <div className="taskDesc">{t.description}</div> : null}
                        {assigneeBadges(t)}
                      </div>
                    ))}
                  </div>
                )
              })}
            </div>
          )}
        </section>

        <section className="panel">
          <h2>Live Feed</h2>
          {!activity ? (
            <div className="meta">Loading…</div>
          ) : activityRows.length === 0 ? (
            <div className="meta">No activity yet. Write entries to `mission_control/activities.json`.</div>
          ) : (
            <div className="feed">
              {activityRows.map((r, idx) => (
                <div key={idx} className="feedItem">
                  <div className="feedMeta">
                    {r.ts ?? r.createdAt ?? '—'} · {agentName(r.agentId)} · {r.type ?? 'activity'}
                  </div>
                  <div>{r.message ?? '—'}</div>
                </div>
              ))}
            </div>
          )}

          <div style={{ marginTop: 10 }}>
            <h2>Heartbeats</h2>
            {!cron ? (
              <div className="meta">Loading…</div>
            ) : (
              <div className="meta">
                {heartbeatJobs.length} jobs · last statuses update via `openclaw cron list --json` (delivery muted).
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}
