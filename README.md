# Buzzr 🔔

**A real-time reimagining of JeopardyLabs** — build a Jeopardy-style game in
minutes with no account, then host it live with **phones as buzzers**,
automatic scoring, **teams or free-for-all**, and a dedicated **host
dashboard**.

> 📄 [Product Requirements Document](docs/PRD.md) · 🔍 [JeopardyLabs competitive analysis](docs/ANALYSIS.md)

## What it does

- **Game editor** — no signup; grid editor for categories × values, two rounds,
  Daily Doubles, image clues, and a wager-based Final round. Games are public
  or unlisted; anyone can clone a public board. Edit access is an edit-token
  link saved in your browser ("My games").
- **Live rooms** — host any game with a 4-letter code (and a lobby **QR
  code** for instant joining in the room). Three surfaces:
  - **Board** (`/board/CODE`) — the main stage, built for in-person play:
    project or screen-share it, and when you're the host it's also the
    **presenter view** — click tiles, arm buzzers, judge ✓/✗ and run rounds
    right on the shared screen. Animated money grid, buzz lock-in banners,
    Daily Double splash, Final reveals, podium + confetti, synthesized
    sound effects.
  - **Host dashboard** (`/host/CODE`) — the companion console: sees the
    answers privately, manages teams/scores/control/kicks, and can run the
    full game too.
  - **Player phone** (`/play/CODE`) — name + emoji avatar, giant buzzer with
    haptics, team picker, wager pad, Final answer input, live leaderboard.
- **Real buzzer fairness** — buzzes are ordered server-side; wrong answers
  lock out the player (FFA) or whole team (Teams) and automatically re-arm
  for everyone else. Scoring, penalties, wagers, and control tracking are all
  automatic — the host only judges.
- **Classic mode safe** — every score has host-side ± controls, so you can
  run a board with zero phones, JeopardyLabs-style.

## Quick start

```bash
npm install
npm run build   # builds the client into client/dist
npm start       # serves app + API + websockets on :3000
```

Open `http://localhost:3000` — two sample games are seeded on first run.

For development (Vite HMR on :5173 proxying to the API on :3000):

```bash
npm run dev
```

## Architecture

```
shared/   TypeScript types + protocol (the contract for everything)
server/   Express + Socket.IO + node:sqlite (zero native deps)
client/   React + Vite + Tailwind v4
```

- **Server-authoritative room engine** (`server/src/rooms.ts`): all game
  state lives in a state machine on the server; clients send intents and
  render role-scoped snapshots, which makes refreshes/reconnects free.
- **Content vs. session split**: game boards persist in SQLite; live rooms
  are in-memory with idle GC (a room is an ephemeral event).
- Single-process deploy, one port, no external services, no native modules
  (uses Node 22's built-in `node:sqlite`).

Environment variables: `PORT` (default 3000), `BUZZR_DATA_DIR` (SQLite
location), `BUZZR_PUBLIC_URL` (shown to hosts for join links).

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Vite dev server + API with watch mode |
| `npm run build` | Production client build |
| `npm start` | Serve built client + API on one port |
| `npm run typecheck` | Strict TypeScript across all workspaces |
