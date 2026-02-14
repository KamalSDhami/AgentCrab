import { useQuery, useMutation } from 'convex/react'
import { api } from '../convex/_generated/api'
import { useState, useEffect } from 'react'
import type { Id } from '../convex/_generated/dataModel'

// Type definitions
interface Agent {
    _id: Id<"agents">
    name: string
    role: string
    status: "idle" | "active" | "blocked" | "provisioning" | "offline"
    level: "intern" | "specialist" | "lead"
    sessionKey: string
    lastSeen?: number
    // Gateway integration fields
    openclawSessionId?: string
    gatewayId?: Id<"gateways">
    isBoardLead?: boolean
    soulTemplate?: string
    identityProfile?: {
        emoji?: string
        theme?: string
        description?: string
    }
    heartbeatConfig?: {
        intervalMinutes?: number
        cronExpression?: string
        message?: string
    }
    provisionStatus?: "pending" | "confirmed" | "failed"
    provisionedAt?: number
}

interface Task {
    _id: Id<"tasks">
    title: string
    description: string
    status: "inbox" | "assigned" | "in_progress" | "review" | "done" | "blocked"
    assigneeIds: Id<"agents">[]
    tags: string[]
    priority?: "low" | "medium" | "high"
    createdAt: number
    updatedAt: number
}

interface Activity {
    _id: Id<"activities">
    type: string
    agentId: Id<"agents">
    agentName: string
    agentRole: string
    taskId?: Id<"tasks">
    message: string
    createdAt: number
}

// Utility functions
function formatTime(timestamp: number): string {
    const now = Date.now()
    const diff = now - timestamp
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)

    if (minutes < 1) return 'just now'
    if (minutes < 60) return `${minutes}m ago`
    if (hours < 24) return `${hours}h ago`
    if (days < 7) return `${days}d ago`
    return new Date(timestamp).toLocaleDateString()
}

function getInitials(name: string): string {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
}

function getLevelBadge(level: string): { text: string; color: string } {
    switch (level) {
        case 'lead': return { text: 'LEAD', color: 'lead' }
        case 'specialist': return { text: 'SPC', color: 'specialist' }
        case 'intern': return { text: 'INT', color: 'intern' }
        default: return { text: 'SPC', color: 'specialist' }
    }
}

// Icons
const SunIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="5" /><path d="M12 1v2m0 18v2M4.22 4.22l1.42 1.42m12.72 12.72l1.42 1.42M1 12h2m18 0h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
    </svg>
)

const MoonIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
)

const UsersIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
)

const ActivityIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
)

const EyeIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
    </svg>
)

// Header Component with Panel Toggles
function Header({
    agentsCount,
    tasksCount,
    isDark,
    onToggleTheme,
    showSidebar,
    showFeed,
    onToggleSidebar,
    onToggleFeed
}: {
    agentsCount: number;
    tasksCount: number;
    isDark: boolean;
    onToggleTheme: () => void;
    showSidebar: boolean;
    showFeed: boolean;
    onToggleSidebar: () => void;
    onToggleFeed: () => void;
}) {
    const [time, setTime] = useState(new Date())

    useEffect(() => {
        const timer = setInterval(() => setTime(new Date()), 1000)
        return () => clearInterval(timer)
    }, [])

    return (
        <header className="header">
            <div className="header-left">
                <button
                    className={`panel-toggle ${showSidebar ? 'active' : ''}`}
                    onClick={onToggleSidebar}
                    title={showSidebar ? 'Hide Agents' : 'Show Agents'}
                >
                    <UsersIcon />
                    <span>Agents</span>
                </button>

                <div className="header-logo">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                    </svg>
                    <span>MISSION CONTROL</span>
                </div>
                <div className="header-project">AgentCrab</div>
            </div>

            <div className="header-stats">
                <div className="header-stat">
                    <div className="header-stat-value">{agentsCount}</div>
                    <div className="header-stat-label">AGENTS ACTIVE</div>
                </div>
                <div className="header-stat">
                    <div className="header-stat-value">{tasksCount}</div>
                    <div className="header-stat-label">TASKS IN QUEUE</div>
                </div>
            </div>

            <div className="header-right">
                <button
                    className="header-btn"
                    onClick={() => window.open('https://github.com/KamalSDhami/AgentCrab', '_blank')}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                        <polyline points="14 2 14 8 20 8"></polyline>
                    </svg>
                    Docs
                </button>

                <button className="theme-toggle" onClick={onToggleTheme} title={isDark ? 'Light Mode' : 'Dark Mode'}>
                    {isDark ? <SunIcon /> : <MoonIcon />}
                </button>

                <div className="header-time">
                    <div className="header-time-clock">
                        {time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </div>
                    <div className="header-time-date">
                        {time.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).toUpperCase()}
                    </div>
                </div>

                <div className="header-status">
                    <span className="header-status-dot"></span>
                    ONLINE
                </div>

                <button
                    className={`panel-toggle ${showFeed ? 'active' : ''}`}
                    onClick={onToggleFeed}
                    title={showFeed ? 'Hide Feed' : 'Show Feed'}
                >
                    <ActivityIcon />
                    <span>Feed</span>
                </button>
            </div>
        </header>
    )
}

// Agent Card Component with Track button
function AgentCard({ agent, isActive, isTracking, onClick, onTrack }: {
    agent: Agent;
    isActive: boolean;
    isTracking: boolean;
    onClick: () => void;
    onTrack: (e: React.MouseEvent) => void;
}) {
    const badge = getLevelBadge(agent.level)
    const isOnline = agent.lastSeen ? (Date.now() - agent.lastSeen) < 300000 : false // 5 min threshold
    const emoji = agent.identityProfile?.emoji

    return (
        <div className={`agent-card ${isActive ? 'active' : ''} ${isTracking ? 'tracking' : ''}`} onClick={onClick}>
            <div className={`agent-avatar ${agent.level}`}>
                {emoji || getInitials(agent.name)}
                <span className={`online-dot ${isOnline ? 'online' : 'offline'}`} title={isOnline ? 'Online' : 'Offline'} />
            </div>
            <div className="agent-info">
                <div className="agent-name-row">
                    <span className="agent-name">{agent.name}</span>
                    <span className={`agent-badge ${badge.color}`}>{badge.text}</span>
                    {agent.isBoardLead && <span className="agent-badge lead">★ LEAD</span>}
                </div>
                <div className="agent-role">{agent.role}</div>
                {agent.openclawSessionId && (
                    <div className="agent-session-id" title={agent.openclawSessionId}>
                        🔗 {agent.openclawSessionId}
                    </div>
                )}
            </div>
            <button
                className={`track-btn ${isTracking ? 'active' : ''}`}
                onClick={onTrack}
                title={isTracking ? 'Stop Tracking' : 'Track Agent'}
            >
                <EyeIcon />
            </button>
            <div className={`agent-status-badge ${agent.status === 'active' ? 'working' : agent.status === 'provisioning' ? 'provisioning' : agent.status === 'offline' ? 'offline' : 'idle'}`}>
                {agent.status === 'active' ? 'WORKING' : agent.status === 'provisioning' ? 'PROV' : agent.status === 'offline' ? 'OFF' : agent.status === 'blocked' ? 'BLOCKED' : 'IDLE'}
            </div>
        </div>
    )
}

// Agent Editor Component
function AgentEditor({ agent, onClose }: { agent: Agent; onClose: () => void }) {
    const [activeTab, setActiveTab] = useState<'soul' | 'memory' | 'config'>('soul')
    const [soulContent, setSoulContent] = useState('')
    const [memoryContent, setMemoryContent] = useState('')
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const updateStatus = useMutation(api.agents.updateStatus)
    const updateSoul = useMutation(api.agents.updateSoul)

    const isOnline = agent.lastSeen ? (Date.now() - agent.lastSeen) < 300000 : false
    const emoji = agent.identityProfile?.emoji

    useEffect(() => {
        setLoading(true)
        // Load actual SOUL template from database if available
        setSoulContent(agent.soulTemplate || `# ${agent.name} - ${agent.role}\n\nYou are ${agent.name}, the ${agent.role} for the Mission Control team.\n\n## Responsibilities\n- ${agent.role} tasks\n- Collaborate with other agents using @mentions\n- Report progress to @Jarvis`)
        setMemoryContent(`# ${agent.name} Memory\n\n## Recent Context\n- Last active: ${agent.lastSeen ? new Date(agent.lastSeen).toLocaleString() : 'Never'}\n- Current status: ${agent.status}\n- Session: ${agent.openclawSessionId || 'Not bound'}\n- Provision: ${agent.provisionStatus || 'unknown'}\n\n## Working Notes\n(Add notes here that should persist between sessions)`)
        setLoading(false)
    }, [agent])

    const handleStatusChange = async (newStatus: "idle" | "active" | "blocked") => {
        await updateStatus({ id: agent._id, status: newStatus })
    }

    const handleSave = async () => {
        setSaving(true)
        try {
            if (activeTab === 'soul') {
                await updateSoul({ id: agent._id, soulTemplate: soulContent })
            }
        } catch (e) {
            console.error('Save failed', e)
        }
        setSaving(false)
    }

    return (
        <div className="detail-panel">
            <div className="detail-header">
                <div className="detail-title">
                    <div className={`agent-avatar large ${agent.level}`}>
                        {emoji || getInitials(agent.name)}
                        <span className={`online-dot ${isOnline ? 'online' : 'offline'}`} />
                    </div>
                    <div>
                        <h3>{agent.name} {agent.isBoardLead && '★'}</h3>
                        <p>{agent.identityProfile?.description || agent.role}</p>
                    </div>
                </div>
                <button className="modal-close" onClick={onClose}>×</button>
            </div>

            {/* Gateway Info Section */}
            <div className="detail-section">
                <label>Gateway Connection</label>
                <div className="gateway-info">
                    <div className="gateway-row">
                        <span className="gateway-label">Session</span>
                        <code className="session-key">{agent.openclawSessionId || 'Not bound'}</code>
                    </div>
                    <div className="gateway-row">
                        <span className="gateway-label">Status</span>
                        <span className={`provision-badge ${agent.provisionStatus === 'confirmed' ? 'confirmed' : agent.provisionStatus === 'failed' ? 'failed' : 'pending'}`}>
                            {agent.provisionStatus === 'confirmed' ? '✓ Provisioned' : agent.provisionStatus === 'failed' ? '✗ Failed' : '⏳ Pending'}
                        </span>
                    </div>
                    {agent.heartbeatConfig?.cronExpression && (
                        <div className="gateway-row">
                            <span className="gateway-label">Heartbeat</span>
                            <code className="session-key">{agent.heartbeatConfig.cronExpression}</code>
                        </div>
                    )}
                    <div className="gateway-row">
                        <span className="gateway-label">Last Seen</span>
                        <span>{agent.lastSeen ? formatTime(agent.lastSeen) : 'Never'}</span>
                    </div>
                </div>
            </div>

            <div className="detail-section">
                <label>Status</label>
                <div className="status-buttons">
                    <button
                        className={`status-btn ${agent.status === 'idle' ? 'active' : ''}`}
                        onClick={() => handleStatusChange('idle')}
                    >
                        Idle
                    </button>
                    <button
                        className={`status-btn working ${agent.status === 'active' ? 'active' : ''}`}
                        onClick={() => handleStatusChange('active')}
                    >
                        Working
                    </button>
                    <button
                        className={`status-btn blocked ${agent.status === 'blocked' ? 'active' : ''}`}
                        onClick={() => handleStatusChange('blocked')}
                    >
                        Blocked
                    </button>
                </div>
            </div>

            <div className="detail-section">
                <label>Agent Files</label>
                <div className="editor-tabs">
                    <button
                        className={`editor-tab ${activeTab === 'soul' ? 'active' : ''}`}
                        onClick={() => setActiveTab('soul')}
                    >
                        SOUL.md
                    </button>
                    <button
                        className={`editor-tab ${activeTab === 'memory' ? 'active' : ''}`}
                        onClick={() => setActiveTab('memory')}
                    >
                        Memory
                    </button>
                    <button
                        className={`editor-tab ${activeTab === 'config' ? 'active' : ''}`}
                        onClick={() => setActiveTab('config')}
                    >
                        Config
                    </button>
                </div>

                <div className="editor-content">
                    {loading ? (
                        <div className="empty-state"><p>Loading...</p></div>
                    ) : activeTab === 'config' ? (
                        <div className="config-view">
                            <pre className="editor-textarea" style={{ fontFamily: 'monospace', fontSize: '12px' }}>
                                {JSON.stringify({
                                    sessionKey: agent.sessionKey,
                                    openclawSessionId: agent.openclawSessionId,
                                    level: agent.level,
                                    isBoardLead: agent.isBoardLead,
                                    provisionStatus: agent.provisionStatus,
                                    identityProfile: agent.identityProfile,
                                    heartbeatConfig: agent.heartbeatConfig,
                                }, null, 2)}
                            </pre>
                        </div>
                    ) : (
                        <textarea
                            className="editor-textarea"
                            value={activeTab === 'soul' ? soulContent : memoryContent}
                            onChange={e => activeTab === 'soul' ? setSoulContent(e.target.value) : setMemoryContent(e.target.value)}
                        />
                    )}
                    <div className="editor-actions">
                        <button className="btn btn-secondary btn-sm" onClick={onClose}>Cancel</button>
                        <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving || activeTab === 'config'}>
                            {saving ? 'Saving...' : 'Save Changes'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}

// Agent Sidebar Component
function AgentSidebar({ agents, selectedAgent, trackedAgentId, onSelectAgent, onTrackAgent, isVisible }: {
    agents: Agent[] | undefined;
    selectedAgent: Agent | null;
    trackedAgentId: string | null;
    onSelectAgent: (agent: Agent | null) => void;
    onTrackAgent: (agentId: string | null) => void;
    isVisible: boolean;
}) {
    if (!isVisible) return null

    return (
        <>
            <aside className="sidebar">
                <div className="sidebar-title">
                    <div className="sidebar-title-left">
                        <div className="sidebar-icon">👤</div>
                        <h2>AGENTS</h2>
                    </div>
                    <span className="sidebar-title-count">{agents?.length ?? 0}</span>
                </div>
                <div className="sidebar-agents">
                    {agents?.map((agent) => (
                        <AgentCard
                            key={agent._id}
                            agent={agent}
                            isActive={selectedAgent?._id === agent._id}
                            isTracking={trackedAgentId === agent._id}
                            onClick={() => onSelectAgent(selectedAgent?._id === agent._id ? null : agent)}
                            onTrack={(e) => {
                                e.stopPropagation()
                                onTrackAgent(trackedAgentId === agent._id ? null : agent._id)
                            }}
                        />
                    ))}
                </div>
            </aside>

            {selectedAgent && (
                <AgentEditor
                    agent={selectedAgent}
                    onClose={() => onSelectAgent(null)}
                />
            )}
        </>
    )
}

// Tracked Agent Banner
function TrackedAgentBanner({ agent, onStop }: { agent: Agent; onStop: () => void }) {
    return (
        <div className="tracked-banner">
            <div className="tracked-info">
                <EyeIcon />
                <span>Tracking: <strong>{agent.name}</strong></span>
                <span className={`tracked-status ${agent.status}`}>{agent.status.toUpperCase()}</span>
            </div>
            <button className="btn btn-secondary btn-sm" onClick={onStop}>Stop Tracking</button>
        </div>
    )
}

// Task Detail Modal
function TaskDetailModal({ task, agents, onClose }: {
    task: Task;
    agents: Agent[] | undefined;
    onClose: () => void
}) {
    const updateStatus = useMutation(api.tasks.updateStatus)
    const assignTask = useMutation(api.tasks.assign)
    const updateAgentStatus = useMutation(api.agents.updateStatus)
    const [selectedAssignee, setSelectedAssignee] = useState<string>('')

    const assignees = task.assigneeIds
        .map(id => agents?.find(a => a._id === id))
        .filter(Boolean) as Agent[]

    const handleStatusChange = async (newStatus: typeof task.status) => {
        await updateStatus({ id: task._id, status: newStatus })
    }

    const handleAssign = async () => {
        if (selectedAssignee) {
            await assignTask({ id: task._id, agentId: selectedAssignee as Id<"agents"> })
            await updateAgentStatus({ id: selectedAssignee as Id<"agents">, status: 'active' })
            setSelectedAssignee('')
        }
    }

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal task-modal" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <div className="task-modal-title">
                        {task.priority && <span className={`task-priority-dot large ${task.priority}`}></span>}
                        <h3>{task.title}</h3>
                    </div>
                    <button className="modal-close" onClick={onClose}>×</button>
                </div>

                <div className="modal-body">
                    <div className="detail-section">
                        <label>Description</label>
                        <p className="task-description-full">{task.description || 'No description'}</p>
                    </div>

                    <div className="detail-section">
                        <label>Status</label>
                        <div className="status-buttons">
                            {['inbox', 'assigned', 'in_progress', 'review', 'done'].map(status => (
                                <button
                                    key={status}
                                    className={`status-btn ${task.status === status ? 'active' : ''}`}
                                    onClick={() => handleStatusChange(status as typeof task.status)}
                                >
                                    {status.replace('_', ' ')}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="detail-section">
                        <label>Assigned To</label>
                        <div className="assignees-list">
                            {assignees.length === 0 ? (
                                <span className="empty-text">Unassigned</span>
                            ) : (
                                assignees.map(agent => (
                                    <div key={agent._id} className="assignee-chip">
                                        <span className={`agent-avatar small ${agent.level}`}>
                                            {getInitials(agent.name)}
                                        </span>
                                        <span>{agent.name}</span>
                                    </div>
                                ))
                            )}
                        </div>
                        <div className="assign-row">
                            <select
                                value={selectedAssignee}
                                onChange={e => setSelectedAssignee(e.target.value)}
                            >
                                <option value="">Add assignee...</option>
                                {agents?.filter(a => !task.assigneeIds.includes(a._id)).map(agent => (
                                    <option key={agent._id} value={agent._id}>
                                        {agent.name} - {agent.role}
                                    </option>
                                ))}
                            </select>
                            <button
                                className="btn btn-primary btn-sm"
                                onClick={handleAssign}
                                disabled={!selectedAssignee}
                            >
                                Assign
                            </button>
                        </div>
                    </div>

                    {task.tags.length > 0 && (
                        <div className="detail-section">
                            <label>Tags</label>
                            <div className="task-tags">
                                {task.tags.map((tag, i) => (
                                    <span key={i} className="task-tag">{tag}</span>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="detail-row">
                        <div className="detail-section half">
                            <label>Created</label>
                            <p>{formatTime(task.createdAt)}</p>
                        </div>
                        <div className="detail-section half">
                            <label>Updated</label>
                            <p>{formatTime(task.updatedAt)}</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

// Task Card Component
function TaskCard({ task, agents, onClick }: { task: Task; agents: Agent[] | undefined; onClick: () => void }) {
    const assignees = task.assigneeIds
        .map(id => agents?.find(a => a._id === id))
        .filter(Boolean) as Agent[]

    return (
        <div className="task-card" onClick={onClick}>
            {task.priority && (
                <div className={`task-priority-bar ${task.priority}`}></div>
            )}
            <div className="task-content">
                <div className="task-title">{task.title}</div>
                {task.description && (
                    <div className="task-description">{task.description}</div>
                )}
                {task.tags.length > 0 && (
                    <div className="task-tags">
                        {task.tags.slice(0, 3).map((tag, i) => (
                            <span key={i} className="task-tag">{tag}</span>
                        ))}
                    </div>
                )}
                <div className="task-meta">
                    <div className="task-assignees">
                        {assignees.map((agent, i) => (
                            <div key={i} className="task-assignee" title={agent.name}>
                                {getInitials(agent.name)}
                            </div>
                        ))}
                        {assignees.length === 0 && (
                            <span className="task-unassigned">Unassigned</span>
                        )}
                    </div>
                    <span className="task-time">{formatTime(task.updatedAt)}</span>
                </div>
            </div>
        </div>
    )
}

// Kanban Column Component
function Column({ title, tasks, agents, onTaskClick }: {
    title: string;
    tasks: Task[];
    agents: Agent[] | undefined;
    onTaskClick: (task: Task) => void;
}) {
    return (
        <div className="column">
            <div className="column-header">
                <span className="column-icon"></span>
                <span className="column-title">{title}</span>
                <span className="column-count">{tasks.length}</span>
            </div>
            <div className="column-tasks">
                {tasks.map((task) => (
                    <TaskCard
                        key={task._id}
                        task={task}
                        agents={agents}
                        onClick={() => onTaskClick(task)}
                    />
                ))}
            </div>
        </div>
    )
}

// New Task Modal Component
function NewTaskModal({ isOpen, onClose, agents }: {
    isOpen: boolean;
    onClose: () => void;
    agents: Agent[] | undefined
}) {
    const createTask = useMutation(api.tasks.create)
    const [title, setTitle] = useState('')
    const [description, setDescription] = useState('')
    const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium')
    const [tags, setTags] = useState('')

    if (!isOpen) return null

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!title.trim()) return

        const jarvis = agents?.find(a => a.name === 'Jarvis')

        await createTask({
            title: title.trim(),
            description: description.trim(),
            tags: tags.split(',').map((t: string) => t.trim()).filter(Boolean),
            priority,
            createdBy: jarvis?._id || agents?.[0]?._id as Id<"agents">
        })

        setTitle('')
        setDescription('')
        setPriority('medium')
        setTags('')
        onClose()
    }

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h3>Create New Task</h3>
                    <button className="modal-close" onClick={onClose}>×</button>
                </div>
                <form onSubmit={handleSubmit}>
                    <div className="modal-body">
                        <div className="form-group">
                            <label>Title *</label>
                            <input
                                type="text"
                                value={title}
                                onChange={e => setTitle(e.target.value)}
                                placeholder="What needs to be done?"
                                required
                            />
                        </div>
                        <div className="form-group">
                            <label>Description</label>
                            <textarea
                                value={description}
                                onChange={e => setDescription(e.target.value)}
                                placeholder="Add more details..."
                                rows={3}
                            />
                        </div>
                        <div className="form-row">
                            <div className="form-group">
                                <label>Priority</label>
                                <select value={priority} onChange={e => setPriority(e.target.value as 'low' | 'medium' | 'high')}>
                                    <option value="low">Low</option>
                                    <option value="medium">Medium</option>
                                    <option value="high">High</option>
                                </select>
                            </div>
                            <div className="form-group">
                                <label>Tags</label>
                                <input
                                    type="text"
                                    value={tags}
                                    onChange={e => setTags(e.target.value)}
                                    placeholder="research, content"
                                />
                            </div>
                        </div>
                    </div>
                    <div className="modal-actions">
                        <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
                        <button type="submit" className="btn btn-primary">Create Task</button>
                    </div>
                </form>
            </div>
        </div>
    )
}

// Task Board Component
function TaskBoard({ tasks, agents, onNewTask, onTaskClick, trackedAgent }: {
    tasks: Task[] | undefined;
    agents: Agent[] | undefined;
    onNewTask: () => void;
    onTaskClick: (task: Task) => void;
    trackedAgent: Agent | null;
}) {
    const columns = [
        { key: 'inbox', title: 'INBOX' },
        { key: 'assigned', title: 'ASSIGNED' },
        { key: 'in_progress', title: 'IN PROGRESS' },
        { key: 'review', title: 'REVIEW' },
        { key: 'done', title: 'DONE' },
    ]

    // Filter tasks by tracked agent if tracking
    const filteredTasks = trackedAgent
        ? tasks?.filter(t => t.assigneeIds.includes(trackedAgent._id))
        : tasks

    const totalActive = filteredTasks?.filter(t => t.status !== 'done').length ?? 0

    return (
        <main className="main">
            <div className="board-header">
                <div className="board-title">
                    <span className="board-icon">★</span>
                    <span>MISSION QUEUE</span>
                    {trackedAgent && <span className="board-filter-active">• Filtered by {trackedAgent.name}</span>}
                </div>
                <div className="board-meta">
                    <span className="board-filter active">● {totalActive} active</span>
                </div>
                <button className="btn btn-primary" onClick={onNewTask}>+ New Task</button>
            </div>
            <div className="board">
                {columns.map(({ key, title }) => (
                    <Column
                        key={key}
                        title={title}
                        tasks={filteredTasks?.filter(t => t.status === key) ?? []}
                        agents={agents}
                        onTaskClick={onTaskClick}
                    />
                ))}
            </div>
        </main>
    )
}

// Activity Item Component
function ActivityItem({ activity }: { activity: Activity }) {
    return (
        <div className="activity-item">
            <div className="activity-avatar">
                {getInitials(activity.agentName)}
            </div>
            <div className="activity-content">
                <div className="activity-text">
                    <strong>{activity.agentName}</strong> {activity.message}
                </div>
                <div className="activity-time">{formatTime(activity.createdAt)}</div>
            </div>
        </div>
    )
}

// Agent Pills Row
function AgentPills({ agents, selectedAgent, onSelect }: {
    agents: Agent[] | undefined;
    selectedAgent: string | null;
    onSelect: (name: string | null) => void;
}) {
    return (
        <div className="agent-pills">
            <button
                className={`agent-pill ${selectedAgent === null ? 'active' : ''}`}
                onClick={() => onSelect(null)}
            >
                All Agents
            </button>
            {agents?.slice(0, 6).map(agent => (
                <button
                    key={agent._id}
                    className={`agent-pill ${selectedAgent === agent.name ? 'active' : ''}`}
                    onClick={() => onSelect(selectedAgent === agent.name ? null : agent.name)}
                >
                    {agent.name}
                </button>
            ))}
        </div>
    )
}

// Activity Feed Component
function ActivityFeed({ activities, agents, trackedAgentName, isVisible }: {
    activities: Activity[] | undefined;
    agents: Agent[] | undefined;
    trackedAgentName: string | null;
    isVisible: boolean;
}) {
    const [filter, setFilter] = useState('all')
    const [agentFilter, setAgentFilter] = useState<string | null>(null)

    // Auto-filter by tracked agent
    const effectiveAgentFilter = trackedAgentName || agentFilter

    const filters = [
        { key: 'all', label: 'All' },
        { key: 'tasks', label: 'Tasks' },
        { key: 'comments', label: 'Comments' },
        { key: 'docs', label: 'Docs' },
    ]

    const filteredActivities = activities?.filter(a => {
        if (effectiveAgentFilter && a.agentName !== effectiveAgentFilter) return false
        if (filter === 'all') return true
        if (filter === 'tasks') return a.type.includes('task')
        if (filter === 'comments') return a.type === 'message_sent'
        if (filter === 'docs') return a.type === 'document_created'
        return true
    })

    if (!isVisible) return null

    return (
        <aside className="feed">
            <div className="feed-header">
                <div className="feed-title-row">
                    <span className="feed-icon"></span>
                    <span className="feed-title">LIVE FEED</span>
                </div>
                <div className="feed-filters">
                    {filters.map(({ key, label }) => (
                        <button
                            key={key}
                            className={`feed-filter ${filter === key ? 'active' : ''}`}
                            onClick={() => setFilter(key)}
                        >
                            {label}
                        </button>
                    ))}
                </div>
                {!trackedAgentName && (
                    <AgentPills agents={agents} selectedAgent={agentFilter} onSelect={setAgentFilter} />
                )}
            </div>
            <div className="feed-scroll">
                {filteredActivities?.length === 0 ? (
                    <div className="empty-state">
                        <p>No activity yet</p>
                    </div>
                ) : (
                    filteredActivities?.map((activity) => (
                        <ActivityItem key={activity._id} activity={activity} />
                    ))
                )}
            </div>
        </aside>
    )
}

// Main App Component
export default function App() {
    const agents = useQuery(api.agents.list)
    const tasks = useQuery(api.tasks.list, {})
    const activities = useQuery(api.activities.list, { limit: 50 })

    const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null)
    const [trackedAgentId, setTrackedAgentId] = useState<string | null>(null)
    const [selectedTask, setSelectedTask] = useState<Task | null>(null)
    const [isNewTaskOpen, setIsNewTaskOpen] = useState(false)
    const [isDarkMode, setIsDarkMode] = useState(() => {
        const saved = localStorage.getItem('theme')
        return saved ? saved === 'dark' : true
    })
    const [showSidebar, setShowSidebar] = useState(true)
    const [showFeed, setShowFeed] = useState(true)
    const [isInitialized, setIsInitialized] = useState(false)

    // Initialize database on first load
    useEffect(() => {
        const initDatabase = async () => {
            try {
                const convexUrl = import.meta.env.VITE_CONVEX_URL
                const response = await fetch(`${convexUrl}/api/init`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ seedTasks: false })
                })
                const result = await response.json()
                if (result.status === 'ok') {
                    setIsInitialized(true)
                }
            } catch (error) {
                console.error('Failed to initialize database:', error)
                setIsInitialized(true) // Continue anyway
            }
        }

        if (!isInitialized && agents === undefined) {
            initDatabase()
        }
    }, [agents, isInitialized])

    const trackedAgent = trackedAgentId ? agents?.find(a => a._id === trackedAgentId) ?? null : null

    useEffect(() => {
        localStorage.setItem('theme', isDarkMode ? 'dark' : 'light')
        document.body.classList.toggle('light-mode', !isDarkMode)
    }, [isDarkMode])

    const activeAgents = agents?.filter(a => a.status === 'active').length ?? 0
    const totalTasks = tasks?.filter(t => t.status !== 'done').length ?? 0

    return (
        <div className={`app ${!showSidebar ? 'sidebar-hidden' : ''} ${!showFeed ? 'feed-hidden' : ''}`}>
            <Header
                agentsCount={activeAgents}
                tasksCount={totalTasks}
                isDark={isDarkMode}
                onToggleTheme={() => setIsDarkMode(!isDarkMode)}
                showSidebar={showSidebar}
                showFeed={showFeed}
                onToggleSidebar={() => setShowSidebar(!showSidebar)}
                onToggleFeed={() => setShowFeed(!showFeed)}
            />

            {trackedAgent && (
                <TrackedAgentBanner agent={trackedAgent} onStop={() => setTrackedAgentId(null)} />
            )}

            <AgentSidebar
                agents={agents}
                selectedAgent={selectedAgent}
                trackedAgentId={trackedAgentId}
                onSelectAgent={setSelectedAgent}
                onTrackAgent={setTrackedAgentId}
                isVisible={showSidebar}
            />
            <TaskBoard
                tasks={tasks}
                agents={agents}
                onNewTask={() => setIsNewTaskOpen(true)}
                onTaskClick={setSelectedTask}
                trackedAgent={trackedAgent}
            />
            <ActivityFeed
                activities={activities}
                agents={agents}
                trackedAgentName={trackedAgent?.name ?? null}
                isVisible={showFeed}
            />

            <NewTaskModal
                isOpen={isNewTaskOpen}
                onClose={() => setIsNewTaskOpen(false)}
                agents={agents}
            />

            {selectedTask && (
                <TaskDetailModal
                    task={selectedTask}
                    agents={agents}
                    onClose={() => setSelectedTask(null)}
                />
            )}
        </div>
    )
}
