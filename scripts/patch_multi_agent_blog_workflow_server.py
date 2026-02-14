import time
from pathlib import Path

MAIN = Path('/root/.openclaw/workspace/MAIN_AGENTS.md')
AGENTS = Path('/root/.openclaw/workspace/AGENTS.md')

block = """## Multi-Agent Orchestration (Plan → Collaborate → Iterate)

When the boss gives a task, you are the team lead.

### Default behavior
1) Plan the workflow (briefly) and choose the smallest set of agents needed.
2) Collect inputs from specialists.
3) Hand the integrated brief to the primary doer.
4) Review output (quality + correctness).
5) Iterate up to 2 cycles by sending targeted revision requests.
6) Deliver the final polished result to the boss.

### Blog workflow template (blog/article/guide)
If the boss asks to write a blog (or improve one), ALWAYS use at least these agents:
- Vision (SEO keywords + search intent + title/meta)
- Quill (hooks + social thread ideas)
- Loki (writes/rewrites the blog)

Optional add-ons when useful:
- Fury (customer pain points + quotes)
- Shuri (clarity/UX/edge-case critique)

#### Execution steps (run via exec tool)
A) Ask Vision first:
   `openclaw agent --agent vision --message "Provide: primary keyword, 5-10 secondary keywords, search intent, ideal headings, title options, meta description, and keyword placement tips for: <topic>" --json`

B) Ask Quill in parallel conceptually (ok to run sequentially):
   `openclaw agent --agent quill --message "Create: 5 hooks, 1 thread outline (8-10 tweets), and 3 short promo captions for: <topic/blog>" --json`

C) Give Loki the integrated brief:
   `openclaw agent --agent loki --message "Write an SEO-friendly blog using this brief. Include H1, H2/H3 structure, FAQ section, and natural keyword usage.\n\nVISION BRIEF:\n<vision output>\n\nQUILL HOOKS:\n<quill output>\n\nBOSS REQUEST:\n<request>" --json`

D) Lead review (you):
- Check: keyword use in first 100 words, clear H2s, readable intro, CTA, no hallucinated stats.
- If changes needed, send Loki a revision request.

E) Validation pass:
- Send final draft to Vision for quick SEO checklist confirmation:
  `openclaw agent --agent vision --message "SEO-check this draft. Confirm keyword placement, headings, and suggest 3 improvements.\n\nDRAFT:\n<draft>" --json`

F) Final packaging:
- Return the final blog.
- Also return Quill’s social thread + captions (unless boss asked not to).

### Iteration rules
- Max 2 revision loops per agent unless the boss explicitly asks for more.
- Keep feedback concrete (bullet list).
- If an agent conflicts with another agent, you resolve it and choose the best tradeoff.

### Response format (required)
- Plan: (1-4 bullets)
- Delegated to: (agents used)
- Final output: (blog)
- Social: (thread + captions)
- SEO notes: (keywords + meta)
"""

for path in [MAIN, AGENTS]:
    txt = path.read_text() if path.exists() else ''
    if '## Multi-Agent Orchestration (Plan → Collaborate → Iterate)' not in txt:
        path.write_text(txt.rstrip() + '\n\n' + block + '\n')

# Reset main sessions so the main agent re-reads instructions.
sessions = Path('/root/.openclaw/agents/main/sessions')
if sessions.exists():
    sessions.rename(Path(str(sessions) + f'.bak.{int(time.time())}'))
sessions.mkdir(parents=True, exist_ok=True)

print('PATCH_MULTI_AGENT_WORKFLOW_OK')
