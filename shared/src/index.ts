// ─────────────────────────────────────────────────────────────────────────────
// Buzzr shared types & protocol — the single source of truth for the data
// model (game content) and the live room protocol (snapshots + intents).
// ─────────────────────────────────────────────────────────────────────────────

// ── Game content ─────────────────────────────────────────────────────────────

export interface Clue {
  question: string;
  answer: string;
  /** Optional image URL shown with the question. */
  image?: string;
  dailyDouble?: boolean;
}

export interface Category {
  name: string;
  clues: Clue[];
}

export interface Round {
  name: string;
  /** Point values for each row, e.g. [100,200,300,400,500]. */
  values: number[];
  categories: Category[];
}

export interface FinalRound {
  category: string;
  question: string;
  answer: string;
  image?: string;
}

export interface GameData {
  title: string;
  description?: string;
  tags?: string[];
  rounds: Round[];
  final?: FinalRound | null;
}

export type Visibility = 'public' | 'unlisted';

export interface GameMeta {
  id: string;
  title: string;
  description: string;
  tags: string[];
  visibility: Visibility;
  plays: number;
  createdAt: number;
  updatedAt: number;
  /** Categories × rows of the first round, for browse cards. */
  size: { categories: number; rows: number; rounds: number; hasFinal: boolean };
}

// ── Room model ───────────────────────────────────────────────────────────────

export type GameMode = 'teams' | 'ffa';

export interface RoomSettings {
  mode: GameMode;
  teamCount: number;
  /** Deduct clue value on a wrong buzz-in answer. */
  penalizeWrong: boolean;
  /** Seconds players have to buzz once armed. */
  buzzWindowSec: number;
  /** Seconds shown for answering after winning the buzz (visual aid). */
  answerSec: number;
  /** Arm buzzers automatically as soon as a clue opens. */
  autoArm: boolean;
  /** Seconds to submit final-round answers. */
  finalAnswerSec: number;
}

export interface Avatar {
  emoji: string;
  color: string;
}

export interface PlayerPub {
  id: string;
  name: string;
  avatar: Avatar;
  teamId: string | null;
  score: number;
  connected: boolean;
  /** Locked out of the current clue. */
  locked: boolean;
}

export interface TeamPub {
  id: string;
  name: string;
  color: string;
  score: number;
}

export type RoomPhase =
  | 'lobby'
  | 'board'
  | 'clue'
  | 'final-intro'
  | 'final-wager'
  | 'final-answer'
  | 'final-reveal'
  | 'ended';

export type ClueStage =
  | 'reading'   // clue shown, buzzers not armed
  | 'armed'     // buzzers live
  | 'buzzed'    // someone locked in, host judging
  | 'wager'     // daily double: waiting on wager
  | 'dd-answer' // daily double: wagerer answering
  | 'resolved'; // answer revealed / dead clue, awaiting close

export interface ActiveClue {
  categoryIndex: number;
  rowIndex: number;
  category: string;
  value: number;
  question: string;
  image?: string;
  isDailyDouble: boolean;
  /** Daily-double wager (visible to everyone once set). */
  wager: number | null;
  /** Entity id (player or team) answering the daily double. */
  ddOwnerId: string | null;
  ddOwnerName: string | null;
}

export interface BuzzWinner {
  playerId: string;
  name: string;
  avatar: Avatar;
  teamId: string | null;
  teamName: string | null;
  /** ms between arming and the winning buzz. */
  reactionMs: number;
}

export interface TimerInfo {
  kind: 'buzz' | 'answer' | 'final';
  endsAt: number; // epoch ms (server clock)
  totalMs: number;
}

export interface FinalRevealEntry {
  entityId: string;
  name: string;
  avatar: Avatar | null;
  color: string | null;
  answer: string | null;
  wager: number | null;
  judged: 'correct' | 'wrong' | null;
  scoreAfter: number;
}

export interface FinalPub {
  category: string;
  /** null until the host reveals the clue. */
  question: string | null;
  image?: string;
  wagersIn: number;
  wagersExpected: number;
  answersIn: number;
  /** Reveal sequence, populated during final-reveal in host-chosen order. */
  reveals: FinalRevealEntry[];
}

export interface EventFlash {
  id: number;
  type: 'correct' | 'wrong' | 'timeout' | 'info' | 'daily-double';
  text: string;
}

export interface RoomSnapshot {
  code: string;
  phase: RoomPhase;
  settings: RoomSettings;
  locked: boolean;
  gameTitle: string;
  roundIndex: number;
  roundCount: number;
  roundName: string;
  hasFinal: boolean;
  categories: string[];
  values: number[];
  /** used[categoryIndex][rowIndex] — true when the cell was played/empty. */
  used: boolean[][];
  players: PlayerPub[];
  teams: TeamPub[];
  /** Entity (team in teams mode, player in ffa) currently "in control". */
  controlId: string | null;
  controlName: string | null;
  clue: ActiveClue | null;
  clueStage: ClueStage | null;
  buzzWinner: BuzzWinner | null;
  /** The answer, revealed to EVERYONE (set when host reveals / clue resolves). */
  revealedAnswer: string | null;
  timer: TimerInfo | null;
  final: FinalPub | null;
  flash: EventFlash | null;
  /** Podium order at game end (entity ids best-first). */
  podium: { name: string; score: number; color: string | null; avatar: Avatar | null }[] | null;
}

/** Extra state only the host receives. */
export interface HostSecrets {
  /** Answer to the currently open clue. */
  answer: string | null;
  /** Pending buzzes behind the winner (names in order). */
  buzzQueue: string[];
  finalAnswer: string | null;
  /** Live final wagers/answers as they arrive. */
  finalBoard: {
    entityId: string;
    name: string;
    wager: number | null;
    answer: string | null;
    judged: 'correct' | 'wrong' | null;
    revealed: boolean;
  }[];
  /** Full board with all questions/answers for the current round (host peek). */
  joinUrl: string;
}

// ── Per-player private state (what *my* phone needs to know) ─────────────────

export interface MeState {
  playerId: string;
  canBuzz: boolean;
  lockedOut: boolean;
  /** I'm the buzz winner right now. */
  hasFloor: boolean;
  /** I must enter a wager (daily double control or final round). */
  mustWager: boolean;
  wagerMin: number;
  wagerMax: number;
  wagerSubmitted: number | null;
  /** I must type a final answer. */
  mustAnswer: boolean;
  answerSubmitted: string | null;
  judgeFlash: 'correct' | 'wrong' | null;
}

// ── Socket protocol ──────────────────────────────────────────────────────────

export type Role = 'host' | 'board' | 'player';

export interface JoinPayload {
  code: string;
  role: Role;
  hostToken?: string;
  /** Stable per-room identity for reconnects. */
  playerId?: string;
  name?: string;
  avatar?: Avatar;
}

export interface JoinAck {
  ok: boolean;
  error?: string;
  playerId?: string;
}

/** client → server events */
export interface ClientToServer {
  'room:join': (p: JoinPayload, ack: (a: JoinAck) => void) => void;
  'player:buzz': () => void;
  'player:joinTeam': (teamId: string) => void;
  'player:setAvatar': (avatar: Avatar) => void;
  'player:wager': (amount: number) => void;
  'player:finalAnswer': (text: string) => void;
  'host:start': () => void;
  'host:selectClue': (categoryIndex: number, rowIndex: number) => void;
  'host:arm': () => void;
  'host:judge': (correct: boolean) => void;
  'host:reveal': () => void;
  'host:close': () => void;
  'host:setWager': (amount: number) => void;
  'host:setControl': (entityId: string) => void;
  'host:adjustScore': (entityId: string, delta: number) => void;
  'host:assignTeam': (playerId: string, teamId: string | null) => void;
  'host:renameTeam': (teamId: string, name: string) => void;
  'host:kick': (playerId: string) => void;
  'host:lockRoom': (locked: boolean) => void;
  'host:nextRound': () => void;
  'host:startFinal': () => void;
  'host:finalShowClue': () => void;
  'host:finalCloseAnswers': () => void;
  'host:finalReveal': (entityId: string) => void;
  'host:finalJudge': (entityId: string, correct: boolean) => void;
  'host:endGame': () => void;
}

/** server → client events */
export interface ServerToClient {
  'room:state': (snap: RoomSnapshot, me: MeState | null, secrets: HostSecrets | null) => void;
  'room:closed': (reason: string) => void;
  'sfx': (name: SfxName) => void;
}

export type SfxName =
  | 'board-fill'
  | 'clue-open'
  | 'buzz'
  | 'correct'
  | 'wrong'
  | 'timeout'
  | 'daily-double'
  | 'final'
  | 'tick';

// ── Constants & helpers ──────────────────────────────────────────────────────

export const AVATAR_EMOJI = [
  '🦊', '🐼', '🦁', '🐸', '🐙', '🦄', '🐯', '🦉',
  '🐳', '🦖', '🐝', '🦩', '🐲', '🦜', '🐢', '🦔',
  '👾', '🤖', '👻', '🎃', '🧙', '🦸', '🥷', '🧑‍🚀',
] as const;

export const AVATAR_COLORS = [
  '#f9a8d4', '#fdba74', '#fcd34d', '#bef264',
  '#6ee7b7', '#67e8f9', '#93c5fd', '#c4b5fd',
  '#f0abfc', '#fda4af', '#5eead4', '#fde047',
] as const;

export const TEAM_COLORS = [
  '#7da2f7', '#f593ab', '#5fd6a4', '#f7bd59',
  '#b39df5', '#67d3e0', '#f29ad5', '#a8d96a',
] as const;

export const TEAM_DEFAULT_NAMES = [
  'Blue Team', 'Red Team', 'Green Team', 'Gold Team',
  'Purple Team', 'Cyan Team', 'Pink Team', 'Lime Team',
] as const;

export const DEFAULT_SETTINGS: RoomSettings = {
  mode: 'teams',
  teamCount: 2,
  penalizeWrong: true,
  buzzWindowSec: 10,
  answerSec: 15,
  autoArm: false,
  finalAnswerSec: 60,
};

export const MAX_CATEGORIES = 8;
export const MAX_ROWS = 8;
export const MAX_PLAYERS = 80;

export function defaultValues(rows: number, multiplier = 1): number[] {
  return Array.from({ length: rows }, (_, i) => (i + 1) * 100 * multiplier);
}

export function emptyClue(): Clue {
  return { question: '', answer: '' };
}

export function emptyRound(name: string, categories = 5, rows = 5, multiplier = 1): Round {
  return {
    name,
    values: defaultValues(rows, multiplier),
    categories: Array.from({ length: categories }, () => ({
      name: '',
      clues: Array.from({ length: rows }, emptyClue),
    })),
  };
}

export function emptyGame(title = 'Untitled Game'): GameData {
  return { title, description: '', tags: [], rounds: [emptyRound('Round 1')], final: null };
}

export function clueIsEmpty(c: Clue): boolean {
  return !c.question.trim() && !c.answer.trim();
}

/** Format a score like the show: $1,200 / -$400 */
export function fmtScore(n: number): string {
  const sign = n < 0 ? '−' : '';
  return `${sign}$${Math.abs(n).toLocaleString('en-US')}`;
}

export function randomAvatar(): Avatar {
  return {
    emoji: AVATAR_EMOJI[Math.floor(Math.random() * AVATAR_EMOJI.length)],
    color: AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)],
  };
}
