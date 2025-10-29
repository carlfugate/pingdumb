# pingdumb

A modern network monitoring tool with web interface for local network diagnostics.

## Features
- Real-time network testing (ping, traceroute, DNS)
- Service monitoring (HTTP/HTTPS checks)
- Configurable test targets and intervals
- Modern web dashboard with shadcn/ui
- Historical data and notifications

## Quick Start
```bash
# Backend
cd backend
pip install -r requirements.txt
python main.py

# Frontend
cd frontend
npm install
npm run dev
```

## Architecture
- **Frontend**: Next.js + TypeScript + shadcn/ui
- **Backend**: Python FastAPI + asyncio
- **Database**: SQLite
- **Real-time**: WebSockets
