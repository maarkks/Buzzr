import http from 'node:http';
import { dirname, join } from 'node:path';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { Server } from 'socket.io';
import type { ClientToServer, JoinAck, JoinPayload, ServerToClient } from '@buzzr/shared';
import { games } from './db.js';
import { Room, RoomManager } from './rooms.js';
import { sanitizeGame, sanitizeSettings, sanitizeVisibility } from './validate.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT ?? 3000);
const PUBLIC_URL = process.env.BUZZR_PUBLIC_URL ?? `http://localhost:${PORT}`;

const app = express();
app.use(express.json({ limit: '2mb' }));

const httpServer = http.createServer(app);
const io = new Server<ClientToServer, ServerToClient>(httpServer, {
  cors: { origin: true }, // dev: vite runs on another port
});

const manager = new RoomManager(io);

// ── REST: game library ────────────────────────────────────────────────────────

app.get('/api/games', (req, res) => {
  const q = String(req.query.q ?? '').slice(0, 100);
  res.json({ games: games.search(q) });
});

app.post('/api/games', (req, res) => {
  try {
    const data = sanitizeGame(req.body?.data);
    const visibility = sanitizeVisibility(req.body?.visibility);
    res.json(games.create(data, visibility));
  } catch (e) {
    res.status(400).json({ error: (e as Error).message });
  }
});

app.get('/api/games/:id', (req, res) => {
  const g = games.get(req.params.id);
  if (!g) return res.status(404).json({ error: 'Game not found' });
  res.json(g);
});

function requireToken(req: express.Request, res: express.Response): boolean {
  const token = String(req.headers['x-edit-token'] ?? '');
  if (!games.checkToken(req.params.id, token)) {
    res.status(403).json({ error: 'Invalid edit token' });
    return false;
  }
  return true;
}

app.put('/api/games/:id', (req, res) => {
  if (!games.get(req.params.id)) return res.status(404).json({ error: 'Game not found' });
  if (!requireToken(req, res)) return;
  try {
    const data = sanitizeGame(req.body?.data);
    const visibility = sanitizeVisibility(req.body?.visibility);
    games.update(req.params.id, data, visibility);
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ error: (e as Error).message });
  }
});

app.delete('/api/games/:id', (req, res) => {
  if (!games.get(req.params.id)) return res.status(404).json({ error: 'Game not found' });
  if (!requireToken(req, res)) return;
  games.delete(req.params.id);
  res.json({ ok: true });
});

app.post('/api/games/:id/clone', (req, res) => {
  const g = games.get(req.params.id);
  if (!g) return res.status(404).json({ error: 'Game not found' });
  const data = { ...g.data, title: `${g.data.title} (copy)` };
  res.json(games.create(data, 'unlisted'));
});

// ── REST: rooms ───────────────────────────────────────────────────────────────

app.post('/api/rooms', (req, res) => {
  const g = games.get(String(req.body?.gameId ?? ''));
  if (!g) return res.status(404).json({ error: 'Game not found' });
  const settings = sanitizeSettings(req.body?.settings);
  const room = manager.create(io, g.meta.id, structuredClone(g.data), settings, PUBLIC_URL);
  games.bumpPlays(g.meta.id);
  res.json({ code: room.code, hostToken: room.hostToken });
});

app.get('/api/rooms/:code', (req, res) => {
  const room = manager.get(req.params.code);
  if (!room || room.closed) return res.status(404).json({ error: 'Room not found' });
  res.json({ ok: true, phase: room.phase, mode: room.settings.mode, locked: room.locked, gameTitle: room.game.title });
});

// ── Socket.IO ─────────────────────────────────────────────────────────────────

io.on('connection', (socket) => {
  let room: Room | null = null;
  let role: JoinPayload['role'] | null = null;
  let playerId: string | null = null;

  socket.on('room:join', (payload, ack: (a: JoinAck) => void) => {
    try {
      const target = manager.get(String(payload?.code ?? ''));
      if (!target || target.closed) return ack({ ok: false, error: 'Room not found — check the code.' });
      const result = target.join(socket, payload);
      if (!result.ok) return ack(result);
      // Leaving a previous room on re-join from the same socket
      if (room && room !== target) room.leave(socket.id);
      room = target;
      role = payload.role;
      playerId = result.playerId ?? null;
      ack(result);
      room.broadcast();
    } catch (e) {
      console.error('[join]', e);
      ack({ ok: false, error: 'Something went wrong joining the room.' });
    }
  });

  const asPlayer = (fn: (room: Room, pid: string) => void) => () => {
    if (room && playerId) {
      room.touch();
      fn(room, playerId);
    }
  };
  const asHost = (fn: (room: Room) => void) => () => {
    if (room && role === 'host') {
      room.touch();
      fn(room);
    }
  };

  socket.on('player:buzz', () => asPlayer((r, pid) => r.playerBuzz(pid))());
  socket.on('player:joinTeam', (teamId) => asPlayer((r, pid) => r.playerJoinTeam(pid, String(teamId)))());
  socket.on('player:setAvatar', (avatar) => asPlayer((r, pid) => r.playerSetAvatar(pid, avatar))());
  socket.on('player:wager', (amount) => asPlayer((r, pid) => r.playerWager(pid, Number(amount)))());
  socket.on('player:finalAnswer', (text) => asPlayer((r, pid) => r.playerFinalAnswer(pid, String(text)))());

  socket.on('host:start', () => asHost((r) => r.hostStart())());
  socket.on('host:selectClue', (c, w) => asHost((r) => r.hostSelectClue(Number(c), Number(w)))());
  socket.on('host:arm', () => asHost((r) => r.hostArm())());
  socket.on('host:judge', (correct) => asHost((r) => r.hostJudge(!!correct))());
  socket.on('host:reveal', () => asHost((r) => r.hostReveal())());
  socket.on('host:close', () => asHost((r) => r.hostClose())());
  socket.on('host:setWager', (amount) => asHost((r) => r.hostSetWager(Number(amount)))());
  socket.on('host:setControl', (id) => asHost((r) => r.hostSetControl(String(id)))());
  socket.on('host:adjustScore', (id, delta) => asHost((r) => r.hostAdjustScore(String(id), Number(delta)))());
  socket.on('host:assignTeam', (pid, tid) => asHost((r) => r.hostAssignTeam(String(pid), tid === null ? null : String(tid)))());
  socket.on('host:renameTeam', (tid, name) => asHost((r) => r.hostRenameTeam(String(tid), String(name)))());
  socket.on('host:kick', (pid) => asHost((r) => r.hostKick(String(pid)))());
  socket.on('host:lockRoom', (locked) => asHost((r) => r.hostLockRoom(!!locked))());
  socket.on('host:nextRound', () => asHost((r) => r.hostNextRound())());
  socket.on('host:startFinal', () => asHost((r) => r.hostStartFinal())());
  socket.on('host:finalShowClue', () => asHost((r) => r.hostFinalShowClue())());
  socket.on('host:finalCloseAnswers', () => asHost((r) => r.hostFinalCloseAnswers())());
  socket.on('host:finalReveal', (id) => asHost((r) => r.hostFinalReveal(String(id)))());
  socket.on('host:finalJudge', (id, correct) => asHost((r) => r.hostFinalJudge(String(id), !!correct))());
  socket.on('host:endGame', () => asHost((r) => r.hostEndGame())());

  socket.on('disconnect', () => {
    if (room) room.leave(socket.id);
  });
});

// ── Static client (production build) ─────────────────────────────────────────

const clientDist = join(__dirname, '..', '..', 'client', 'dist');
if (existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get(/^\/(?!api|socket\.io).*/, (_req, res) => {
    res.sendFile(join(clientDist, 'index.html'));
  });
} else {
  app.get('/', (_req, res) => {
    res.send('Buzzr API is running. Build the client (npm run build) or use the Vite dev server.');
  });
}

httpServer.listen(PORT, () => {
  console.log(`[buzzr] listening on http://localhost:${PORT}`);
});
