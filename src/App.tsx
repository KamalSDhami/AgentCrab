import { useQuery, useMutation } from 'convex/react'
import { api } from '../convex/_generated/api'
import { useState, useEffect } from 'react'
import type { Id } from '../convex/_generated/dataModel'

// Type definitions
interface Agent {
    _id: Id<"agents">
    name: string
    role: string
    status: "idle" | "active" | "blocked"
    level: "intern" | "specialist" | "lead"
    sessionKey: string
    lastSeen?: number
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

// Header Component
function Header({ agentsCount, tasksCount }: { agentsCount: number; tasksCount: number }) {
    const [time, setTime] = useState(new Date())

    useEffect(() => {
        const timer = setInterval(() => setTime(new Date()), 1000)
        return () => clearInterval(timer)
    }, [])

    return (
        <header className="header">
            <div className="header-left">
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
            </div>
        </header>
    )
}

// Agent Card Component
function AgentCard({ agent, isActive, onClick }: { agent: Agent; isActive: boolean; onClick: () => void }) {
    const badge = getLevelBadge(agent.level)

    return (
        <div className={`agent-card ${isActive ? 'active' : ''}`} onClick={onClick}>
            <div className={`agent-avatar ${agent.level}`}>
                {getInitials(agent.name)}
            </div>
            <div className="agent-info">
                <div className="agent-name-row">
                    <span className="agent-name">{agent.name}</span>
                    <span className={`agent-badge ${badge.color}`}>{badge.text}</span>
                </div>
                <div className="agent-role">{agent.role}</div>
            </div>
            <div className={`agent-status-badge ${agent.status === 'active' ? 'working' : 'idle'}`}>
                {agent.status === 'active' ? 'WORKING' : 'IDLE'}
            </div>
        </div>
    )
}

// Agent Detail Panel
function AgentDetailPanel({ agent, tasks, onClose }: {
    agent: Agent;
    tasks: Task[] | undefined;
    onClose: () => void
}) {
    const updateStatus = useMutation(api.agents.updateStatus)
    const agentTasks = tasks?.filter(t => t.assigneeIds.includes(agent._id)) ?? []

    const handleStatusChange = async (newStatus: "idle" | "active" | "blocked") => {
        await updateStatus({ id: agent._id, status: newStatus })
    }

    return (
        <div className="detail-panel">
            <div className="detail-header">
                <div className="detail-title">
                    <div className={`agent-avatar large ${agent.level}`}>
                        {getInitials(agent.name)}
                    </div>
                    <div>
                        <h3>{agent.name}</h3>
                        <p>{agent.role}</p>
                    </div>
                </div>
                <button className="modal-close" onClick={onClose}>×</button>
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
                <label>Session Key</label>
                <code className="session-key">{agent.sessionKey}</code>
            </div>

            <div className="detail-section">
                <label>Assigned Tasks ({agentTasks.length})</label>
                <div className="mini-task-list">
                    {agentTasks.length === 0 ? (
                        <p className="empty-text">No tasks assigned</p>
                    ) : (
                        agentTasks.map(task => (
                            <div key={task._id} className="mini-task">
                                <span className={`task-priority-dot ${task.priority || 'medium'}`}></span>
                                <span>{task.title}</span>
                            </div>
                        ))
                    )}
                </div>
            </div>

            <div className="detail-section">
                <label>Last Active</label>
                <p>{agent.lastSeen ? formatTime(agent.lastSeen) : 'Never'}</p>
            </div>
        </div>
    )
}

// Agent Sidebar Component
function AgentSidebar({ agents, selectedAgent, onSelectAgent, tasks }: {
    agents: Agent[] | undefined;
    selectedAgent: Agent | null;
    onSelectAgent: (agent: Agent | null) => void;
    tasks: Task[] | undefined;
}) {
    return (
        <aside className="sidebar">
            <div className="sidebar-title">
                <div className="sidebar-title-left">
                    <span className="sidebar-icon">👤</span>
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
                        onClick={() => onSelectAgent(selectedAgent?._id === agent._id ? null : agent)}
                    />
                ))}
            </div>

            {selectedAgent && (
                <AgentDetailPanel
                    agent={selectedAgent}
                    tasks={tasks}
                    onClose={() => onSelectAgent(null)}
                />
            )}
        </aside>
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
                        {task.tags.map((tag, i) => (
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
                <span className="column-icon">●</span>
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
            tags: tags.split(',').map(t => t.trim()).filter(Boolean),
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
function TaskBoard({ tasks, agents, onNewTask, onTaskClick }: {
    tasks: Task[] | undefined;
    agents: Agent[] | undefined;
    onNewTask: () => void;
    onTaskClick: (task: Task) => void;
}) {
    const columns = [
        { key: 'inbox', title: 'INBOX' },
        { key: 'assigned', title: 'ASSIGNED' },
        { key: 'in_progress', title: 'IN PROGRESS' },
        { key: 'review', title: 'REVIEW' },
        { key: 'done', title: 'DONE' },
    ]

    const totalActive = tasks?.filter(t => t.status !== 'done').length ?? 0

    return (
        <main className="main">
            <div className="board-header">
                <div className="board-title">
                    <span className="board-icon">★</span>
                    <span>MISSION QUEUE</span>
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
                        tasks={tasks?.filter(t => t.status === key) ?? []}
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
function ActivityFeed({ activities, agents }: { activities: Activity[] | undefined; agents: Agent[] | undefined }) {
    const [filter, setFilter] = useState('all')
    const [agentFilter, setAgentFilter] = useState<string | null>(null)

    const filters = [
        { key: 'all', label: 'All' },
        { key: 'tasks', label: 'Tasks' },
        { key: 'comments', label: 'Comments' },
        { key: 'docs', label: 'Docs' },
    ]

    const filteredActivities = activities?.filter(a => {
        if (agentFilter && a.agentName !== agentFilter) return false
        if (filter === 'all') return true
        if (filter === 'tasks') return a.type.includes('task')
        if (filter === 'comments') return a.type === 'message_sent'
        if (filter === 'docs') return a.type === 'document_created'
        return true
    })

    return (
        <aside className="feed">
            <div className="feed-header">
                <div className="feed-title-row">
                    <span className="feed-icon">●</span>
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
                <AgentPills agents={agents} selectedAgent={agentFilter} onSelect={setAgentFilter} />
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
    const [selectedTask, setSelectedTask] = useState<Task | null>(null)
    const [isNewTaskOpen, setIsNewTaskOpen] = useState(false)

    const activeAgents = agents?.length ?? 0
    const totalTasks = tasks?.filter(t => t.status !== 'done').length ?? 0

    return (
        <div className="app">
            <Header agentsCount={activeAgents} tasksCount={totalTasks} />
            <AgentSidebar
                agents={agents}
                selectedAgent={selectedAgent}
                onSelectAgent={setSelectedAgent}
                tasks={tasks}
            />
            <TaskBoard
                tasks={tasks}
                agents={agents}
                onNewTask={() => setIsNewTaskOpen(true)}
                onTaskClick={setSelectedTask}
            />
            <ActivityFeed activities={activities} agents={agents} />

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
