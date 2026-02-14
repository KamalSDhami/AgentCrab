import json
from pathlib import Path

OPENCLAW_PATH = Path('/root/.openclaw/openclaw.json')
AGENTS_MD_PATH = Path('/root/.openclaw/workspace/AGENTS.md')
MAIN_AGENTS_PATH = Path('/root/.openclaw/workspace/MAIN_AGENTS.md')

allowed = [
    'jarvis',
    'shuri',
    'fury',
    'vision',
    'loki',
    'quill',
    'wanda',
    'pepper',
    'friday',
    'wong',
]

config = json.loads(OPENCLAW_PATH.read_text())
config.setdefault('agents', {})['allowedSpawnAgents'] = allowed
OPENCLAW_PATH.write_text(json.dumps(config, indent=2) + '\n')

block = """## Multi-Agent Runtime Rules

- Source of truth for available bots is `/root/.openclaw/workspace/agents.json`.
- Never claim \"only main agent exists\" if `agents.json` contains other agents.
- For \"list all bots\" requests, list every agent from `agents.json` as: `Name (id)`.
- For \"how to config other agent\" requests, provide concrete steps for this server/workspace.
- If unsure, read `agents.json`, `openclaw.json` (`agents.allowedSpawnAgents`), and each `agents/<id>/config.json` before answering.

### Standard answer template: list all bots
1. Read `/root/.openclaw/workspace/agents.json`
2. Return each configured agent in order.
3. Mention default lead agent if present.

### Standard answer template: configure another agent
1. Create `agents/<agent-id>/config.json`
2. Create `agents/<agent-id>/prompt.md`
3. Add entry to `agents.json` with `id`, `name`, and `soul`
4. Add `<agent-id>` to `agents.allowedSpawnAgents` in `/root/.openclaw/openclaw.json`
5. Add heartbeat job in `/root/.openclaw/cron/cron_jobs.json` (optional)
6. Restart OpenClaw process
7. Verify with `agents list` / `GET /api/agents`
"""

text = AGENTS_MD_PATH.read_text()
if '## Multi-Agent Runtime Rules' not in text:
    AGENTS_MD_PATH.write_text(text.rstrip() + '\n\n' + block + '\n')

MAIN_AGENTS_PATH.write_text(
    """# MAIN_AGENTS.md

You are the main gateway agent for AgentCrab.

- Always treat AgentCrab as a multi-agent system.
- Available agents are defined in `/root/.openclaw/workspace/agents.json`.
- Before answering questions about bots/agents, read `agents.json` first.
- Never answer that only main exists unless `agents.json` truly has only main.
- Provide concrete server steps for configuration and include exact files/paths.
"""
)

print('PATCH_OK')
