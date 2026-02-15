"""Supervisor orchestration layer — Jarvis as hierarchical controller.

Implements:
  - Capability registry: each agent declares skills
  - Delegation engine: Jarvis matches task → capability → worker
  - Review loop: Jarvis validates output
  - Task state machine: pending → analyzing → delegated → running → reviewing → completed → archived
  - Result storage: task results persisted with content, files, metadata
"""

from __future__ import annotations

import logging
import time
import uuid
from dataclasses import dataclass, field
from enum import Enum
from typing import Any

from ..config import settings
from ..data import read_table, write_table
from ..events import event_bus, Event

log = logging.getLogger("agentcrab.supervisor")


# ── Capability Registry ─────────────────────────────────────────────────────

AGENT_CAPABILITIES: dict[str, dict[str, Any]] = {
    "jarvis": {
        "role": "Supervisory Orchestrator",
        "skills": ["delegation", "review", "coordination", "planning", "quality-assurance"],
        "isSupervisor": True,
        "canExecute": False,
    },
    "shuri": {
        "role": "Product Analyst",
        "skills": ["testing", "ux-analysis", "competitive-analysis", "bug-hunting", "user-research"],
        "isSupervisor": False,
        "canExecute": True,
    },
    "fury": {
        "role": "Customer Researcher",
        "skills": ["research", "data-analysis", "customer-insights", "market-research", "surveys"],
        "isSupervisor": False,
        "canExecute": True,
    },
    "vision": {
        "role": "SEO Analyst",
        "skills": ["seo", "keyword-research", "content-optimization", "analytics", "search-ranking"],
        "isSupervisor": False,
        "canExecute": True,
    },
    "loki": {
        "role": "Content Writer",
        "skills": ["writing", "blog", "copywriting", "editing", "content-strategy", "storytelling"],
        "isSupervisor": False,
        "canExecute": True,
    },
    "quill": {
        "role": "Social Media Manager",
        "skills": ["social-media", "engagement", "content-calendar", "community", "viral-content"],
        "isSupervisor": False,
        "canExecute": True,
    },
    "wanda": {
        "role": "Designer",
        "skills": ["design", "ui-ux", "visual-design", "mockups", "brand-identity"],
        "isSupervisor": False,
        "canExecute": True,
    },
    "pepper": {
        "role": "Email Marketing Specialist",
        "skills": ["email-marketing", "campaigns", "newsletters", "automation", "conversion"],
        "isSupervisor": False,
        "canExecute": True,
    },
    "friday": {
        "role": "Developer",
        "skills": ["coding", "development", "implementation", "debugging", "devops", "scripting"],
        "isSupervisor": False,
        "canExecute": True,
    },
    "wong": {
        "role": "Notion Agent",
        "skills": ["documentation", "knowledge-base", "organization", "project-management"],
        "isSupervisor": False,
        "canExecute": True,
    },
}

# Keyword → skill mapping for fuzzy matching
SKILL_KEYWORDS: dict[str, list[str]] = {
    "writing": ["write", "blog", "article", "post", "copy", "content", "story", "essay", "draft"],
    "blog": ["blog", "article", "post"],
    "seo": ["seo", "search", "keyword", "ranking", "organic", "serp"],
    "design": ["design", "ui", "ux", "mockup", "visual", "brand", "logo", "layout"],
    "coding": ["code", "develop", "implement", "build", "program", "script", "fix", "bug", "deploy"],
    "development": ["code", "develop", "implement", "build", "program"],
    "research": ["research", "analyze", "investigate", "study", "survey", "data"],
    "testing": ["test", "qa", "quality", "bug", "edge-case", "review"],
    "social-media": ["social", "twitter", "linkedin", "instagram", "tiktok", "facebook", "post"],
    "email-marketing": ["email", "newsletter", "campaign", "drip", "subscriber"],
    "documentation": ["document", "notion", "wiki", "knowledge", "organize"],
}


# ── Task Status (State Machine) ─────────────────────────────────────────────

class TaskState(str, Enum):
    """Strict lifecycle states."""
    PENDING = "pending"
    ANALYZING = "analyzing"       # Jarvis analyzing
    DELEGATED = "delegated"       # Assigned to worker
    RUNNING = "running"           # Worker executing
    REVIEWING = "reviewing"       # Jarvis reviewing
    COMPLETED = "completed"       # Approved by supervisor
    ARCHIVED = "archived"         # Archived

    # Legacy compat
    INBOX = "inbox"
    ASSIGNED = "assigned"
    IN_PROGRESS = "in_progress"
    REVIEW = "review"
    DONE = "done"


# Valid transitions (from → [to])
VALID_TRANSITIONS: dict[str, list[str]] = {
    "inbox": ["pending", "analyzing", "assigned"],
    "pending": ["analyzing", "delegated", "assigned"],
    "analyzing": ["delegated", "pending"],
    "assigned": ["in_progress", "delegated", "running", "analyzing"],
    "delegated": ["running", "in_progress", "analyzing"],
    "in_progress": ["review", "reviewing", "done", "completed"],
    "running": ["reviewing", "review", "completed"],
    "review": ["done", "completed", "in_progress", "running", "delegated"],
    "reviewing": ["completed", "delegated", "running"],
    "completed": ["archived", "done"],
    "done": ["archived", "completed"],
    "archived": [],
}


def validate_transition(current: str, target: str) -> bool:
    """Check if a state transition is valid."""
    allowed = VALID_TRANSITIONS.get(current, [])
    return target in allowed or current == target


# ── Capability Matching ──────────────────────────────────────────────────────

def match_agent_for_task(task: dict[str, Any]) -> str | None:
    """Find the best worker agent for a task based on capability matching.

    Analyzes task title + description for skill keywords and returns
    the best matching worker agent ID.
    """
    title = (task.get("title") or "").lower()
    desc = (task.get("description") or "").lower()
    text = f"{title} {desc}"

    scores: dict[str, int] = {}

    for agent_id, caps in AGENT_CAPABILITIES.items():
        if caps.get("isSupervisor") or not caps.get("canExecute"):
            continue

        score = 0
        for skill in caps.get("skills", []):
            # Direct skill match
            if skill in text:
                score += 3
            # Keyword expansion
            keywords = SKILL_KEYWORDS.get(skill, [])
            for kw in keywords:
                if kw in text:
                    score += 2

        if score > 0:
            scores[agent_id] = score

    if not scores:
        return None

    # Return highest-scoring agent
    return max(scores, key=scores.get)  # type: ignore[arg-type]


def get_agent_capabilities(agent_id: str) -> dict[str, Any] | None:
    """Get capability info for an agent."""
    return AGENT_CAPABILITIES.get(agent_id)


def is_supervisor(agent_id: str) -> bool:
    """Check if an agent is a supervisor (Jarvis)."""
    caps = AGENT_CAPABILITIES.get(agent_id, {})
    return caps.get("isSupervisor", False)


# ── Delegation Engine ────────────────────────────────────────────────────────

@dataclass
class DelegationRecord:
    """Tracks a delegation decision by the supervisor."""
    id: str = ""
    task_id: str = ""
    supervisor_id: str = "jarvis"
    worker_id: str = ""
    reason: str = ""
    skills_matched: list[str] = field(default_factory=list)
    state: str = "delegated"
    feedback: str | None = None
    iteration: int = 1
    created_at_ms: int = 0

    def __post_init__(self):
        if not self.id:
            self.id = f"dlg_{uuid.uuid4().hex[:12]}"
        if not self.created_at_ms:
            self.created_at_ms = int(time.time() * 1000)

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "taskId": self.task_id,
            "supervisorId": self.supervisor_id,
            "workerId": self.worker_id,
            "reason": self.reason,
            "skillsMatched": self.skills_matched,
            "state": self.state,
            "feedback": self.feedback,
            "iteration": self.iteration,
            "createdAtMs": self.created_at_ms,
        }


def build_supervisor_analysis_message(task: dict[str, Any]) -> str:
    """Build the message sent to Jarvis for task analysis and delegation."""
    task_id = task.get("id", "")
    title = task.get("title", "")
    desc = task.get("description", "") or "No description."
    priority = (task.get("priority") or "normal").upper()

    # Build capability list for Jarvis
    worker_list = []
    for aid, caps in AGENT_CAPABILITIES.items():
        if caps.get("isSupervisor"):
            continue
        worker_list.append(
            f"  - @{aid} ({caps['role']}): {', '.join(caps.get('skills', []))}"
        )

    suggested = match_agent_for_task(task)
    suggestion = f"\nSuggested worker: @{suggested}" if suggested else ""

    return f"""🎯 SUPERVISOR TASK — Analyze and Delegate

Task ID: {task_id}
Title: {title}
Priority: {priority}
Description: {desc}

Available Workers:
{chr(10).join(worker_list)}
{suggestion}

YOUR ROLE AS SUPERVISOR:
1. Analyze this task — determine required capabilities.
2. Select the best worker agent from the list above.
3. Delegate by updating mission_control/tasks.json:
   - Set status to "delegated"
   - Set assigneeIds to the chosen worker's ID
   - Add a "delegation" field with your reasoning
4. The system will auto-dispatch to the chosen worker.
5. Monitor the worker's progress via their WORKING.md.
6. When the worker completes, review their output.
7. If satisfactory, set status to "completed".
8. If not, provide feedback and re-delegate.

DO NOT execute this task yourself. You are the supervisor.
Analyze → Delegate → Review → Approve."""


def build_worker_task_message(
    task: dict[str, Any],
    worker_id: str,
    delegation: DelegationRecord,
) -> str:
    """Build the message sent to a worker agent after delegation."""
    task_id = task.get("id", "")
    title = task.get("title", "")
    desc = task.get("description", "")
    priority = (task.get("priority") or "normal").upper()
    feedback = delegation.feedback or ""

    feedback_section = ""
    if feedback:
        feedback_section = f"""
SUPERVISOR FEEDBACK (Iteration {delegation.iteration}):
{feedback}
"""

    return f"""📋 TASK ASSIGNED BY SUPERVISOR — {title}

Task ID: {task_id}
Priority: {priority}
Delegated By: @jarvis (Supervisor)
Iteration: {delegation.iteration}

{desc}
{feedback_section}
EXECUTION INSTRUCTIONS:
1. Update memory/WORKING.md with your execution plan.
2. Execute the task fully.
3. Store your results:
   - Update mission_control/tasks.json — add a "result" field with:
     {{"resultContent": "<your output>", "resultSummary": "<brief summary>"}}
   - Set task status to "review" when done.
4. Post completion summary to mission_control/activities.json.

The supervisor (@jarvis) will review your output."""


def build_review_message(
    task: dict[str, Any],
    worker_id: str,
) -> str:
    """Build the message sent to Jarvis for reviewing worker output."""
    task_id = task.get("id", "")
    title = task.get("title", "")
    result = task.get("result", {})
    result_content = result.get("resultContent", "(no result content found)")
    result_summary = result.get("resultSummary", "")

    return f"""🔍 REVIEW REQUIRED — Worker output ready

Task ID: {task_id}
Title: {title}
Worker: @{worker_id}

Result Summary: {result_summary}

Worker Output:
{result_content[:3000]}

REVIEW INSTRUCTIONS:
1. Evaluate the quality of the output.
2. If SATISFIED:
   - Set task status to "completed" in mission_control/tasks.json
   - Add a "reviewNote" to the task result
3. If NOT SATISFIED:
   - Set task status to "delegated" with feedback
   - The system will re-dispatch to the worker with your feedback
4. Update memory/WORKING.md with your review decision."""


# ── Task Result Storage ──────────────────────────────────────────────────────

def store_task_result(
    task_id: str,
    *,
    content: str = "",
    summary: str = "",
    files: list[str] | None = None,
    metadata: dict[str, Any] | None = None,
    execution_log: str = "",
) -> dict[str, Any]:
    """Store a result for a completed task."""
    tasks = read_table(settings.mc_root, "tasks.json")
    result_data = {
        "resultContent": content,
        "resultSummary": summary,
        "resultFiles": files or [],
        "resultMetadata": metadata or {},
        "executionLog": execution_log,
        "completedAtMs": int(time.time() * 1000),
    }

    for t in tasks:
        if t.get("id") == task_id:
            t["result"] = result_data
            break
    else:
        raise ValueError(f"Task not found: {task_id}")

    write_table(settings.mc_root, "tasks.json", tasks)
    log.info("result.stored task=%s content_len=%d", task_id, len(content))
    return result_data


def get_task_result(task_id: str) -> dict[str, Any] | None:
    """Get the result for a task."""
    tasks = read_table(settings.mc_root, "tasks.json")
    for t in tasks:
        if t.get("id") == task_id:
            return t.get("result")
    return None


# ── State Transition Logging ─────────────────────────────────────────────────

def record_state_transition(
    task_id: str,
    from_state: str,
    to_state: str,
    actor: str = "system",
    reason: str = "",
) -> None:
    """Record a state transition in the task's history."""
    tasks = read_table(settings.mc_root, "tasks.json")
    for t in tasks:
        if t.get("id") == task_id:
            if "stateHistory" not in t:
                t["stateHistory"] = []
            t["stateHistory"].append({
                "from": from_state,
                "to": to_state,
                "actor": actor,
                "reason": reason,
                "atMs": int(time.time() * 1000),
            })
            # Keep last 50 transitions
            t["stateHistory"] = t["stateHistory"][-50:]
            break
    write_table(settings.mc_root, "tasks.json", tasks)


# ── Delegation Log ───────────────────────────────────────────────────────────

_delegation_log: list[DelegationRecord] = []


def get_delegation_log(limit: int = 100) -> list[dict[str, Any]]:
    """Return recent delegation records."""
    return [r.to_dict() for r in _delegation_log[-limit:]][::-1]


def get_delegations_for_task(task_id: str) -> list[dict[str, Any]]:
    """Return delegation records for a specific task."""
    return [r.to_dict() for r in _delegation_log if r.task_id == task_id]


def record_delegation(record: DelegationRecord) -> None:
    """Store a delegation record."""
    _delegation_log.append(record)

    # Also persist to activities
    try:
        activities = read_table(settings.mc_root, "activities.json")
        activities.append({
            "id": f"evt_{uuid.uuid4().hex[:10]}",
            "type": "task.delegated",
            "message": f"📋 Supervisor delegated task to @{record.worker_id}: {record.reason}",
            "taskId": record.task_id,
            "agentId": record.worker_id,
            "createdAtMs": int(time.time() * 1000),
            "meta": record.to_dict(),
        })
        activities = activities[-500:]
        write_table(settings.mc_root, "activities.json", activities)
    except Exception as e:
        log.error("delegation.activity_failed: %s", e)
