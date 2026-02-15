# Deploy on VPS (simple)

This assumes OpenClaw is already installed on the VPS and the Mission Control JSON lives at:

- `/root/.openclaw/workspace/mission_control/`

## 1) Copy project to VPS

From your local machine, you can `git push` and then `git pull` on the VPS, or use `scp`.

## 2) Backend (single-process, serves UI)

```bash
cd agent-monitor/backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# run from backend/, but serve the built frontend from ../frontend/dist
export MC_ROOT=/root/.openclaw/workspace/mission_control
export SERVE_STATIC=true

uvicorn app.main:app --host 127.0.0.1 --port 8088
```

## 3) Frontend build

```bash
cd agent-monitor/frontend
npm install
npm run build
```

## 4) Access from your laptop

Use SSH port-forward:

```powershell
ssh -i "C:\Users\devdh\Documents\Coding\Git\MultiAgent\server_key" -L 8088:127.0.0.1:8088 root@46.224.141.217
```

Then open:

- http://127.0.0.1:8088/
