import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { nanoid } from 'nanoid';
import type { GameData, GameMeta, Visibility } from '@buzzr/shared';
import { seedGames } from './seeds.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.BUZZR_DATA_DIR ?? join(__dirname, '..', '..', 'data');
mkdirSync(DATA_DIR, { recursive: true });

const db = new DatabaseSync(join(DATA_DIR, 'buzzr.db'));

db.exec(`
  CREATE TABLE IF NOT EXISTS games (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    tags TEXT NOT NULL DEFAULT '[]',
    visibility TEXT NOT NULL DEFAULT 'public',
    edit_token TEXT NOT NULL,
    plays INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    data TEXT NOT NULL
  );
`);

interface GameRow {
  id: string;
  title: string;
  description: string;
  tags: string;
  visibility: string;
  edit_token: string;
  plays: number;
  created_at: number;
  updated_at: number;
  data: string;
}

function rowToMeta(row: GameRow): GameMeta {
  const data = JSON.parse(row.data) as GameData;
  const r0 = data.rounds[0];
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    tags: JSON.parse(row.tags),
    visibility: row.visibility as Visibility,
    plays: row.plays,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    size: {
      categories: r0?.categories.length ?? 0,
      rows: r0?.values.length ?? 0,
      rounds: data.rounds.length,
      hasFinal: !!data.final,
    },
  };
}

export const games = {
  create(data: GameData, visibility: Visibility): { id: string; editToken: string } {
    const id = nanoid(10);
    const editToken = nanoid(24);
    const now = Date.now();
    db.prepare(
      `INSERT INTO games (id, title, description, tags, visibility, edit_token, plays, created_at, updated_at, data)
       VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?)`,
    ).run(id, data.title, data.description ?? '', JSON.stringify(data.tags ?? []), visibility, editToken, now, now, JSON.stringify(data));
    return { id, editToken };
  },

  get(id: string): { meta: GameMeta; data: GameData } | null {
    const row = db.prepare('SELECT * FROM games WHERE id = ?').get(id) as GameRow | undefined;
    if (!row) return null;
    return { meta: rowToMeta(row), data: JSON.parse(row.data) as GameData };
  },

  checkToken(id: string, token: string): boolean {
    const row = db.prepare('SELECT edit_token FROM games WHERE id = ?').get(id) as { edit_token: string } | undefined;
    return !!row && row.edit_token === token;
  },

  update(id: string, data: GameData, visibility: Visibility): void {
    db.prepare(
      `UPDATE games SET title = ?, description = ?, tags = ?, visibility = ?, updated_at = ?, data = ? WHERE id = ?`,
    ).run(data.title, data.description ?? '', JSON.stringify(data.tags ?? []), visibility, Date.now(), JSON.stringify(data), id);
  },

  delete(id: string): void {
    db.prepare('DELETE FROM games WHERE id = ?').run(id);
  },

  bumpPlays(id: string): void {
    db.prepare('UPDATE games SET plays = plays + 1 WHERE id = ?').run(id);
  },

  search(q: string, limit = 60): GameMeta[] {
    const rows = (q
      ? db
          .prepare(
            `SELECT * FROM games WHERE visibility = 'public' AND (title LIKE ? OR description LIKE ? OR tags LIKE ?)
             ORDER BY plays DESC, updated_at DESC LIMIT ?`,
          )
          .all(`%${q}%`, `%${q}%`, `%${q}%`, limit)
      : db.prepare(`SELECT * FROM games WHERE visibility = 'public' ORDER BY plays DESC, updated_at DESC LIMIT ?`).all(limit)) as unknown as GameRow[];
    return rows.map(rowToMeta);
  },
};

// Seed sample games on first run so browse/host flows work out of the box.
const count = (db.prepare('SELECT COUNT(*) AS n FROM games').get() as { n: number }).n;
if (count === 0) {
  for (const g of seedGames) games.create(g, 'public');
  console.log(`[db] seeded ${seedGames.length} sample games`);
}
