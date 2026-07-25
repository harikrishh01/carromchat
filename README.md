# Carrom Board Game

A production-ready, full-stack Carrom Board game built with React 19, Matter.js physics, and Socket.IO multiplayer.

## Features

- **Offline Mode** – Play against an AI opponent (Easy / Medium / Hard)
- **Online Mode** – Real-time Player vs Player via Socket.IO
- **Official Carrom Rules** – Queen, Cover, Fouls, Win detection
- **Realistic Physics** – Matter.js with friction, restitution, velocity damping
- **Modern UI** – Dark theme, responsive, smooth animations, particles

## Tech Stack

| Layer | Tech |
|-------|------|
| Frontend | React 19, Vite, JavaScript ES2024 |
| Physics | Matter.js |
| Rendering | HTML5 Canvas |
| State | Zustand |
| Routing | React Router v7 |
| Styling | Tailwind CSS v4 |
| Multiplayer | Socket.IO (client + server) |
| Backend | Node.js, Express, Socket.IO |

## Project Structure

```
Carroms/
├── frontend/
│   └── src/
│       ├── components/     # Reusable UI components
│       ├── pages/          # Route pages
│       ├── physics/        # Matter.js client engine
│       ├── hooks/          # Custom React hooks
│       ├── utils/          # Canvas renderer, particles
│       ├── services/       # Game logic, AI
│       ├── network/        # Socket.IO client
│       ├── store/          # Zustand state
│       └── constants/      # Shared constants
└── backend/
    └── src/
        ├── constants/      # Game constants
        ├── physics/        # Server-side Matter.js
        ├── game/           # GameState, RoomManager
        └── handlers/       # Socket event handlers
```

## Installation

### Prerequisites
- Node.js 20+
- npm 10+

### Setup

```bash
# Frontend
cd frontend
npm install
cp .env.example .env   # configure if needed

# Backend
cd ../backend
npm install
cp .env.example .env
```

## Running

### Development (two terminals)

```bash
# Terminal 1 – Backend
cd backend
npm run dev

# Terminal 2 – Frontend
cd frontend
npm run dev
```

Frontend: http://localhost:5173  
Backend: http://localhost:3001

### Production

```bash
# Build frontend
cd frontend
npm run build

# Start backend
cd backend
npm start
```

## Game Controls

| Action | Input |
|--------|-------|
| Aim | Click and drag on board |
| Set power | Drag distance |
| Shoot | Release mouse/touch |
| Settings | ⚙️ button (top right) |

## Online Multiplayer

1. Player 1 clicks **Play Online → Create Room** → gets a 6-char code
2. Player 2 clicks **Play Online → Join Room** → enters the code
3. Game starts automatically when both players are in

The server validates every shot (angle, power, physics) and broadcasts state to both clients. Clients cannot cheat by sending fake positions.

## AI Difficulty

| Level | Behavior |
|-------|----------|
| Easy | Random targets, large angular error, low power |
| Medium | Targets nearest coin, bank shots, moderate accuracy |
| Hard | Optimal pocket angles, queen priority, minimal error |

## Future Extensions

- [ ] Authentication (JWT/OAuth)
- [ ] Leaderboard
- [ ] Tournament brackets
- [ ] Spectator mode
- [ ] Replay system
- [ ] Custom board themes
