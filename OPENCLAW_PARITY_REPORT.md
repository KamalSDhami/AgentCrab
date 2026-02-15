# Feature Parity Report: OpenClaw Mission Control vs AgentCrab

> Generated during v2.2 architectural overhaul. This report compares the reference
> OpenClaw Mission Control (`openclaw-mission-control/`) with AgentCrab
> (`agent-monitor/`) to identify feature gaps and unique strengths.

---

## 1. Gateway RPC Methods

| RPC Method | OpenClaw MC | AgentCrab | Gap |
|---|---|---|---|
| `health` | ✅ `openclaw_call("health")` | ✅ `gateway_health()` | — |
| `chat.send` | ✅ `send_message()` with session_key, deliver, idempotencyKey | ✅ `send_message()` — same params | — |
| `chat.history` | ✅ `get_chat_history()` | ✅ `get_chat_history()` | — |
| `chat.abort` | ✅ Listed in GATEWAY_METHODS | ❌ Not implemented | Missing |
| `sessions.list` | ✅ Used in session_service | ✅ `list_sessions()` | — |
| `sessions.patch` | ✅ `ensure_session()` | ✅ `ensure_session()` | — |
| `sessions.delete` | ✅ `delete_session()` | ❌ Not implemented | Missing |
| `sessions.reset/compact/preview` | ✅ Listed | ❌ Not implemented | Missing |
| `agents.list/create/update/delete` | ✅ Used in provisioning | ❌ Not implemented | Missing |
| `agents.files.get/set` | ✅ Used in provisioning | ✅ Implemented | — |
| `config.get/set/apply/patch/schema` | ✅ Used in provisioning | ❌ Not implemented | Missing |
| `wake` | ✅ Listed (MC uses chat.send+deliver instead) | ✅ `wake_agent()` — chat.send primary, wake RPC fallback | — |
| `logs.tail` | ✅ Listed | ❌ Not implemented | Missing |
| `usage.status/cost` | ✅ Listed | ❌ Not implemented | Missing |
| `exec.approvals.*` (6 methods) | ✅ Listed | ❌ Not implemented | Missing |
| `skills.*` (4 methods) | ✅ Listed + marketplace service | ❌ Not implemented | Missing |
| `cron.*` (6 methods) | ✅ Listed | ❌ Gateway cron RPCs not used; CLI wrapper used instead | Partial |

**Summary:** AgentCrab implements ~8 of ~100+ gateway RPC methods. Most advanced RPCs are missing.

---

## 2. Task Lifecycle Management

| Feature | OpenClaw MC | AgentCrab | Gap |
|---|---|---|---|
| Task CRUD | ✅ Full REST with pagination | ✅ Full REST (list, create, patch, delete) | — |
| Task statuses | ✅ inbox, in_progress, review, done | ✅ Same + pending, analyzing, delegated, running, reviewing, completed, archived | **AgentCrab has MORE** |
| Task SSE streaming | ✅ Per-board SSE stream | ✅ Global SSE event bus | MC is per-board scoped |
| Task comments | ✅ POST with @mention routing | ❌ No comment system | **Missing** |
| Task dependencies | ✅ Full dependency graph, blocking rules | ❌ Not implemented | **Missing** |
| Task custom fields | ✅ Full custom field definitions + validation | ❌ Not implemented | **Missing** |
| Task tags | ✅ Multi-tag assignment | ❌ Not implemented | **Missing** |
| Task result storage | ❌ No explicit result model | ✅ TaskResult with content, summary, files, metadata, executionLog | **AgentCrab has MORE** |
| Task delegation tracking | ❌ No supervisor concept | ✅ DelegationRecord with supervisor→worker tracking | **AgentCrab has MORE** |
| Task dispatch tracking | ❌ No dispatch record model | ✅ DispatchRecord with full attempt tracking | **AgentCrab has MORE** |
| Task state history | ❌ Uses activity events | ✅ stateHistory[] embedded in task JSON | **AgentCrab has MORE** |
| Task edit audit | ❌ No edit audit trail | ✅ editHistory[] with before/after + version tracking | **AgentCrab has MORE** |
| Board-scoped tasks | ✅ Tasks belong to boards within organizations | ❌ Global flat task list | **Missing** |
| Auto-dispatch on create | ❌ Not automatic | ✅ auto_dispatch setting | **AgentCrab has MORE** |

---

## 3. Agent Provisioning and Management

| Feature | OpenClaw MC | AgentCrab | Gap |
|---|---|---|---|
| Agent CRUD API | ✅ List, create, get, update, delete | ✅ List, detail only (read from JSON) | **Missing** create/update/delete |
| Agent provisioning to gateway | ✅ Template rendering (Jinja2), file upload, session creation, token minting | ❌ Not implemented | **Missing** |
| Agent tokens | ✅ X-Agent-Token auth, hashed storage | ❌ Not implemented | **Missing** |
| Agent capability matching | ❌ No capability registry | ✅ AGENT_CAPABILITIES + match_agent_for_task() | **AgentCrab has MORE** |
| Supervisor/delegation layer | ❌ No supervisor concept | ✅ Jarvis: analyze → delegate → review → approve | **AgentCrab has MORE** |

---

## 4. Session Management

| Feature | OpenClaw MC | AgentCrab | Gap |
|---|---|---|---|
| Session APIs (list, get, history, delete) | ✅ Full REST API | ❌ Internal only, not exposed via REST | **Missing API exposure** |
| Ensure session | ✅ sessions.patch | ✅ sessions.patch | — |
| Multi-gateway support | ✅ Multiple gateways per org | ❌ Single gateway via env vars | **Missing** |
| Gateway commands introspection | ✅ GET /gateways/commands | ❌ Not implemented | **Missing** |

---

## 5. Dispatch Mechanisms

| Feature | OpenClaw MC | AgentCrab | Gap |
|---|---|---|---|
| Gateway RPC dispatch | ✅ chat.send with deliver=True | ✅ Same | — |
| Redis queue dispatch | ✅ RQ with throttling, retries, scheduling | ❌ No queue — direct async | **Missing** |
| CLI fallback dispatch | ❌ Not used | ✅ openclaw agent --message | **AgentCrab has this** |
| Filesystem notification | ❌ Not used | ✅ notifications.json writing | **AgentCrab has this** |
| 3-pronged dispatch | ❌ Single RPC path | ✅ notification + chat.send + CLI fallback | **AgentCrab has MORE** |
| @mention routing | ✅ extract_mentions() → route to agent sessions | ❌ Not implemented | **Missing** |

---

## 6. Authentication/Security

| Feature | OpenClaw MC | AgentCrab | Gap |
|---|---|---|---|
| User authentication | ✅ Clerk JWT + local bearer token | ❌ No auth — open API | **Missing** |
| Agent token auth | ✅ X-Agent-Token header | ❌ Not implemented | **Missing** |
| Organization-scoped access | ✅ Org → members → roles → board ACLs | ❌ No multi-tenancy | **Missing** |
| Secret redaction | ❌ Relies on auth | ✅ _REDACT_MARKERS for workspace files | **AgentCrab has this** |

---

## 7. UI Features

| Feature | OpenClaw MC (Next.js) | AgentCrab (Vite+React) | Gap |
|---|---|---|---|
| Dashboard overview | ✅ KPI metrics | ✅ StatsCards | — |
| Kanban board | ✅ Per-board | ✅ Global Kanban | — |
| Task result view | ❌ None | ✅ TaskResultModal | **AgentCrab has MORE** |
| Supervisor panel | ❌ No supervisor | ✅ SupervisorPanel (delegations, capabilities, state machine, RPC viewer) | **AgentCrab has MORE** |
| Cron monitoring | ❌ Not standalone | ✅ CronPanel | **AgentCrab has MORE** |
| Dispatch log UI | ❌ Not standalone | ✅ DispatchLog | **AgentCrab has MORE** |
| Board management/groups UI | ✅ Full CRUD | ❌ No board concept | **Missing** |
| Approval system UI | ✅ Create/approve/reject | ❌ Not implemented | **Missing** |
| Skills marketplace UI | ✅ Browse/install/uninstall | ❌ Not implemented | **Missing** |
| Gateway management UI | ✅ CRUD + template sync | ❌ Health check only | **Missing** |

---

## Summary

### Critical Gaps in AgentCrab
1. **Database persistence** — JSON files vs PostgreSQL
2. **Authentication** — Zero auth
3. **Multi-tenancy** — No org/team model
4. **Board scoping** — Tasks/agents are global
5. **Agent provisioning** — No automated agent setup via gateway
6. **Task dependencies/comments/tags/custom-fields** — Not implemented
7. **Approval workflows** — No approval system

### AgentCrab Unique Strengths
1. **Supervisor/delegation orchestration** (Jarvis hierarchical controller)
2. **Capability-based agent matching** (skill keyword registry)
3. **Task result storage** (structured result model)
4. **Task state history & edit auditing** (embedded audit trail)
5. **3-pronged dispatch** (notification + RPC + CLI fallback)
6. **Background orchestrator loop** (automatic stale re-dispatch)
7. **Cron monitoring, Dispatch log, Supervisor panel** (dedicated UIs)
8. **Multi-agent assignment** (assigneeIds[] vs single agent)
