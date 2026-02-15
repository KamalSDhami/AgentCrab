import React, { useState } from 'react'
import { Task, Agent, TaskStatus, api } from '../api'
import { X, Save } from 'lucide-react'

interface Props {
  task: Task
  agents: Agent[] | null
  onClose: () => void
  onSaved: () => void
}

const STATUS_OPTIONS: { value: TaskStatus; label: string }[] = [
  { value: 'inbox', label: 'Inbox' },
  { value: 'assigned', label: 'Assigned' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'review', label: 'Review' },
  { value: 'done', label: 'Done' },
]

export function TaskEditModal({ task, agents, onClose, onSaved }: Props) {
  const [title, setTitle] = useState(task.title)
  const [description, setDescription] = useState(task.description || '')
  const [priority, setPriority] = useState(task.priority || '')
  const [status, setStatus] = useState<TaskStatus>(task.status)
  const [assignee, setAssignee] = useState(task.assigneeIds?.[0] || '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    setSaving(true)
    setError(null)

    const changes: Partial<Task> = {}
    if (title !== task.title) changes.title = title.trim()
    if (description !== (task.description || '')) changes.description = description.trim()
    if (priority !== (task.priority || '')) changes.priority = priority || undefined
    if (status !== task.status) changes.status = status
    const newAssignees = assignee ? [assignee] : []
    if (JSON.stringify(newAssignees) !== JSON.stringify(task.assigneeIds || [])) {
      changes.assigneeIds = newAssignees
    }

    if (Object.keys(changes).length === 0) {
      onClose()
      return
    }

    try {
      await api.updateTask(task.id, changes)
      onSaved()
      onClose()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-lg glass-panel rounded-2xl overflow-hidden animate-fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-slate-700/30 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-100">Edit Task</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-700/50 text-slate-400">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSave} className="px-6 py-4 space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="text-xs font-medium text-slate-400 block mb-1">Title</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="input-field"
              autoFocus
            />
          </div>

          <div>
            <label className="text-xs font-medium text-slate-400 block mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              className="input-field resize-none"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-400 block mb-1">Status</label>
              <select value={status} onChange={(e) => setStatus(e.target.value as TaskStatus)} className="select-field">
                {STATUS_OPTIONS.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-medium text-slate-400 block mb-1">Assignee</label>
              <select value={assignee} onChange={(e) => setAssignee(e.target.value)} className="select-field">
                <option value="">Unassigned</option>
                {(agents ?? []).map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-medium text-slate-400 block mb-1">Priority</label>
              <select value={priority} onChange={(e) => setPriority(e.target.value)} className="select-field">
                <option value="">None</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
          </div>

          {/* Edit history */}
          {task.editHistory && task.editHistory.length > 0 && (
            <details className="text-xs text-slate-500">
              <summary className="cursor-pointer hover:text-slate-300">
                Version History ({task.editHistory.length} edits)
              </summary>
              <div className="mt-2 space-y-1 max-h-24 overflow-y-auto">
                {task.editHistory.slice().reverse().map((e, i) => (
                  <div key={i} className="text-[10px] text-slate-600">
                    v{e.version} — {Object.keys(e.changes).join(', ')} — {new Date(e.atMs).toLocaleString()}
                  </div>
                ))}
              </div>
            </details>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn-ghost">
              Cancel
            </button>
            <button type="submit" disabled={!title.trim() || saving} className="btn-primary disabled:opacity-40 flex items-center gap-1.5">
              <Save size={14} /> {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
