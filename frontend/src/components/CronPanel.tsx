import React from 'react'
import { CronList, CronJob } from '../api'
import { timeAgo, fmtTime } from '../hooks'
import { Radio, CheckCircle2, XCircle, Clock, AlertTriangle } from 'lucide-react'

interface Props {
  cron: CronList | null
}

function CronRow({ job }: { job: CronJob }) {
  const st = job.state
  const isHeartbeat = job.id.endsWith('-heartbeat')
  const statusIcon = st?.lastStatus === 'success'
    ? <CheckCircle2 size={14} className="text-emerald-400" />
    : st?.lastStatus === 'error'
      ? <XCircle size={14} className="text-rose-400" />
      : <Clock size={14} className="text-slate-500" />

  return (
    <div className="glass-card px-3 py-2.5 flex items-center gap-3">
      {statusIcon}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-slate-200 truncate">{job.name || job.id}</span>
          {!job.enabled && (
            <span className="badge badge-offline text-[10px]">Disabled</span>
          )}
          {isHeartbeat && (
            <span className="badge badge-running text-[10px]">Heartbeat</span>
          )}
        </div>
        <div className="flex items-center gap-3 mt-0.5 text-[11px] text-slate-600">
          {job.agentId && <span>Agent: {job.agentId}</span>}
          <span>{job.schedule?.expr ?? job.schedule?.kind ?? '—'}</span>
          {job.sessionTarget && <span>Target: {job.sessionTarget}</span>}
        </div>
      </div>
      <div className="text-right text-[11px] text-slate-500 shrink-0">
        <div>Last: {timeAgo(st?.lastRunAtMs)}</div>
        <div>Next: {st?.nextRunAtMs ? fmtTime(st.nextRunAtMs) : '—'}</div>
      </div>
    </div>
  )
}

export function CronPanel({ cron }: Props) {
  if (!cron) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="glass-card h-14 animate-pulse" />
        ))}
      </div>
    )
  }

  if (!cron.ok) {
    return (
      <div className="glass-panel p-4 flex items-center gap-3">
        <AlertTriangle size={18} className="text-amber-400" />
        <div>
          <div className="text-sm text-slate-300">OpenClaw cron unavailable</div>
          <div className="text-xs text-slate-500 mt-0.5">
            {typeof cron.error === 'string' ? cron.error : 'Not installed on this host'}
          </div>
        </div>
      </div>
    )
  }

  const heartbeats = cron.jobs.filter((j) => j.id.endsWith('-heartbeat'))
  const others = cron.jobs.filter((j) => !j.id.endsWith('-heartbeat'))

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="glass-panel p-4 flex items-center gap-4">
        <Radio size={18} className="text-emerald-400" />
        <div className="text-sm text-slate-300">
          <span className="font-bold text-slate-100">{cron.jobs.length}</span> cron jobs ·{' '}
          <span className="font-bold text-emerald-400">{heartbeats.length}</span> heartbeats ·{' '}
          <span className="font-bold text-blue-400">{others.length}</span> other
        </div>
      </div>

      {/* Heartbeat jobs */}
      {heartbeats.length > 0 && (
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-2 px-1">
            Heartbeat Jobs
          </h3>
          <div className="space-y-1.5">
            {heartbeats.map((j) => <CronRow key={j.id} job={j} />)}
          </div>
        </div>
      )}

      {/* Other jobs */}
      {others.length > 0 && (
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-2 px-1">
            Other Jobs
          </h3>
          <div className="space-y-1.5">
            {others.map((j) => <CronRow key={j.id} job={j} />)}
          </div>
        </div>
      )}
    </div>
  )
}
