import time
from pathlib import Path

AGENTS_MD = Path('/root/.openclaw/workspace/AGENTS.md')
MAIN_AGENTS_MD = Path('/root/.openclaw/workspace/MAIN_AGENTS.md')

delegation_block = """## Delegation: Run a specific agent (no 'spawn' needed)

This gateway supports multiple isolated agents (Jarvis, Loki, etc.).

If a user says either:
- "ask loki ..."
- "@loki ..."
- "loki: ..."

You MUST run Loki using the OpenClaw CLI via the exec tool (do not refuse with "can't spawn"):

- Command: `openclaw agent --agent loki --message "<user request>" --json`

Then return Loki's `payloads[0].text` back to the user.

General rule for any known agent id (jarvis/shuri/fury/vision/loki/quill/wanda/pepper/friday/wong):
- If message contains `@<id>` OR starts with `<id>:` OR "ask <id>", run:
  `openclaw agent --agent <id> --message "<user request>" --json`
- If the CLI call fails, report the error and ask the user to retry.
"""

text = AGENTS_MD.read_text()
if '## Delegation: Run a specific agent (no' not in text:
    AGENTS_MD.write_text(text.rstrip() + '\n\n' + delegation_block + '\n')

main_text = MAIN_AGENTS_MD.read_text() if MAIN_AGENTS_MD.exists() else ''
if 'Delegation: Run a specific agent' not in main_text:
    MAIN_AGENTS_MD.write_text(
        (main_text.rstrip() + '\n\n' if main_text.strip() else '') +
        """## Delegation

When the user requests a specific agent (e.g. `@loki`), delegate by running:

`openclaw agent --agent <id> --message "<request>" --json`

Return that agent's response to the user. Do not claim spawning is unsupported.
""" + '\n'
    )

# Reset main sessions so the main agent re-reads instructions.
sessions = Path('/root/.openclaw/agents/main/sessions')
if sessions.exists():
    sessions.rename(Path(str(sessions) + f'.bak.{int(time.time())}'))
sessions.mkdir(parents=True, exist_ok=True)

print('PATCH_DELEGATION_OK')
