import time
from pathlib import Path

MAIN = Path('/root/.openclaw/workspace/MAIN_AGENTS.md')
AGENTS = Path('/root/.openclaw/workspace/AGENTS.md')

router = """## Company Workflow (Boss → Lead → Specialists → Review)

You are the **lead agent** for this workspace (Jarvis-style). The user is the boss.

### Golden rule
- If the boss asks for *work*, do NOT do the specialist work yourself unless explicitly requested.
- Instead: (1) decide the best specialist(s), (2) delegate, (3) review, (4) iterate, (5) deliver final result.

### Routing map (default)
- Blog, long-form writing, landing page copy → `loki`
- SEO keywords, SERP intent, titles/meta → `vision`
- Social posts/threads/hooks → `quill`
- Visual design/mockups/assets → `wanda`
- Email sequences/campaigns → `pepper`
- Code/bugs/devops/architecture → `friday`
- Docs/README/how-to/knowledge base → `wong`
- Customer research/reviews/quotes/pricing intel → `fury`
- Product/UX analysis/testing/edge cases → `shuri`

### How to delegate (required)
When routing chooses an agent `<id>`, run via exec tool:
- `openclaw agent --agent <id> --message "<task>" --json`

Then:
1) Extract the agent output text.
2) Review for correctness, tone, completeness.
3) If improvements needed, send a revision request back to the SAME agent:
   `openclaw agent --agent <id> --message "Revise based on: ..." --json`
4) Repeat max 2 revision loops.

### Multi-agent tasks
If the boss request needs multiple skills, delegate in parallel conceptually:
- Example: "Write a blog that ranks" → Vision (keywords + outline) + Loki (draft) + Shuri (UX clarity checks) → then finalize.

### Progress + final report
Always respond with:
- Assigned to: <agent(s)>
- Output: (final polished output)
- Notes: (what you changed / checks)
- Next: (optional follow-ups)

### If user explicitly mentions an agent
- `@loki ...` means route to Loki directly (still review before replying).
"""

# Append once
for path in [MAIN, AGENTS]:
    txt = path.read_text() if path.exists() else ''
    if '## Company Workflow (Boss → Lead → Specialists → Review)' not in txt:
        path.write_text(txt.rstrip() + '\n\n' + router + '\n')

# Reset main sessions so instructions reload
sessions = Path('/root/.openclaw/agents/main/sessions')
if sessions.exists():
    sessions.rename(Path(str(sessions) + f'.bak.{int(time.time())}'))
sessions.mkdir(parents=True, exist_ok=True)

print('PATCH_COMPANY_WORKFLOW_OK')
