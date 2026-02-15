import React, { useEffect, useState } from 'react'
import { Task, TaskResult, api } from '../api'
import { X, Download, FileText, Clock, CheckCircle } from 'lucide-react'

interface Props {
  task: Task
  onClose: () => void
}

export function TaskResultModal({ task, onClose }: Props) {
  const [result, setResult] = useState<TaskResult | null>(task.result ?? null)
  const [loading, setLoading] = useState(!task.result)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (task.result) return
    setLoading(true)
    api.getTaskResult(task.id)
      .then((r) => setResult(r.result))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [task.id])

  function handleExport() {
    if (!result) return
    const blob = new Blob([result.resultContent], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${task.title.replace(/[^a-z0-9]/gi, '_')}_result.md`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-3xl max-h-[85vh] glass-panel rounded-2xl overflow-hidden animate-fade-in flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-700/30 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <CheckCircle size={20} className="text-emerald-400" />
            <div>
              <h2 className="text-lg font-bold text-slate-100">Task Result</h2>
              <p className="text-xs text-slate-500">{task.title}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {result && (
              <button onClick={handleExport} className="btn-ghost flex items-center gap-1.5 text-xs">
                <Download size={14} /> Export
              </button>
            )}
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-700/50 text-slate-400">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loading && <div className="text-slate-500 text-sm py-8 text-center">Loading result…</div>}
          {error && (
            <div className="p-4 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm">
              {error}
            </div>
          )}
          {result && (
            <div className="space-y-4">
              {/* Summary */}
              {result.resultSummary && (
                <div className="glass-card p-4">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-2">Summary</h3>
                  <p className="text-sm text-slate-200">{result.resultSummary}</p>
                </div>
              )}

              {/* Metadata bar */}
              <div className="flex items-center gap-4 text-xs text-slate-500">
                {result.completedAtMs && (
                  <span className="flex items-center gap-1">
                    <Clock size={12} /> Completed {new Date(result.completedAtMs).toLocaleString()}
                  </span>
                )}
                {result.resultFiles.length > 0 && (
                  <span className="flex items-center gap-1">
                    <FileText size={12} /> {result.resultFiles.length} file(s)
                  </span>
                )}
              </div>

              {/* Files */}
              {result.resultFiles.length > 0 && (
                <div className="glass-card p-4">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-2">Files</h3>
                  <div className="space-y-1">
                    {result.resultFiles.map((f, i) => (
                      <div key={i} className="text-xs text-slate-300 flex items-center gap-2">
                        <FileText size={12} className="text-slate-500" /> {f}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Main content — rendered as markdown-like */}
              <div className="glass-card p-4">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-2">Result Content</h3>
                <div className="prose prose-invert prose-sm max-w-none">
                  <pre className="text-xs text-slate-300 whitespace-pre-wrap font-mono leading-relaxed bg-slate-800/30 rounded-lg p-4 border border-slate-700/20 max-h-[50vh] overflow-y-auto">
                    {result.resultContent || '(no content)'}
                  </pre>
                </div>
              </div>

              {/* Execution log */}
              {result.executionLog && (
                <details className="glass-card p-4">
                  <summary className="text-xs font-bold text-slate-400 uppercase tracking-wide cursor-pointer">
                    Execution Log
                  </summary>
                  <pre className="mt-2 text-[10px] text-slate-500 whitespace-pre-wrap font-mono bg-slate-900/50 rounded p-3 max-h-40 overflow-y-auto">
                    {result.executionLog}
                  </pre>
                </details>
              )}
            </div>
          )}

          {!loading && !error && !result && (
            <div className="text-center py-12">
              <p className="text-slate-500 text-sm">No result stored for this task yet.</p>
              <p className="text-slate-600 text-xs mt-1">The agent hasn't completed execution or hasn't stored a result.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
