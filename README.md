# Agent Monitor (OpenClaw)

Minimal monitoring UI for your OpenClaw agent squad.

## What it shows

- Agents (from filesystem Mission Control JSON)
- Tasks + recent activity (from filesystem Mission Control JSON)
- Cron status (from `openclaw cron list --json`)

## Local dev

### Backend

```bash
cd backend
python -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173

Set API base URL:

- Windows PowerShell: `$env:VITE_API_URL = "http://127.0.0.1:8000"`

## Deploy (VPS)

Recommended: run backend + frontend on the VPS and point the backend at:

- `MC_ROOT=/root/.openclaw/workspace/mission_control`

You can SSH port-forward to view it, similar to the OpenClaw dashboard.
