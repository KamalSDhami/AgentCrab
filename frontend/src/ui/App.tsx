import React, { useEffect, useMemo, useState } from 'react'

type AgentRow = {
  id: string
  name: string
  role: string
  status: 'idle' | 'active' | 'blocked' | string
  currentTaskId: string | null
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

const API_BASE = (import.meta as any).env.VITE_API_URL ?? 'http://127.0.0.1:8000'

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
      setAgents(agentsData)
      setCron(cronData?.jobs ? cronData : { jobs: [] })
      setActivity(activityData)
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

  return (
    <div style={{ fontFamily: 'system-ui, Segoe UI, Roboto, Arial', padding: 16, maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'baseline' }}>
        <h1 style={{ margin: 0 }}>Agent Monitor</h1>
        <div style={{ fontSize: 12, opacity: 0.8 }}>
          API: {API_BASE} · last refresh: {lastRefresh ? new Date(lastRefresh).toLocaleTimeString() : '—'}
        </div>
      </div>

      {error ? (
        <div style={{ marginTop: 12, padding: 12, border: '1px solid #d33', borderRadius: 8, color: '#d33' }}>
          {error}
        </div>
      ) : null}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 16, marginTop: 16 }}>
        <section style={{ border: '1px solid #ddd', borderRadius: 8, padding: 12 }}>
          <h2 style={{ marginTop: 0 }}>Agents</h2>
          {!agents ? (
            <div>Loading…</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', borderBottom: '1px solid #eee', padding: '6px 8px' }}>Agent</th>
                  <th style={{ textAlign: 'left', borderBottom: '1px solid #eee', padding: '6px 8px' }}>Role</th>
                  <th style={{ textAlign: 'left', borderBottom: '1px solid #eee', padding: '6px 8px' }}>Status</th>
                  <th style={{ textAlign: 'left', borderBottom: '1px solid #eee', padding: '6px 8px' }}>Current Task</th>
                </tr>
              </thead>
              <tbody>
                {agents.map((a: AgentRow) => (
                  <tr key={a.id}>
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid #f3f3f3' }}>{a.name} ({a.id})</td>
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid #f3f3f3' }}>{a.role}</td>
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid #f3f3f3' }}>{a.status}</td>
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid #f3f3f3' }}>{a.currentTaskId ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section style={{ border: '1px solid #ddd', borderRadius: 8, padding: 12 }}>
          <h2 style={{ marginTop: 0 }}>Heartbeats (Cron)</h2>
          {!cron ? (
            <div>Loading…</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', borderBottom: '1px solid #eee', padding: '6px 8px' }}>Agent</th>
                  <th style={{ textAlign: 'left', borderBottom: '1px solid #eee', padding: '6px 8px' }}>Schedule</th>
                  <th style={{ textAlign: 'left', borderBottom: '1px solid #eee', padding: '6px 8px' }}>Next</th>
                  <th style={{ textAlign: 'left', borderBottom: '1px solid #eee', padding: '6px 8px' }}>Last Status</th>
                  <th style={{ textAlign: 'left', borderBottom: '1px solid #eee', padding: '6px 8px' }}>Last Error</th>
                </tr>
              </thead>
              <tbody>
                {heartbeatJobs.map((j: CronList['jobs'][number]) => (
                  <tr key={j.id}>
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid #f3f3f3' }}>{j.agentId ?? '—'}</td>
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid #f3f3f3' }}>{j.schedule.expr ?? j.schedule.kind}</td>
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid #f3f3f3' }}>{fmtTime(j.state?.nextRunAtMs)}</td>
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid #f3f3f3' }}>{j.state?.lastStatus ?? '—'}</td>
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid #f3f3f3' }}>{j.state?.lastError ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section style={{ border: '1px solid #ddd', borderRadius: 8, padding: 12 }}>
          <h2 style={{ marginTop: 0 }}>Recent Activity</h2>
          {!activity ? (
            <div>Loading…</div>
          ) : activityRows.length === 0 ? (
            <div>No activity yet (write entries to `mission_control/activities.json`).</div>
          ) : (
            <ul style={{ listStyle: 'none', paddingLeft: 0, margin: 0 }}>
              {activityRows.map((r: ActivityRow, idx: number) => (
                <li key={idx} style={{ padding: '8px 0', borderBottom: '1px solid #f3f3f3' }}>
                  <div style={{ fontSize: 12, opacity: 0.8 }}>{r.ts ?? r.createdAt ?? '—'} · {r.agentId ?? '—'} · {r.type ?? 'activity'}</div>
                  <div>{r.message ?? '—'}</div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <div style={{ marginTop: 16, fontSize: 12, opacity: 0.8 }}>
        Refreshes every 15s. Heartbeats are muted (cron runs logged only).
      </div>
    </div>
  )
}
