import React, { useEffect, useMemo, useState } from 'react'

type AgentRow = {
  id: string
  name: string
  role: string
  status: 'idle' | 'active' | 'blocked' | string
  currentTaskId: string | null
  derivedStatus?: string
  lastHeartbeatMs?: number | null
  lastHeartbeatAgeSec?: number | null
  assignedTaskIds?: Array<string | null>
  inProgressTaskIds?: Array<string | null>
}

type TaskStatus = 'inbox' | 'assigned' | 'in_progress' | 'review' | 'done' | string

type TaskRow = {
  id: string
  title: string
  description?: string
  status: TaskStatus
  assigneeIds?: string[]
  priority?: string | null
  deadline?: string | null
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
  createdAtMs?: number
}

type Overview = {
  agents: { total: number; active: number; offline: number }
  tasks: { pending: number; completed: number; total: number }
  cron: { ok: boolean }
  nowMs: number
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
  const [overview, setOverview] = useState<Overview | null>(null)
  const [agents, setAgents] = useState<AgentRow[] | null>(null)
  const [tasks, setTasks] = useState<TaskRow[] | null>(null)
  const [cron, setCron] = useState<CronList | null>(null)
  const [activity, setActivity] = useState<ActivityRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [lastRefresh, setLastRefresh] = useState<number | null>(null)
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null)
  const [agentDetail, setAgentDetail] = useState<any | null>(null)

  const [newTitle, setNewTitle] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [newStatus, setNewStatus] = useState<TaskStatus>('inbox')
  const [newAssignee, setNewAssignee] = useState<string>('')

  async function refresh() {
    setError(null)
    try {
      const [overviewData, agentsData, cronData, activityData] = await Promise.all([
        fetchJson<Overview>('/api/overview'),
        fetchJson<AgentRow[]>('/api/agents'),
        fetchJson<CronList>('/api/cron'),
        fetchJson<ActivityRow[]>('/api/mc/activities.json'),
      ])
      const tasksData = await fetchJson<TaskRow[]>('/api/mc/tasks.json')
      setOverview(overviewData)
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

  useEffect(() => {
    if (!selectedAgentId) {
      setAgentDetail(null)
      return
    }
    fetchJson(`/api/agent/${encodeURIComponent(selectedAgentId)}`)
      .then(setAgentDetail)
      .catch((e) => setError(e?.message ?? String(e)))
  }, [selectedAgentId])

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

  async function createTask() {
    setError(null)
    try {
      const assignees = newAssignee ? [newAssignee] : []
      await fetch(`${API_BASE}/api/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newTitle,
          description: newDesc || undefined,
          status: newStatus,
          assigneeIds: assignees,
        }),
      })
      setNewTitle('')
      setNewDesc('')
      setNewStatus('inbox')
      setNewAssignee('')
      await refresh()
    } catch (e: any) {
      setError(e?.message ?? String(e))
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

      <div style={{ marginTop: 10, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <div className="panel" style={{ padding: 10 }}>
          <h2>Overview</h2>
          {!overview ? (
            <div className="meta">Loading…</div>
          ) : (
            <div className="meta">
              Agents: {overview.agents.active}/{overview.agents.total} active · {overview.agents.offline} offline<br />
              Tasks: {overview.tasks.pending} pending · {overview.tasks.completed} done · {overview.tasks.total} total<br />
              Cron: {overview.cron.ok ? 'OK' : 'Degraded'}
            </div>
          )}
        </div>

        <div className="panel" style={{ padding: 10, flex: 1, minWidth: 280 }}>
          <h2>Assign Task</h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 8 }}>
            <input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="Task title" style={{ padding: 8, borderRadius: 10, border: '1px solid var(--border)' }} />
            <textarea value={newDesc} onChange={(e) => setNewDesc(e.target.value)} placeholder="Description" rows={2} style={{ padding: 8, borderRadius: 10, border: '1px solid var(--border)' }} />
            <div style={{ display: 'flex', gap: 8 }}>
              <select value={newStatus} onChange={(e) => setNewStatus(e.target.value)} style={{ padding: 8, borderRadius: 10, border: '1px solid var(--border)' }}>
                <option value="inbox">Inbox</option>
                <option value="assigned">Assigned</option>
                <option value="in_progress">In Progress</option>
                <option value="review">Review</option>
                <option value="done">Done</option>
              </select>
              <select value={newAssignee} onChange={(e) => setNewAssignee(e.target.value)} style={{ padding: 8, borderRadius: 10, border: '1px solid var(--border)' }}>
                <option value="">Unassigned</option>
                {(agents ?? []).map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
              <button onClick={createTask} disabled={!newTitle.trim()} style={{ padding: '8px 12px', borderRadius: 10, border: '1px solid var(--border)', background: '#fff', cursor: 'pointer' }}>
                Create
              </button>
            </div>
          </div>
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
                const derived = a.derivedStatus ?? a.status
                const assignedCount = (tasks ?? []).filter((t) => (t.assigneeIds ?? []).includes(a.id) && t.status !== 'done').length
                const currentTask = a.currentTaskId ? (tasks ?? []).find((t) => t.id === a.currentTaskId) : undefined
                return (
                  <div key={a.id} className="agentCard" style={{ cursor: 'pointer' }} onClick={() => setSelectedAgentId(a.id)}>
                    <div className="agentRow">
                      <div>
                        <div className="agentName">{a.name}</div>
                        <div className="agentRole">{a.role}</div>
                      </div>
                      <div className="pill">{derived}</div>
                    </div>
                    <div className="small">
                      {currentTask ? (
                        <>Current: {currentTask.title}</>
                      ) : (
                        <>Assigned: {assignedCount}</>
                      )}
                    </div>
                    <div className="small">Heartbeat: {a.lastHeartbeatAgeSec != null ? `${a.lastHeartbeatAgeSec}s ago` : '—'}</div>
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

      {selectedAgentId ? (
        <div
          onClick={() => setSelectedAgentId(null)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.35)',
            display: 'flex',
            justifyContent: 'flex-end',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="panel"
            style={{
              width: 'min(720px, 92vw)',
              height: '100vh',
              borderRadius: 0,
              overflow: 'auto',
            }}
          >
            <h2>Agent Detail</h2>
            <div className="meta" style={{ marginBottom: 8 }}>{selectedAgentId}</div>
            {!agentDetail ? (
              <div className="meta">Loading…</div>
            ) : (
              <>
                <div style={{ marginBottom: 10 }}>
                  <div className="meta" style={{ marginBottom: 6 }}>SOUL.md</div>
                  <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12, border: '1px solid var(--border)', borderRadius: 10, padding: 10, margin: 0 }}>{agentDetail.files?.['SOUL.md'] ?? ''}</pre>
                </div>
                <div style={{ marginBottom: 10 }}>
                  <div className="meta" style={{ marginBottom: 6 }}>memory/WORKING.md</div>
                  <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12, border: '1px solid var(--border)', borderRadius: 10, padding: 10, margin: 0 }}>{agentDetail.files?.['memory/WORKING.md'] ?? ''}</pre>
                </div>
              </>
            )}
            <button onClick={() => setSelectedAgentId(null)} style={{ marginTop: 10, padding: '8px 12px', borderRadius: 10, border: '1px solid var(--border)', background: '#fff', cursor: 'pointer' }}>
              Close
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
