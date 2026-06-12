import type { Server, Socket } from 'socket.io';
import { nanoid } from 'nanoid';
import {
  type ActiveClue,
  type Avatar,
  type BuzzWinner,
  type ClueStage,
  type EventFlash,
  type FinalPub,
  type GameData,
  type HostSecrets,
  type JoinAck,
  type JoinPayload,
  type MeState,
  type PlayerPub,
  type RoomPhase,
  type RoomSettings,
  type RoomSnapshot,
  type SfxName,
  type TeamPub,
  type TimerInfo,
  clueIsEmpty,
  fmtScore,
  MAX_PLAYERS,
  randomAvatar,
  TEAM_COLORS,
  TEAM_DEFAULT_NAMES,
} from '@buzzr/shared';

// Room codes avoid ambiguous glyphs (0/O, 1/I/L).
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
function makeCode(): string {
  let s = '';
  for (let i = 0; i < 4; i++) s += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  return s;
}

interface Player {
  id: string;
  name: string;
  avatar: Avatar;
  teamId: string | null;
  score: number;
  sockets: Set<string>;
  lastSeen: number;
}

interface Team {
  id: string;
  name: string;
  color: string;
  score: number;
}

interface InternalClue {
  categoryIndex: number;
  rowIndex: number;
  value: number;
  question: string;
  answer: string;
  image?: string;
  isDailyDouble: boolean;
  wager: number | null;
  ddOwnerId: string | null;
}

interface FinalEntry {
  entityId: string;
  wager: number | null;
  answer: string | null;
  judged: 'correct' | 'wrong' | null;
  revealed: boolean;
}

interface RoomTimer {
  info: TimerInfo;
  handle: ReturnType<typeof setTimeout>;
}

const ANSWER_GRACE_MS = 500;

export class Room {
  code = makeCode();
  hostToken = nanoid(20);
  createdAt = Date.now();
  lastActivity = Date.now();
  closed = false;

  phase: RoomPhase = 'lobby';
  locked = false;
  roundIndex = 0;

  players = new Map<string, Player>();
  teams: Team[] = [];

  /** used[round][cat][row] */
  used: boolean[][][];

  clue: InternalClue | null = null;
  clueStage: ClueStage | null = null;

  buzzWinnerId: string | null = null;
  buzzWinnerAt = 0;
  buzzArmedAt = 0;
  buzzQueue: string[] = [];
  /** entity ids locked out of the current clue */
  lockedEntities = new Set<string>();

  controlId: string | null = null;
  revealedAnswer: string | null = null;

  finalEntries = new Map<string, FinalEntry>();
  finalQuestionShown = false;
  finalAnswersClosed = false;
  finalRevealOrder: string[] = [];

  timer: RoomTimer | null = null;
  flash: EventFlash | null = null;
  flashSeq = 0;
  lastJudge: { entityId: string; result: 'correct' | 'wrong'; at: number } | null = null;
  podium: RoomSnapshot['podium'] = null;

  hostSockets = new Set<string>();
  boardSockets = new Set<string>();
  /** socketId -> playerId */
  playerSockets = new Map<string, string>();

  constructor(
    public io: Server,
    public gameId: string,
    public game: GameData,
    public settings: RoomSettings,
    public publicUrl: string,
  ) {
    this.used = game.rounds.map((r) =>
      r.categories.map((c) => c.clues.map((clue) => clueIsEmpty(clue))),
    );
    if (settings.mode === 'teams') {
      const n = Math.max(2, Math.min(8, settings.teamCount));
      for (let i = 0; i < n; i++) {
        this.teams.push({ id: nanoid(8), name: TEAM_DEFAULT_NAMES[i], color: TEAM_COLORS[i], score: 0 });
      }
    }
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  get round() {
    return this.game.rounds[this.roundIndex];
  }

  touch() {
    this.lastActivity = Date.now();
  }

  socketCount(): number {
    return this.hostSockets.size + this.boardSockets.size + this.playerSockets.size;
  }

  /** Scoring entity for a player: their team in teams mode, themselves in ffa. */
  entityOf(player: Player): string | null {
    return this.settings.mode === 'teams' ? player.teamId : player.id;
  }

  entityScore(entityId: string): number {
    if (this.settings.mode === 'teams') {
      const t = this.teams.find((t) => t.id === entityId);
      if (t) return t.score;
    }
    return this.players.get(entityId)?.score ?? 0;
  }

  entityName(entityId: string | null): string | null {
    if (!entityId) return null;
    const t = this.teams.find((t) => t.id === entityId);
    if (t) return t.name;
    return this.players.get(entityId)?.name ?? null;
  }

  addScore(entityId: string, delta: number) {
    const t = this.teams.find((t) => t.id === entityId);
    if (t) {
      t.score += delta;
      return;
    }
    const p = this.players.get(entityId);
    if (p) p.score += delta;
  }

  /** Entities that participate in scoring/final round. */
  entities(): { id: string; name: string; color: string | null; avatar: Avatar | null; score: number }[] {
    if (this.settings.mode === 'teams') {
      return this.teams
        .filter((t) => [...this.players.values()].some((p) => p.teamId === t.id))
        .map((t) => ({ id: t.id, name: t.name, color: t.color, avatar: null, score: t.score }));
    }
    return [...this.players.values()].map((p) => ({ id: p.id, name: p.name, color: p.avatar.color, avatar: p.avatar, score: p.score }));
  }

  setFlash(type: EventFlash['type'], text: string) {
    this.flash = { id: ++this.flashSeq, type, text };
  }

  sfx(name: SfxName) {
    for (const sid of [...this.hostSockets, ...this.boardSockets, ...this.playerSockets.keys()]) {
      this.io.to(sid).emit('sfx', name);
    }
  }

  setTimer(kind: TimerInfo['kind'], ms: number, onExpire: () => void) {
    this.clearTimer();
    const info: TimerInfo = { kind, endsAt: Date.now() + ms, totalMs: ms };
    this.timer = {
      info,
      handle: setTimeout(() => {
        this.timer = null;
        onExpire();
      }, ms),
    };
  }

  clearTimer() {
    if (this.timer) {
      clearTimeout(this.timer.handle);
      this.timer = null;
    }
  }

  // ── Snapshots ──────────────────────────────────────────────────────────────

  buildSnapshot(): RoomSnapshot {
    const round = this.round;
    const buzzWinner = this.buildBuzzWinner();
    return {
      code: this.code,
      phase: this.phase,
      settings: this.settings,
      locked: this.locked,
      gameTitle: this.game.title,
      roundIndex: this.roundIndex,
      roundCount: this.game.rounds.length,
      roundName: round?.name ?? '',
      hasFinal: !!this.game.final,
      categories: round?.categories.map((c) => c.name || '—') ?? [],
      values: round?.values ?? [],
      used: this.used[this.roundIndex] ?? [],
      players: [...this.players.values()].map((p) => this.playerPub(p)),
      teams: this.teams.map((t): TeamPub => ({ id: t.id, name: t.name, color: t.color, score: t.score })),
      controlId: this.controlId,
      controlName: this.entityName(this.controlId),
      clue: this.buildActiveClue(),
      clueStage: this.clueStage,
      buzzWinner,
      revealedAnswer: this.revealedAnswer,
      timer: this.timer?.info ?? null,
      final: this.buildFinalPub(),
      flash: this.flash,
      podium: this.podium,
    };
  }

  playerPub(p: Player): PlayerPub {
    const eid = this.entityOf(p);
    return {
      id: p.id,
      name: p.name,
      avatar: p.avatar,
      teamId: p.teamId,
      score: p.score,
      connected: p.sockets.size > 0,
      locked: !!eid && this.lockedEntities.has(eid),
    };
  }

  buildActiveClue(): ActiveClue | null {
    if (!this.clue) return null;
    const c = this.clue;
    return {
      categoryIndex: c.categoryIndex,
      rowIndex: c.rowIndex,
      category: this.round.categories[c.categoryIndex]?.name ?? '',
      value: c.value,
      question: c.question,
      image: c.image,
      isDailyDouble: c.isDailyDouble,
      wager: c.wager,
      ddOwnerId: c.ddOwnerId,
      ddOwnerName: this.entityName(c.ddOwnerId),
    };
  }

  buildBuzzWinner(): BuzzWinner | null {
    if (!this.buzzWinnerId) return null;
    const p = this.players.get(this.buzzWinnerId);
    if (!p) return null;
    const team = this.teams.find((t) => t.id === p.teamId) ?? null;
    return {
      playerId: p.id,
      name: p.name,
      avatar: p.avatar,
      teamId: p.teamId,
      teamName: team?.name ?? null,
      reactionMs: Math.max(0, this.buzzWinnerAt - this.buzzArmedAt),
    };
  }

  buildFinalPub(): FinalPub | null {
    if (!this.phase.startsWith('final') || !this.game.final) return null;
    const ents = this.entities();
    const entries = [...this.finalEntries.values()];
    return {
      category: this.game.final.category,
      question: this.finalQuestionShown ? this.game.final.question : null,
      image: this.finalQuestionShown ? this.game.final.image : undefined,
      wagersIn: entries.filter((e) => e.wager !== null).length,
      wagersExpected: ents.length,
      answersIn: entries.filter((e) => e.answer !== null && e.answer.trim() !== '').length,
      reveals: this.finalRevealOrder.map((id) => {
        const e = this.finalEntries.get(id)!;
        const ent = ents.find((x) => x.id === id);
        return {
          entityId: id,
          name: ent?.name ?? this.entityName(id) ?? '?',
          avatar: ent?.avatar ?? null,
          color: ent?.color ?? null,
          answer: e.answer ?? '',
          wager: e.judged ? e.wager : null, // wager revealed only once judged (show drama)
          judged: e.judged,
          scoreAfter: this.entityScore(id),
        };
      }),
    };
  }

  buildMe(playerId: string): MeState {
    const p = this.players.get(playerId);
    const eid = p ? this.entityOf(p) : null;
    const lockedOut = !!eid && this.lockedEntities.has(eid);
    const isDDOwner = !!eid && this.clue?.ddOwnerId === eid;
    const me: MeState = {
      playerId,
      canBuzz:
        this.phase === 'clue' &&
        this.clueStage === 'armed' &&
        !!eid &&
        !lockedOut,
      lockedOut,
      hasFloor: this.buzzWinnerId === playerId,
      mustWager: false,
      wagerMin: 0,
      wagerMax: 0,
      wagerSubmitted: null,
      mustAnswer: false,
      answerSubmitted: null,
      judgeFlash: null,
    };
    if (this.phase === 'clue' && this.clueStage === 'wager' && isDDOwner && eid) {
      me.mustWager = true;
      me.wagerMin = 5;
      me.wagerMax = this.ddMaxWager(eid);
      me.wagerSubmitted = this.clue?.wager ?? null;
    }
    if (this.phase === 'final-wager' && eid) {
      const entry = this.finalEntries.get(eid);
      me.mustWager = true;
      me.wagerMin = 0;
      me.wagerMax = Math.max(0, this.entityScore(eid) - (entry?.judged ? 0 : 0));
      // wagerMax is based on pre-final score; entries are judged later so score is still pre-final here
      me.wagerMax = Math.max(0, this.entityScore(eid));
      me.wagerSubmitted = entry?.wager ?? null;
    }
    if (this.phase === 'final-answer' && eid && !this.finalAnswersClosed) {
      const entry = this.finalEntries.get(eid);
      me.mustAnswer = true;
      me.answerSubmitted = entry?.answer ?? null;
    }
    if (this.lastJudge && eid && Date.now() - this.lastJudge.at < 4000 && this.lastJudge.entityId === eid) {
      me.judgeFlash = this.lastJudge.result;
    }
    return me;
  }

  buildSecrets(): HostSecrets {
    const ents = this.entities();
    return {
      answer: this.clue?.answer ?? (this.phase.startsWith('final') ? this.game.final?.answer ?? null : null),
      buzzQueue: this.buzzQueue
        .map((id) => this.players.get(id)?.name)
        .filter((n): n is string => !!n),
      finalAnswer: this.game.final?.answer ?? null,
      finalBoard: ents.map((e) => {
        const entry = this.finalEntries.get(e.id);
        return {
          entityId: e.id,
          name: e.name,
          wager: entry?.wager ?? null,
          answer: entry?.answer ?? null,
          judged: entry?.judged ?? null,
          revealed: entry?.revealed ?? false,
        };
      }),
      joinUrl: this.publicUrl,
    };
  }

  /** Push role-appropriate state to every connected socket. */
  broadcast() {
    const snap = this.buildSnapshot();
    const secrets = this.buildSecrets();
    for (const sid of this.hostSockets) this.io.to(sid).emit('room:state', snap, null, secrets);
    for (const sid of this.boardSockets) this.io.to(sid).emit('room:state', snap, null, null);
    for (const [sid, pid] of this.playerSockets) this.io.to(sid).emit('room:state', snap, this.buildMe(pid), null);
  }

  // ── Join / leave ───────────────────────────────────────────────────────────

  join(socket: Socket, payload: JoinPayload): JoinAck {
    this.touch();
    if (payload.role === 'host') {
      if (payload.hostToken !== this.hostToken) return { ok: false, error: 'Invalid host token.' };
      this.hostSockets.add(socket.id);
      return { ok: true };
    }
    if (payload.role === 'board') {
      this.boardSockets.add(socket.id);
      return { ok: true };
    }
    // player
    const existing = payload.playerId ? this.players.get(payload.playerId) : undefined;
    if (existing) {
      existing.sockets.add(socket.id);
      existing.lastSeen = Date.now();
      if (payload.name) existing.name = sanitizeName(payload.name);
      if (payload.avatar) existing.avatar = sanitizeAvatar(payload.avatar);
      this.playerSockets.set(socket.id, existing.id);
      return { ok: true, playerId: existing.id };
    }
    if (this.locked) return { ok: false, error: 'This room is locked.' };
    if (this.players.size >= MAX_PLAYERS) return { ok: false, error: 'Room is full.' };
    if (this.phase === 'ended') return { ok: false, error: 'This game has ended.' };
    const player: Player = {
      id: nanoid(10),
      name: sanitizeName(payload.name ?? 'Player'),
      avatar: payload.avatar ? sanitizeAvatar(payload.avatar) : randomAvatar(),
      teamId: null,
      score: 0,
      sockets: new Set([socket.id]),
      lastSeen: Date.now(),
    };
    if (this.settings.mode === 'teams') {
      // auto-assign to the smallest team
      const sizes = this.teams.map((t) => ({
        t,
        n: [...this.players.values()].filter((p) => p.teamId === t.id).length,
      }));
      sizes.sort((a, b) => a.n - b.n);
      player.teamId = sizes[0]?.t.id ?? null;
    }
    this.players.set(player.id, player);
    this.playerSockets.set(socket.id, player.id);
    return { ok: true, playerId: player.id };
  }

  leave(socketId: string) {
    this.hostSockets.delete(socketId);
    this.boardSockets.delete(socketId);
    const pid = this.playerSockets.get(socketId);
    if (pid) {
      this.playerSockets.delete(socketId);
      const p = this.players.get(pid);
      if (p) {
        p.sockets.delete(socketId);
        p.lastSeen = Date.now();
        // In the lobby, players who leave disappear; mid-game they stay (reconnect keeps score).
        if (this.phase === 'lobby' && p.sockets.size === 0) this.players.delete(pid);
      }
    }
    this.broadcast();
  }

  close(reason: string) {
    this.closed = true;
    this.clearTimer();
    for (const sid of [...this.hostSockets, ...this.boardSockets, ...this.playerSockets.keys()]) {
      this.io.to(sid).emit('room:closed', reason);
    }
  }

  // ── Player intents ─────────────────────────────────────────────────────────

  playerBuzz(playerId: string) {
    if (this.phase !== 'clue' || !this.clue) return;
    const p = this.players.get(playerId);
    if (!p) return;
    const eid = this.entityOf(p);
    if (!eid || this.lockedEntities.has(eid)) return;
    if (this.clueStage === 'armed') {
      this.clearTimer();
      this.buzzWinnerId = playerId;
      this.buzzWinnerAt = Date.now();
      this.buzzQueue = [];
      this.clueStage = 'buzzed';
      this.sfx('buzz');
      // Informational answer countdown; the host still judges manually.
      this.setTimer('answer', this.settings.answerSec * 1000 + ANSWER_GRACE_MS, () => {
        if (this.clueStage === 'buzzed') {
          this.setFlash('timeout', `Time! ${this.players.get(playerId)?.name ?? ''} ran out of time`);
          this.sfx('timeout');
          this.broadcast();
        }
      });
      this.broadcast();
    } else if (this.clueStage === 'buzzed' && this.buzzWinnerId !== playerId) {
      // Late buzz — record order for the host's queue display.
      if (!this.buzzQueue.includes(playerId)) {
        this.buzzQueue.push(playerId);
        this.broadcast();
      }
    }
  }

  playerJoinTeam(playerId: string, teamId: string) {
    if (this.settings.mode !== 'teams') return;
    if (this.phase !== 'lobby') return; // mid-game moves are host-only
    const p = this.players.get(playerId);
    if (!p || !this.teams.some((t) => t.id === teamId)) return;
    p.teamId = teamId;
    this.broadcast();
  }

  playerSetAvatar(playerId: string, avatar: Avatar) {
    const p = this.players.get(playerId);
    if (!p) return;
    p.avatar = sanitizeAvatar(avatar);
    this.broadcast();
  }

  playerWager(playerId: string, amount: number) {
    const p = this.players.get(playerId);
    if (!p) return;
    const eid = this.entityOf(p);
    if (!eid) return;
    if (this.phase === 'clue' && this.clueStage === 'wager' && this.clue?.ddOwnerId === eid) {
      this.setDDWager(amount);
      return;
    }
    if (this.phase === 'final-wager') {
      const entry = this.getFinalEntry(eid);
      entry.wager = clampInt(amount, 0, Math.max(0, this.entityScore(eid)));
      this.broadcast();
    }
  }

  playerFinalAnswer(playerId: string, text: string) {
    if (this.phase !== 'final-answer' || this.finalAnswersClosed) return;
    const p = this.players.get(playerId);
    if (!p) return;
    const eid = this.entityOf(p);
    if (!eid) return;
    const entry = this.getFinalEntry(eid);
    entry.answer = String(text).slice(0, 200);
    this.broadcast();
  }

  // ── Host intents ───────────────────────────────────────────────────────────

  hostStart() {
    if (this.phase !== 'lobby') return;
    this.phase = 'board';
    // Random initial control among participating entities.
    const ents = this.entities();
    if (ents.length) this.controlId = ents[Math.floor(Math.random() * ents.length)].id;
    this.sfx('board-fill');
    this.broadcast();
  }

  hostSelectClue(categoryIndex: number, rowIndex: number) {
    if (this.phase !== 'board') return;
    const round = this.round;
    const cat = round?.categories[categoryIndex];
    const clue = cat?.clues[rowIndex];
    if (!cat || !clue) return;
    if (this.used[this.roundIndex][categoryIndex][rowIndex]) return;
    this.clue = {
      categoryIndex,
      rowIndex,
      value: round.values[rowIndex] ?? 0,
      question: clue.question,
      answer: clue.answer,
      image: clue.image,
      isDailyDouble: !!clue.dailyDouble,
      wager: null,
      ddOwnerId: clue.dailyDouble ? this.controlId : null,
    };
    this.phase = 'clue';
    this.revealedAnswer = null;
    this.buzzWinnerId = null;
    this.buzzQueue = [];
    this.lockedEntities.clear();
    this.flash = null;
    if (this.clue.isDailyDouble) {
      this.clueStage = 'wager';
      this.setFlash('daily-double', 'DAILY DOUBLE!');
      this.sfx('daily-double');
    } else {
      this.clueStage = 'reading';
      this.sfx('clue-open');
      if (this.settings.autoArm) this.arm();
    }
    this.broadcast();
  }

  hostArm() {
    if (this.phase !== 'clue' || this.clueStage !== 'reading') return;
    this.arm();
    this.broadcast();
  }

  private arm() {
    this.clueStage = 'armed';
    this.buzzArmedAt = Date.now();
    this.buzzWinnerId = null;
    this.buzzQueue = [];
    this.setTimer('buzz', this.settings.buzzWindowSec * 1000, () => this.onBuzzWindowExpired());
  }

  private onBuzzWindowExpired() {
    if (this.phase !== 'clue' || this.clueStage !== 'armed' || !this.clue) return;
    this.clueStage = 'resolved';
    this.revealedAnswer = this.clue.answer;
    this.setFlash('timeout', 'No takers!');
    this.sfx('timeout');
    this.broadcast();
  }

  hostJudge(correct: boolean) {
    if (this.phase !== 'clue' || !this.clue) return;
    // Daily double judging
    if (this.clueStage === 'dd-answer') {
      const eid = this.clue.ddOwnerId;
      const wager = this.clue.wager ?? 0;
      if (!eid) return;
      this.clearTimer();
      this.addScore(eid, correct ? wager : -wager);
      this.lastJudge = { entityId: eid, result: correct ? 'correct' : 'wrong', at: Date.now() };
      this.setFlash(correct ? 'correct' : 'wrong', `${this.entityName(eid)} ${correct ? 'wins' : 'loses'} ${fmtScore(wager)}`);
      this.sfx(correct ? 'correct' : 'wrong');
      this.clueStage = 'resolved';
      this.revealedAnswer = this.clue.answer;
      this.broadcast();
      return;
    }
    if (this.clueStage !== 'buzzed' || !this.buzzWinnerId) return;
    const p = this.players.get(this.buzzWinnerId);
    if (!p) return;
    const eid = this.entityOf(p);
    if (!eid) return;
    this.clearTimer();
    this.lastJudge = { entityId: eid, result: correct ? 'correct' : 'wrong', at: Date.now() };
    if (correct) {
      this.addScore(eid, this.clue.value);
      this.controlId = eid;
      this.setFlash('correct', `${this.entityName(eid)} +${fmtScore(this.clue.value)}`);
      this.sfx('correct');
      this.clueStage = 'resolved';
      this.revealedAnswer = this.clue.answer;
      this.buzzWinnerId = null;
    } else {
      if (this.settings.penalizeWrong) this.addScore(eid, -this.clue.value);
      this.lockedEntities.add(eid);
      this.setFlash('wrong', `${this.entityName(eid)} ${this.settings.penalizeWrong ? `−${fmtScore(this.clue.value)}` : '— locked out'}`);
      this.sfx('wrong');
      this.buzzWinnerId = null;
      this.buzzQueue = [];
      if (this.anyEligibleBuzzers()) {
        this.arm(); // fresh window for everyone still eligible
      } else {
        this.clueStage = 'resolved';
        this.revealedAnswer = this.clue.answer;
      }
    }
    this.broadcast();
  }

  private anyEligibleBuzzers(): boolean {
    for (const p of this.players.values()) {
      const eid = this.entityOf(p);
      if (eid && !this.lockedEntities.has(eid) && p.sockets.size > 0) return true;
    }
    return false;
  }

  hostReveal() {
    if (this.phase !== 'clue' || !this.clue) return;
    this.clearTimer();
    this.clueStage = 'resolved';
    this.revealedAnswer = this.clue.answer;
    this.buzzWinnerId = null;
    this.broadcast();
  }

  hostClose() {
    if (this.phase !== 'clue' || !this.clue) return;
    this.clearTimer();
    this.used[this.roundIndex][this.clue.categoryIndex][this.clue.rowIndex] = true;
    this.clue = null;
    this.clueStage = null;
    this.buzzWinnerId = null;
    this.buzzQueue = [];
    this.lockedEntities.clear();
    this.revealedAnswer = null;
    this.phase = 'board';
    if (this.boardExhausted()) {
      this.setFlash('info', `${this.round.name} complete!`);
    }
    this.broadcast();
  }

  boardExhausted(): boolean {
    return this.used[this.roundIndex].every((cat) => cat.every(Boolean));
  }

  ddMaxWager(entityId: string): number {
    const topValue = Math.max(...(this.round?.values ?? [0]));
    return Math.max(this.entityScore(entityId), topValue);
  }

  hostSetWager(amount: number) {
    if (this.phase === 'clue' && this.clueStage === 'wager') {
      this.setDDWager(amount);
    }
  }

  private setDDWager(amount: number) {
    if (!this.clue || this.clueStage !== 'wager') return;
    const eid = this.clue.ddOwnerId;
    if (!eid) return;
    this.clue.wager = clampInt(amount, 5, this.ddMaxWager(eid));
    this.clueStage = 'dd-answer';
    this.sfx('clue-open');
    this.setTimer('answer', this.settings.answerSec * 1000 + ANSWER_GRACE_MS, () => {
      if (this.clueStage === 'dd-answer') {
        this.setFlash('timeout', 'Time!');
        this.sfx('timeout');
        this.broadcast();
      }
    });
    this.broadcast();
  }

  hostSetControl(entityId: string) {
    const valid = this.teams.some((t) => t.id === entityId) || this.players.has(entityId);
    if (!valid) return;
    this.controlId = entityId;
    // If a daily double is waiting on a wager, re-point it at the new owner.
    if (this.clue && this.clueStage === 'wager') this.clue.ddOwnerId = entityId;
    this.broadcast();
  }

  hostAdjustScore(entityId: string, delta: number) {
    if (!Number.isFinite(delta)) return;
    this.addScore(entityId, Math.trunc(delta));
    this.broadcast();
  }

  hostAssignTeam(playerId: string, teamId: string | null) {
    const p = this.players.get(playerId);
    if (!p) return;
    if (teamId !== null && !this.teams.some((t) => t.id === teamId)) return;
    p.teamId = teamId;
    this.broadcast();
  }

  hostRenameTeam(teamId: string, name: string) {
    const t = this.teams.find((t) => t.id === teamId);
    if (!t) return;
    t.name = sanitizeName(name) || t.name;
    this.broadcast();
  }

  hostKick(playerId: string) {
    const p = this.players.get(playerId);
    if (!p) return;
    for (const sid of p.sockets) {
      this.io.to(sid).emit('room:closed', 'You were removed by the host.');
      this.playerSockets.delete(sid);
    }
    this.players.delete(playerId);
    this.broadcast();
  }

  hostLockRoom(locked: boolean) {
    this.locked = !!locked;
    this.broadcast();
  }

  hostNextRound() {
    if (this.phase !== 'board') return;
    if (this.roundIndex + 1 >= this.game.rounds.length) return;
    this.roundIndex++;
    this.setFlash('info', this.round.name);
    this.sfx('board-fill');
    this.broadcast();
  }

  hostStartFinal() {
    if (!this.game.final) return;
    if (this.phase !== 'board') return;
    this.phase = 'final-wager';
    this.finalEntries.clear();
    this.finalQuestionShown = false;
    this.finalAnswersClosed = false;
    this.finalRevealOrder = [];
    this.clearTimer();
    this.setFlash('info', 'Final Round — place your wagers!');
    this.sfx('final');
    this.broadcast();
  }

  hostFinalShowClue() {
    if (this.phase !== 'final-wager' || !this.game.final) return;
    // Anyone who didn't wager is locked in at 0.
    for (const e of this.entities()) {
      const entry = this.getFinalEntry(e.id);
      if (entry.wager === null) entry.wager = 0;
    }
    this.phase = 'final-answer';
    this.finalQuestionShown = true;
    this.sfx('clue-open');
    this.setTimer('final', this.settings.finalAnswerSec * 1000, () => this.closeFinalAnswers());
    this.broadcast();
  }

  hostFinalCloseAnswers() {
    if (this.phase !== 'final-answer') return;
    this.clearTimer();
    this.closeFinalAnswers();
  }

  private closeFinalAnswers() {
    if (this.phase !== 'final-answer') return;
    this.finalAnswersClosed = true;
    this.phase = 'final-reveal';
    this.setFlash('info', 'Answers are in!');
    this.sfx('timeout');
    this.broadcast();
  }

  hostFinalReveal(entityId: string) {
    if (this.phase !== 'final-reveal') return;
    const entry = this.finalEntries.get(entityId) ?? this.getFinalEntry(entityId);
    if (entry.revealed) return;
    entry.revealed = true;
    this.finalRevealOrder.push(entityId);
    this.sfx('clue-open');
    this.broadcast();
  }

  hostFinalJudge(entityId: string, correct: boolean) {
    if (this.phase !== 'final-reveal') return;
    const entry = this.finalEntries.get(entityId);
    if (!entry || !entry.revealed || entry.judged) return;
    entry.judged = correct ? 'correct' : 'wrong';
    const wager = entry.wager ?? 0;
    this.addScore(entityId, correct ? wager : -wager);
    this.lastJudge = { entityId, result: entry.judged, at: Date.now() };
    this.setFlash(correct ? 'correct' : 'wrong', `${this.entityName(entityId)} ${correct ? '+' : '−'}${fmtScore(wager)}`);
    this.sfx(correct ? 'correct' : 'wrong');
    this.broadcast();
  }

  hostEndGame() {
    this.clearTimer();
    this.phase = 'ended';
    this.podium = this.entities()
      .sort((a, b) => b.score - a.score)
      .map((e) => ({ name: e.name, score: e.score, color: e.color, avatar: e.avatar }));
    this.sfx('final');
    this.broadcast();
  }

  private getFinalEntry(entityId: string): FinalEntry {
    let e = this.finalEntries.get(entityId);
    if (!e) {
      e = { entityId, wager: null, answer: null, judged: null, revealed: false };
      this.finalEntries.set(entityId, e);
    }
    return e;
  }
}

function sanitizeName(name: string): string {
  return String(name).replace(/\s+/g, ' ').trim().slice(0, 24);
}

function sanitizeAvatar(a: Avatar): Avatar {
  return { emoji: String(a.emoji).slice(0, 8), color: /^#[0-9a-fA-F]{6}$/.test(a.color) ? a.color : '#3b82f6' };
}

function clampInt(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, Math.trunc(n)));
}

// ── Room manager ──────────────────────────────────────────────────────────────

export class RoomManager {
  rooms = new Map<string, Room>();

  constructor(public io: Server) {
    setInterval(() => this.sweep(), 10 * 60 * 1000).unref();
  }

  create(io: Server, gameId: string, game: GameData, settings: RoomSettings, publicUrl: string): Room {
    let room = new Room(io, gameId, game, settings, publicUrl);
    while (this.rooms.has(room.code)) room = new Room(io, gameId, game, settings, publicUrl);
    this.rooms.set(room.code, room);
    return room;
  }

  get(code: string): Room | undefined {
    return this.rooms.get(code.toUpperCase());
  }

  sweep() {
    const now = Date.now();
    for (const [code, room] of this.rooms) {
      const idleMs = now - room.lastActivity;
      const abandoned = room.socketCount() === 0 && idleMs > 30 * 60 * 1000;
      const expired = idleMs > 3 * 60 * 60 * 1000;
      if (abandoned || expired || room.closed) {
        room.close('Room expired.');
        this.rooms.delete(code);
      }
    }
  }
}
