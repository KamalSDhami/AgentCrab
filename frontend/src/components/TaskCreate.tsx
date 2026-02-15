import React, { useState } from 'react'
import { Agent, TaskStatus, api } from '../api'
import { Plus, X } from 'lucide-react'

interface Props {
  agents: Agent[] | null
  onCreated: () => void
}

export function TaskCreate({ agents, onCreated }: Props) {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [desc, setDesc] = useState('')
  const [status, setStatus] = useState<TaskStatus>('inbox')
  const [assignee, setAssignee] = useState('')
  const [priority, setPriority] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    setSubmitting(true)
    try {
      await api.createTask({
        title: title.trim(),
        description: desc.trim() || undefined,
        status,
        assigneeIds: assignee ? [assignee] : [],
        priority: priority || undefined,
      })
      setTitle('')
      setDesc('')
      setStatus('inbox')
      setAssignee('')
      setPriority('')
      setOpen(false)
      onCreated()
    } finally {
      setSubmitting(false)
    }
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="btn-primary flex items-center gap-2">
        <Plus size={16} />
        New Task
      </button>
    )
  }

  return (
    <div className="glass-panel p-4 animate-fade-in">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-slate-200">Create Task</h3>
        <button onClick={() => setOpen(false)} className="text-slate-500 hover:text-slate-300">
          <X size={16} />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Task title"
          className="input-field"
          autoFocus
        />
        <textarea
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          placeholder="Description (optional)"
          rows={2}
          className="input-field resize-none"
        />
        <div className="grid grid-cols-3 gap-2">
          <select value={status} onChange={(e) => setStatus(e.target.value as TaskStatus)} className="select-field">
            <option value="inbox">Inbox</option>
            <option value="assigned">Assigned</option>
            <option value="in_progress">In Progress</option>
            <option value="review">Review</option>
          </select>
          <select value={assignee} onChange={(e) => setAssignee(e.target.value)} className="select-field">
            <option value="">Unassigned</option>
            {(agents ?? []).map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
          <select value={priority} onChange={(e) => setPriority(e.target.value)} className="select-field">
            <option value="">No priority</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={() => setOpen(false)} className="btn-ghost">
            Cancel
          </button>
          <button type="submit" disabled={!title.trim() || submitting} className="btn-primary disabled:opacity-40">
            {submitting ? 'Creating…' : 'Create'}
          </button>
        </div>
      </form>
    </div>
  )
}
