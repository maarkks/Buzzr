import {
  type Clue,
  type GameData,
  type RoomSettings,
  type Visibility,
  DEFAULT_SETTINGS,
  MAX_CATEGORIES,
  MAX_ROWS,
} from '@buzzr/shared';

const str = (v: unknown, max: number): string => String(v ?? '').slice(0, max);

function sanitizeClue(raw: any): Clue {
  const c: Clue = {
    question: str(raw?.question, 600),
    answer: str(raw?.answer, 400),
  };
  const image = str(raw?.image, 500).trim();
  if (/^https?:\/\//i.test(image)) c.image = image;
  if (raw?.dailyDouble) c.dailyDouble = true;
  return c;
}

/** Coerce arbitrary JSON into a structurally valid GameData, or throw. */
export function sanitizeGame(raw: any): GameData {
  if (!raw || typeof raw !== 'object') throw new Error('Invalid game payload');
  const rounds = Array.isArray(raw.rounds) ? raw.rounds.slice(0, 2) : [];
  if (rounds.length === 0) throw new Error('A game needs at least one round');
  const game: GameData = {
    title: str(raw.title, 120).trim() || 'Untitled Game',
    description: str(raw.description, 500),
    tags: Array.isArray(raw.tags) ? raw.tags.slice(0, 8).map((t: unknown) => str(t, 24).trim()).filter(Boolean) : [],
    rounds: rounds.map((r: any, i: number) => {
      const cats = (Array.isArray(r?.categories) ? r.categories : []).slice(0, MAX_CATEGORIES);
      if (cats.length === 0) throw new Error('Each round needs at least one category');
      const rowCount = Math.max(1, Math.min(MAX_ROWS, Array.isArray(r?.values) ? r.values.length : 5));
      const values = Array.from({ length: rowCount }, (_, j) => {
        const v = Number(r?.values?.[j]);
        return Number.isFinite(v) ? Math.max(0, Math.min(1_000_000, Math.trunc(v))) : (j + 1) * 100;
      });
      return {
        name: str(r?.name, 40).trim() || `Round ${i + 1}`,
        values,
        categories: cats.map((c: any) => ({
          name: str(c?.name, 80),
          clues: Array.from({ length: rowCount }, (_, j) => sanitizeClue(c?.clues?.[j])),
        })),
      };
    }),
    final: null,
  };
  if (raw.final && typeof raw.final === 'object') {
    const f = raw.final;
    const final = {
      category: str(f.category, 80),
      question: str(f.question, 600),
      answer: str(f.answer, 400),
    } as GameData['final'];
    const image = str(f.image, 500).trim();
    if (final && /^https?:\/\//i.test(image)) final.image = image;
    if (final && (final.category || final.question || final.answer)) game.final = final;
  }
  return game;
}

export function sanitizeVisibility(v: unknown): Visibility {
  return v === 'unlisted' ? 'unlisted' : 'public';
}

export function sanitizeSettings(raw: any): RoomSettings {
  const d = DEFAULT_SETTINGS;
  const num = (v: unknown, min: number, max: number, dflt: number) => {
    const n = Number(v);
    return Number.isFinite(n) ? Math.max(min, Math.min(max, Math.trunc(n))) : dflt;
  };
  return {
    mode: raw?.mode === 'ffa' ? 'ffa' : 'teams',
    teamCount: num(raw?.teamCount, 2, 8, d.teamCount),
    penalizeWrong: raw?.penalizeWrong !== false,
    buzzWindowSec: num(raw?.buzzWindowSec, 3, 60, d.buzzWindowSec),
    answerSec: num(raw?.answerSec, 5, 120, d.answerSec),
    autoArm: !!raw?.autoArm,
    finalAnswerSec: num(raw?.finalAnswerSec, 15, 300, d.finalAnswerSec),
  };
}
