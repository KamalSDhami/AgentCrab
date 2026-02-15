/* ── API Types ─────────────────────────────────────────────────────────────── */

export type AgentStatus = 'idle' | 'running' | 'offline' | 'unknown' | string

export interface Agent {
  id: string
  name: string
  role: string
  status: string
  currentTaskId: string | null
  derivedStatus: AgentStatus
  lastHeartbeatMs: number | null
  lastHeartbeatAgeSec: number | null
  lastCronStatus: string | null
  lastCronError: string | null
  assignedTaskCount: number
  inProgressTaskCount: number
  assignedTaskIds: string[]
  inProgressTaskIds: string[]
}

export interface AgentDetail extends Agent {
  files: Record<string, string>
  workspaceExists: boolean
}

export type TaskStatus = 'inbox' | 'assigned' | 'in_progress' | 'review' | 'done'

export interface Task {
  id: string
  title: string
  description?: string
  status: TaskStatus
  assigneeIds: string[]
  priority?: string | null
  deadline?: string | null
  createdAtMs?: number
  updatedAtMs?: number
}

export interface ActivityEvent {
  id: string
  type: string
  message: string
  taskId?: string
  agentId?: string
  createdAtMs: number
}

export interface Overview {
  agents: { total: number; online: number; offline: number }
  tasks: { total: number; pending: number; inProgress: number; review: number; completed: number }
  activity: { total: number; recent: number }
  cron: { ok: boolean; jobCount: number; heartbeatCount: number }
  nowMs: number
}

export interface CronJob {
  id: string
  name: string
  enabled: boolean
  schedule: { kind: string; expr?: string; tz?: string }
  sessionTarget: string
  agentId?: string
  state?: {
    nextRunAtMs?: number
    lastRunAtMs?: number
    lastStatus?: string
    lastError?: string
  }
}

export interface CronList {
  ok: boolean
  jobs: CronJob[]
  error?: string
}

/* ── API Client ────────────────────────────────────────────────────────────── */

const BASE = ''  // Same origin in production; Vite proxy in dev

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, init)
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText)
    throw new Error(`${res.status}: ${text}`)
  }
  return res.json() as Promise<T>
}

export const api = {
  overview: () => request<Overview>('/api/overview'),
  agents: () => request<Agent[]>('/api/agents'),
  agentDetail: (id: string) => request<AgentDetail>(`/api/agents/${encodeURIComponent(id)}`),
  agentCronRuns: (id: string) => request<any>(`/api/agents/${encodeURIComponent(id)}/cron-runs`),
  tasks: () => request<Task[]>('/api/tasks'),
  createTask: (data: Partial<Task>) =>
    request<Task>('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),
  updateTask: (id: string, data: Partial<Task>) =>
    request<Task>(`/api/tasks/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),
  deleteTask: (id: string) =>
    request<void>(`/api/tasks/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  activity: (limit = 100) => request<ActivityEvent[]>(`/api/activity?limit=${limit}`),
  cron: () => request<CronList>('/api/cron'),
  messages: (taskId?: string) =>
    request<any[]>(`/api/messages${taskId ? `?task_id=${taskId}` : ''}`),
}
