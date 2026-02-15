import React, { useState } from 'react'
import clsx from 'clsx'
import { Task, TaskStatus, Agent, api } from '../api'
import { GripVertical, MoreHorizontal, Trash2 } from 'lucide-react'

const COLUMNS: { status: TaskStatus; label: string; accent: string }[] = [
  { status: 'inbox', label: 'Inbox', accent: 'border-t-slate-500' },
  { status: 'assigned', label: 'Assigned', accent: 'border-t-blue-500' },
  { status: 'in_progress', label: 'In Progress', accent: 'border-t-amber-500' },
  { status: 'review', label: 'Review', accent: 'border-t-purple-500' },
  { status: 'done', label: 'Done', accent: 'border-t-emerald-500' },
]

interface Props {
  tasks: Task[] | null
  agents: Agent[] | null
  onRefresh: () => void
}

function TaskCard({
  task,
  agents,
  onStatusChange,
  onDelete,
}: {
  task: Task
  agents: Agent[] | null
  onStatusChange: (id: string, status: TaskStatus) => void
  onDelete: (id: string) => void
}) {
  const [showMenu, setShowMenu] = useState(false)
  const agentMap = new Map((agents ?? []).map((a) => [a.id, a]))

  const priorityColors: Record<string, string> = {
    high: 'text-rose-400',
    medium: 'text-amber-400',
    low: 'text-slate-500',
  }

  return (
    <div className="glass-card p-3 group relative">
      <div className="flex items-start justify-between gap-2">
        <div className="font-medium text-sm text-slate-200 leading-snug">
          {task.title}
        </div>
        <button
          onClick={() => setShowMenu(!showMenu)}
          className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-slate-700/50 text-slate-500 transition-all"
        >
          <MoreHorizontal size={14} />
        </button>
      </div>

      {task.description && (
        <p className="text-xs text-slate-500 mt-1.5 line-clamp-2">
          {task.description}
        </p>
      )}

      <div className="flex items-center gap-2 mt-2 flex-wrap">
        {task.priority && (
          <span className={clsx('text-[10px] font-medium uppercase', priorityColors[task.priority] ?? 'text-slate-500')}>
            {task.priority}
          </span>
        )}
        {(task.assigneeIds ?? []).map((id) => (
          <span key={id} className="badge badge-idle text-[10px]">
            @{agentMap.get(id)?.name ?? id}
          </span>
        ))}
      </div>

      {/* Quick action menu */}
      {showMenu && (
        <div className="absolute right-2 top-10 z-20 glass-panel p-1 min-w-[140px] animate-fade-in">
          {COLUMNS.filter((c) => c.status !== task.status).map((c) => (
            <button
              key={c.status}
              onClick={() => { onStatusChange(task.id, c.status); setShowMenu(false) }}
              className="w-full text-left px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-700/50 rounded"
            >
              Move to {c.label}
            </button>
          ))}
          <hr className="border-slate-700/30 my-1" />
          <button
            onClick={() => { onDelete(task.id); setShowMenu(false) }}
            className="w-full text-left px-3 py-1.5 text-xs text-rose-400 hover:bg-rose-500/10 rounded flex items-center gap-2"
          >
            <Trash2 size={12} /> Delete
          </button>
        </div>
      )}
    </div>
  )
}

export function TaskBoard({ tasks, agents, onRefresh }: Props) {
  async function handleStatusChange(id: string, status: TaskStatus) {
    await api.updateTask(id, { status })
    onRefresh()
  }

  async function handleDelete(id: string) {
    await api.deleteTask(id)
    onRefresh()
  }

  if (!tasks) {
    return (
      <div className="grid grid-cols-5 gap-3">
        {COLUMNS.map((c) => (
          <div key={c.status} className="kanban-column animate-pulse h-48" />
        ))}
      </div>
    )
  }

  const byStatus = new Map<TaskStatus, Task[]>()
  for (const c of COLUMNS) byStatus.set(c.status, [])
  for (const t of tasks) {
    const bucket = byStatus.get(t.status as TaskStatus) ?? byStatus.get('inbox')!
    bucket.push(t)
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-5 gap-3">
      {COLUMNS.map((col) => {
        const items = byStatus.get(col.status) ?? []
        return (
          <div key={col.status} className={clsx('kanban-column border-t-2', col.accent)}>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-bold uppercase tracking-wide text-slate-400">
                {col.label}
              </h3>
              <span className="text-xs text-slate-600 bg-slate-800/50 px-1.5 py-0.5 rounded">
                {items.length}
              </span>
            </div>
            <div className="flex flex-col gap-2">
              {items.map((t) => (
                <TaskCard
                  key={t.id}
                  task={t}
                  agents={agents}
                  onStatusChange={handleStatusChange}
                  onDelete={handleDelete}
                />
              ))}
              {items.length === 0 && (
                <div className="text-xs text-slate-600 text-center py-6">
                  No tasks
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
