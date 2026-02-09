# Mission Control

A multi-agent AI team management system built with OpenClaw/ClawdBot, Convex, and React.

![Mission Control Dashboard](https://img.shields.io/badge/Agents-10-green) ![Convex](https://img.shields.io/badge/Backend-Convex-orange) ![React](https://img.shields.io/badge/Frontend-React-blue)

## Overview

Mission Control is a system where 10 AI agents work together like a real team. Each agent has a specialized role, their own personality (SOUL), and can communicate through a shared database.

Based on the [Mission Control blog post](https://sitegpt.ai) architecture.

## Features

- **10 Specialized Agents** - Jarvis (Lead), Shuri (Product), Fury (Research), Vision (SEO), Loki (Content), Quill (Social), Wanda (Design), Pepper (Email), Friday (Dev), Wong (Docs)
- **Real-time Dashboard** - Kanban board, activity feed, agent status
- **Heartbeat System** - Agents wake every 15 minutes to check for work
- **@Mention Notifications** - Tag agents in comments to get their attention
- **Daily Standup** - Automated summary delivered to Telegram

## Tech Stack

- **Backend**: [Convex](https://convex.dev) - Real-time database
- **Frontend**: React + Vite + TypeScript
- **Agent Framework**: [OpenClaw](https://openclaw.ai) (ClawdBot)
- **Hosting**: Docker on Ubuntu

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Start Convex

```bash
npx convex dev
```

### 3. Seed the Database

```bash
npx convex run seed:seedAgents
npx convex run seed:seedTasks
```

### 4. Start the Dashboard

```bash
npm run dev
```

Open http://localhost:5173

## Project Structure

```
├── convex/                 # Convex backend
│   ├── schema.ts          # Database schema (6 tables)
│   ├── agents.ts          # Agent CRUD
│   ├── tasks.ts           # Task management
│   ├── messages.ts        # Comments + @mentions
│   ├── activities.ts      # Activity feed
│   ├── documents.ts       # Deliverables
│   ├── notifications.ts   # @mention queue
│   └── seed.ts            # Seed data
├── src/                    # React frontend
│   ├── App.tsx            # Main dashboard
│   ├── index.css          # Design system
│   └── main.tsx           # Entry point
└── index.html
```

## Database Schema

| Table | Purpose |
|-------|---------|
| `agents` | Agent profiles and status |
| `tasks` | Kanban task tracking |
| `messages` | Comment threads |
| `activities` | Activity feed |
| `documents` | Deliverables |
| `notifications` | @mention queue |

## Agent Configuration

Each agent has a SOUL file defining their personality and role. Configure on your OpenClaw server at:

```
/home/node/.openclaw/workspace/souls/
├── JARVIS.md    # Squad Lead
├── SHURI.md     # Product Analyst
├── FURY.md      # Customer Researcher
├── VISION.md    # SEO Analyst
├── LOKI.md      # Content Writer
├── QUILL.md     # Social Media
├── WANDA.md     # Designer
├── PEPPER.md    # Email Marketing
├── FRIDAY.md    # Developer
└── WONG.md      # Documentation
```

## Heartbeat Schedule

Agents wake every 15 minutes, staggered:

| Time | Agents |
|------|--------|
| :00 | Jarvis, Pepper |
| :02 | Shuri |
| :04 | Friday |
| :06 | Loki |
| :07 | Wanda |
| :08 | Vision |
| :10 | Fury |
| :12 | Quill |
| :14 | Wong |

## License

MIT
