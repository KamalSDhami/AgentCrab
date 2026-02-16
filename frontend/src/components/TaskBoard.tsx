import React, { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import clsx from 'clsx'
import { Task, TaskStatus, Agent, api } from '../api'
import {
  MoreHorizontal, Trash2, Send, Loader2, Pencil, Eye,
  BrainCircuit, GitBranch, SearchCheck,
} from 'lucide-react'
import { TaskEditModal } from './TaskEditModal'
import { TaskResultModal } from './TaskResultModal'

const COLUMNS: { status: TaskStatus; label: string; accent: string }[] = [
  { status: 'inbox', label: 'Inbox', accent: 'border-t-slate-500' },
  { status: 'assigned', label: 'Assigned', accent: 'border-t-blue-500' },
  { status: 'in_progress', label: 'In Progress', accent: 'border-t-amber-500' },
  { status: 'review', label: 'Review', accent: 'border-t-purple-500' },
  { status: 'done', label: 'Done', accent: 'border-t-emerald-500' },
]

/* ── Supervisor state badges ─────────────────────────────────────── */
const SUPERVISOR_STATES: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  analyzing:  { label: 'Analyzing',  color: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20',   icon: <BrainCircuit size={10} /> },
  delegated:  { label: 'Delegated',  color: 'text-violet-400 bg-violet-500/10 border-violet-500/20', icon: <GitBranch size={10} /> },
  reviewing:  { label: 'Reviewing',  color: 'text-amber-400 bg-amber-500/10 border-amber-500/20',   icon: <SearchCheck size={10} /> },
}

/* ── Portal dropdown menu ────────────────────────────────────────── */
function PortalMenu({
  anchorRef,
  children,
  onClose,
}: {
  anchorRef: React.RefObject<HTMLButtonElement | null>
  children: React.ReactNode
  onClose: () => void
}) {
  const [pos, setPos] = useState({ top: 0, left: 0 })
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = anchorRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    setPos({ top: rect.bottom + 4, left: Math.min(rect.right - 180, window.innerWidth - 200) })
  }, [anchorRef])

  // Close on outside click — but NOT when clicking inside the portal menu itself
  useEffect(() => {
    function handler(e: MouseEvent) {
      const target = e.target as Node
      if (anchorRef.current?.contains(target)) return
      if (menuRef.current?.contains(target)) return
      onClose()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose, anchorRef])

  return createPortal(
    <div
      ref={menuRef}
      className="fixed z-[200] glass-panel p-1 min-w-[180px] animate-fade-in rounded-lg shadow-xl shadow-black/40 border border-slate-700/50"
      style={{ top: pos.top, left: pos.left }}
    >
      {children}
    </div>,
    document.body,
  )
}

interface Props {
  tasks: Task[] | null
  agents: Agent[] | null
  onRefresh: () => void
  onDispatch?: (id: string) => void
}

/* ── Task Card ───────────────────────────────────────────────────── */
function TaskCard({
  task,
  agents,
  onStatusChange,
  onDelete,
  onDispatch,
  onEdit,
  onViewResult,
}: {
  task: Task
  agents: Agent[] | null
  onStatusChange: (id: string, status: TaskStatus) => void
  onDelete: (id: string) => void
  onDispatch: (id: string) => void
  onEdit: (task: Task) => void
  onViewResult: (task: Task) => void
}) {
  const [showMenu, setShowMenu] = useState(false)
  const menuBtnRef = useRef<HTMLButtonElement | null>(null)
  const agentMap = new Map((agents ?? []).map((a) => [a.id, a]))

  const priorityColors: Record<string, string> = {
    high: 'text-rose-400',
    medium: 'text-amber-400',
    low: 'text-slate-500',
  }

  const dsp = task.dispatch
  const dispatchStatus = dsp?.lastDispatchStatus
  const hasAssignees = (task.assigneeIds ?? []).length > 0
  const supervisorState = (task as any).supervisorState as string | undefined
  const stateInfo = supervisorState ? SUPERVISOR_STATES[supervisorState] : null
  const hasResult = !!(task.result || task.status === 'done')

  return (
    <div className="glass-card p-3 group relative">
      <div className="flex items-start justify-between gap-2">
        <div className="font-medium text-sm text-slate-200 leading-snug flex-1">
          {task.title}
        </div>
        <div className="flex items-center gap-0.5 shrink-0">
          {/* Edit button */}
          <button
            onClick={() => onEdit(task)}
            className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-slate-700/50 text-slate-500 hover:text-slate-300 transition-all"
            title="Edit task"
          >
            <Pencil size={12} />
          </button>
          {/* View result button - only for done/review tasks */}
          {hasResult && (
            <button
              onClick={() => onViewResult(task)}
              className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-emerald-700/30 text-emerald-500 hover:text-emerald-300 transition-all"
              title="View result"
            >
              <Eye size={12} />
            </button>
          )}
          {/* More menu */}
          <button
            ref={menuBtnRef}
            onClick={() => setShowMenu(!showMenu)}
            className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-slate-700/50 text-slate-500 transition-all"
          >
            <MoreHorizontal size={14} />
          </button>
        </div>
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

      {/* Supervisor state indicator */}
      {stateInfo && (
        <div className="mt-2">
          <span className={clsx('inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border', stateInfo.color)}>
            {stateInfo.icon} {stateInfo.label}
          </span>
        </div>
      )}

      {/* Dispatch status indicator */}
      {dsp && (
        <div className="mt-2 flex items-center gap-1.5">
          {dispatchStatus === 'dispatched' && (
            <span className="text-[10px] text-emerald-400 flex items-center gap-1">
              <Send size={9} /> Dispatched
              {dsp.dispatchCount && dsp.dispatchCount > 1 && ` (×${dsp.dispatchCount})`}
            </span>
          )}
          {dispatchStatus === 'failed' && (
            <span className="text-[10px] text-rose-400 flex items-center gap-1">
              ✗ Dispatch failed
            </span>
          )}
          {dispatchStatus === 'dispatching' && (
            <span className="text-[10px] text-blue-400 flex items-center gap-1">
              <Loader2 size={9} className="animate-spin" /> Dispatching…
            </span>
          )}
        </div>
      )}

      {/* Dispatch button for assigned but not-yet-dispatched tasks */}
      {hasAssignees && !dispatchStatus && task.status !== 'done' && (
        <button
          onClick={() => onDispatch(task.id)}
          className="mt-2 flex items-center gap-1 text-[10px] text-indigo-400 hover:text-indigo-300 transition-colors"
        >
          <Send size={10} /> Dispatch to agent
        </button>
      )}

      {/* Portal-rendered dropdown menu (fixes z-index stacking bug) */}
      {showMenu && (
        <PortalMenu anchorRef={menuBtnRef} onClose={() => setShowMenu(false)}>
          <button
            onClick={() => { onEdit(task); setShowMenu(false) }}
            className="w-full text-left px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-700/50 rounded flex items-center gap-2"
          >
            <Pencil size={12} /> Edit task
          </button>
          {hasResult && (
            <button
              onClick={() => { onViewResult(task); setShowMenu(false) }}
              className="w-full text-left px-3 py-1.5 text-xs text-emerald-400 hover:bg-emerald-500/10 rounded flex items-center gap-2"
            >
              <Eye size={12} /> View result
            </button>
          )}
          <hr className="border-slate-700/30 my-1" />
          {COLUMNS.filter((c) => c.status !== task.status).map((c) => (
            <button
              key={c.status}
              onClick={() => { onStatusChange(task.id, c.status); setShowMenu(false) }}
              className="w-full text-left px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-700/50 rounded"
            >
              Move to {c.label}
            </button>
          ))}
          {hasAssignees && (
            <>
              <hr className="border-slate-700/30 my-1" />
              <button
                onClick={() => { onDispatch(task.id); setShowMenu(false) }}
                className="w-full text-left px-3 py-1.5 text-xs text-indigo-400 hover:bg-indigo-500/10 rounded flex items-center gap-2"
              >
                <Send size={12} /> {dispatchStatus ? 'Re-dispatch' : 'Dispatch'}
              </button>
            </>
          )}
          <hr className="border-slate-700/30 my-1" />
          <button
            onClick={() => { onDelete(task.id); setShowMenu(false) }}
            className="w-full text-left px-3 py-1.5 text-xs text-rose-400 hover:bg-rose-500/10 rounded flex items-center gap-2"
          >
            <Trash2 size={12} /> Delete
          </button>
        </PortalMenu>
      )}
    </div>
  )
}

/* ── Task Board ──────────────────────────────────────────────────── */
export function TaskBoard({ tasks, agents, onRefresh, onDispatch: externalDispatch }: Props) {
  const [editTask, setEditTask] = useState<Task | null>(null)
  const [resultTask, setResultTask] = useState<Task | null>(null)

  async function handleStatusChange(id: string, status: TaskStatus) {
    await api.updateTask(id, { status })
    onRefresh()
  }

  async function handleDelete(id: string) {
    await api.deleteTask(id)
    onRefresh()
  }

  async function handleDispatch(id: string) {
    try {
      await api.dispatchTask(id)
      onRefresh()
      externalDispatch?.(id)
    } catch (e: any) {
      console.error('Dispatch failed:', e)
    }
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
    <>
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
                    onDispatch={handleDispatch}
                    onEdit={setEditTask}
                    onViewResult={setResultTask}
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

      {/* Edit modal */}
      {editTask && (
        <TaskEditModal
          task={editTask}
          agents={agents}
          onClose={() => setEditTask(null)}
          onSaved={() => { setEditTask(null); onRefresh() }}
        />
      )}

      {/* Result modal */}
      {resultTask && (
        <TaskResultModal
          task={resultTask}
          onClose={() => setResultTask(null)}
        />
      )}
    </>
  )
}
