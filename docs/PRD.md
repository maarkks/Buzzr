# Buzzr — Product Requirements Document

**Version:** 1.0 · **Status:** Implemented (MVP) · **Date:** June 2026

> Buzzr is a modern, real-time reimagining of JeopardyLabs: build a
> Jeopardy-style game in minutes with no account, then host it live with
> phones as buzzers, automatic scoring, teams or free-for-all, and a
> dedicated host dashboard. See `docs/ANALYSIS.md` for the competitive
> analysis that motivates these requirements.

---

## 1. Vision & goals

**Vision.** The easiest way to turn any material into a live game show.

**Product pillars**

1. **Frictionless creation** — no signup; a shareable, editable game in under
   five minutes; everything free that JeopardyLabs charges for.
2. **Real liveness** — rooms, phone buzzers, server-adjudicated buzz order,
   automatic scoring; the host judges, the system bookkeeps.
3. **Show business** — the drama of the real show: lock-in moments, Daily
   Double splashes, wagering, a Final round, a podium finale.
4. **Three-screen architecture** — Board (audience), Host (control), Player
   (phone). Each surface is designed for its job.

**Non-goals (v1).** User accounts, billing, native apps, AI question
generation, content moderation tooling, internationalization.

## 2. Personas

- **Priya, 8th-grade teacher.** Builds a review board the night before,
  projects the Board view, runs the game from her laptop's Host view while
  30 students buzz from phones in teams.
- **Marcus, team-lead.** Runs a Friday trivia free-for-all over a video call;
  shares the Board via screen share, players join from phones at home.
- **Sam, student.** Joins with a room code, picks an avatar, wants the buzzer
  to feel instant and fair, and to see their name on the leaderboard.

## 3. Feature requirements

### 3.1 Game creation & editor (non-negotiable)

- **F1.1** Create a game with no account. Creator receives an *edit token*
  stored in the browser ("My games") and embedded in a shareable edit link.
- **F1.2** Grid editor: 1–8 categories × 1–8 value rows per round; editable
  category names, point values (presets ±custom), per-cell question & answer.
- **F1.3** Up to two main rounds (Single/Double with value multiplier) plus an
  optional Final round (category + clue + answer, wager-based).
- **F1.4** Any clue can be flagged a **Daily Double** and can carry **media**
  (image by URL) — free, unlike JeopardyLabs.
- **F1.5** Autosave with explicit save state indicator; games are
  `public` (searchable) or `unlisted` (link-only).
- **F1.6** Browse/search public games; **clone any game** into an editable
  copy (the dominant teacher workflow).
- **F1.7** Validation: warn on empty cells; playable even when partially
  filled (empty cells render as disabled).

### 3.2 Hosting & game modes (non-negotiable)

- **F2.1** "Host live" creates a **room** with a 4-letter code from any game.
- **F2.2** Two modes at room creation: **Teams** (players join/assigned to
  teams, team scores, team-wide lockouts) and **Free-for-all** (individual
  scores and lockouts).
- **F2.3** Room settings: number of teams, wrong-answer penalty on/off, buzz
  window seconds, answer seconds, auto-arm buzzers on clue open.
- **F2.4** Lobby: players appear live as they join; host can rename teams,
  move players between teams, kick players, lock the room.
- **F2.5** Gameplay loop: host opens a clue → (reads it) → **arms buzzers** →
  server picks the first buzz (authoritative ordering) → host judges
  ✓/✗ → scoring + lockout applied automatically → next buzzer or close.
- **F2.6** **Daily Double:** splash on board; the controlling team/player
  wagers from their phone (host can override); only they answer.
- **F2.7** **Final round:** all teams/players wager on phones from their
  score, then type answers on phones within a timer; host reveals
  answer-by-answer and judges each; podium finale.
- **F2.8** **Control tracking:** correct answers take "control"; control
  determines the Daily Double wagerer (host can reassign).
- **F2.9** **Classic mode fallback:** the host can always adjust any score
  manually (±) and run a board with zero connected phones.
- **F2.10** Rounds advance manually (host) with a board-state intermission.

### 3.3 Player phones (non-negotiable)

- **F3.1** Join via code at the site root (or QR/link from host) — no app, no
  account; pick a name + avatar (emoji + color).
- **F3.2** Giant **buzzer** with four clear states: idle / get-ready / armed /
  locked-out; server-side timestamps decide order; haptic + visual feedback
  on result ("You're in!" vs "Buzzed: <name>").
- **F3.3** Phone shows your score, team, current clue value, judge feedback
  (green/red flash), and a live **leaderboard** sheet.
- **F3.4** Wager input for Daily Double (when in control) and Final round;
  text answer input for Final round.
- **F3.5** Reconnect-safe: refresh/drop restores identity, team, and score
  (per-room identity persisted in the browser).

### 3.4 Host dashboard (non-negotiable)

- **F4.1** Dedicated host surface showing what the audience can't see: the
  **answer** to the open clue, the buzz queue, wager amounts, final answers.
- **F4.2** Mini-board for clue selection, arm/judge/skip/reveal controls,
  per-player and per-team score adjustment, kick, room lock.
- **F4.3** One-click links/QR for the Board view and the player join URL.
- **F4.4** Final-round console: see wagers and answers arrive live; reveal
  and judge each submission in order.
- **F4.5** End-game: podium ordering, play-again-style room teardown.

### 3.5 Board (audience display & presenter surface)

The primary use case is **in person**: the host projects/shares this screen,
players join from phones, and the host runs the game *directly on the shared
screen*.

- **F5.0** **Presenter mode:** when the board is opened by the room's host,
  it becomes interactive — clickable tiles, a slim host control bar
  (start/arm/judge/reveal/close, round & final controls, on-demand answer
  peek), so a single shared screen is the whole show. The separate host
  dashboard remains available for roster/score management.
- **F5.0b** The lobby shows a large **QR code** alongside the room code so
  players in the room join in seconds.
- **F5.1** Full-screen category/value grid with game-show aesthetics; used
  clues empty out; clue opens with reveal animation and media support.
- **F5.2** Buzz lock-in banner (avatar + name + team), countdown ring for buzz
  window, judge feedback, Daily Double splash, Final round flow
  (category → clue → reveals), podium with confetti.
- **F5.3** Scoreboard strip (teams or top players) always visible; join
  instructions (code) shown during lobby.
- **F5.4** Synthesized sound effects (WebAudio, no assets): board fill, buzz,
  correct, wrong, Daily Double, timer.

## 4. System design

### 4.1 Architecture

```
client (React + Vite + Tailwind)  ──REST──▶  server (Express)
        │                                        │
        └────────── Socket.IO ───────────▶  RoomEngine (in-memory, authoritative)
                                                 │
                                            node:sqlite (games library)
```

- **Server-authoritative state machine.** All game state lives in a `Room`
  on the server. Clients send *intents* (`host:judge`, `player:buzz`); the
  server validates, mutates, and broadcasts a full **snapshot** to each role
  (host snapshots include secrets like answers). Snapshots-over-deltas keeps
  every client correct after any reconnect.
- **Buzz fairness.** Buzzes are timestamped on arrival at the server; the
  first non-locked buzz after arming wins. Lockouts are per-player (FFA) or
  per-team (Teams).
- **Persistence split.** Game *content* persists in SQLite (`node:sqlite`,
  zero native deps). Live *rooms* are in-memory with idle GC — acceptable
  because a room is an ephemeral 30–60 minute event.
- **Timers** are server-driven (`endsAt` epoch in snapshots); clients render
  countdowns locally, the server enforces expiry.

### 4.2 Data model (content)

```
Game { id, title, description, tags[], visibility: public|unlisted,
       editToken, plays, createdAt, updatedAt,
       data: {
         rounds: [{ name, multiplier, values[], categories: [{ name,
                    clues: [{ question, answer, image?, dailyDouble? }] }] }],
         final?: { category, question, answer }
       } }
```

### 4.3 Room state machine

```
lobby ─start─▶ board ─selectClue─▶ clue(reading ─arm─▶ armed ─buzz─▶ buzzed
   ▲                │                     ▲────wrong/re-arm────────────┘
   │                │              judge-correct / exhausted / timeout
   │                ◀──────────────── close ──────────────┘
   │                ├─selectClue(DD)─▶ dailyDouble(wager ─▶ answer ─▶ judge)
   │                ├─nextRound─▶ board (round 2)
   │                └─startFinal─▶ final(wager ─▶ answer ─▶ reveal*) ─▶ podium/ended
```

### 4.4 Protocol (Socket.IO)

- `room:join {code, role: host|board|player, …identity}` → ack with snapshot.
- Player intents: `player:buzz`, `player:joinTeam`, `player:setAvatar`,
  `player:wager`, `player:finalAnswer`.
- Host intents: `host:start`, `host:selectClue`, `host:arm`, `host:judge`,
  `host:reveal`, `host:close`, `host:setWager`, `host:adjustScore`,
  `host:assignTeam`, `host:renameTeam`, `host:setControl`, `host:kick`,
  `host:lockRoom`, `host:nextRound`, `host:startFinal`, `host:finalNext`,
  `host:judgeFinal`, `host:endGame`.
- Server: `room:state` (role-scoped snapshot), `sfx`, `room:closed`.

### 4.5 REST API

```
GET    /api/games           search/browse public games (meta)
POST   /api/games           create → { id, editToken }
GET    /api/games/:id       meta + data
PUT    /api/games/:id       update (x-edit-token)
DELETE /api/games/:id       delete (x-edit-token)
POST   /api/games/:id/clone clone → { id, editToken }
POST   /api/rooms           { gameId, settings } → { code, hostToken }
GET    /api/rooms/:code     join pre-check { ok, phase, mode }
```

## 5. UX principles

- **Board** is theater: dark indigo stage, gold money values, big serif-free
  display type, deliberate animations. Readable from the back of a room.
- **Host** is a cockpit: density over beauty, every action ≤1 click deep
  during play, answers always visible to the host and never to the board.
- **Phone** is a controller: one giant thumb target; state is communicated by
  color/motion/haptics, not prose.
- Empty cells, disconnects, and refreshes never crash a live game —
  every surface re-renders from the latest snapshot.

## 6. Non-functional requirements

- Rooms support 60+ concurrent players (Socket.IO defaults suffice).
- Buzz adjudication is O(1) on arrival order at the server; no client clocks.
- Single-process deploy: `npm run build && npm start` serves API + static
  client on one port. No external services, no native modules.
- Room codes from an unambiguous alphabet (no 0/O/1/I); idle rooms GC'd.

## 7. Success metrics (post-launch)

- Time-to-first-hosted-game < 10 min for a new creator.
- ≥70% of joined players buzz at least once per game.
- Game clone rate (library leverage) and game completion rate.

## 8. Future roadmap (not in v1)

Accounts & cross-device libraries, AI board generation from a topic/document,
images/audio uploads (v1 is URL-based), spectator mode, async homework mode,
analytics for teachers, localization, self-serve theming.
