import json
import shutil
import time
from pathlib import Path

WORKSPACE = Path('/root/.openclaw/workspace')
AGENTS_MD = WORKSPACE / 'AGENTS.md'
AGENTS_JSON = WORKSPACE / 'agents.json'
SESSIONS_DIR = Path('/root/.openclaw/agents/main/sessions')

agents = json.loads(AGENTS_JSON.read_text()).get('agents', [])

lines = [
    '## Available Agents (Authoritative)',
    '',
    'If asked to list agents/bots, reply with this exact list (no speculation):',
    '',
]
for agent in agents:
    name = agent.get('name') or agent.get('id')
    agent_id = agent.get('id')
    lines.append(f'- {name} ({agent_id})')

text = AGENTS_MD.read_text()
header = '## Available Agents (Authoritative)'
if header in text:
    pre, _sep, rest = text.partition(header)
    idx = rest.find('\n## ')
    post = rest[idx:] if idx != -1 else ''
    new_text = pre.rstrip() + '\n\n' + '\n'.join(lines) + '\n' + post.lstrip('\n')
else:
    new_text = text.rstrip() + '\n\n' + '\n'.join(lines) + '\n'

AGENTS_MD.write_text(new_text)

# Backup and reset sessions to force the main agent to re-load instructions.
if SESSIONS_DIR.exists():
    backup = SESSIONS_DIR.with_name(f'sessions.bak.{int(time.time())}')
    shutil.move(str(SESSIONS_DIR), str(backup))
SESSIONS_DIR.mkdir(parents=True, exist_ok=True)

print('PATCH_AGENTS_MD_OK')
