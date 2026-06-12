import type { GameData, GameMeta, RoomSettings, Visibility } from '@buzzr/shared';

async function req<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    ...init,
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((body as { error?: string }).error ?? `Request failed (${res.status})`);
  return body as T;
}

export const api = {
  listGames: (q = '') => req<{ games: GameMeta[] }>(`/api/games?q=${encodeURIComponent(q)}`),
  getGame: (id: string) => req<{ meta: GameMeta; data: GameData }>(`/api/games/${id}`),
  createGame: (data: GameData, visibility: Visibility = 'public') =>
    req<{ id: string; editToken: string }>('/api/games', { method: 'POST', body: JSON.stringify({ data, visibility }) }),
  updateGame: (id: string, token: string, data: GameData, visibility: Visibility) =>
    req<{ ok: true }>(`/api/games/${id}`, {
      method: 'PUT',
      headers: { 'x-edit-token': token },
      body: JSON.stringify({ data, visibility }),
    }),
  deleteGame: (id: string, token: string) =>
    req<{ ok: true }>(`/api/games/${id}`, { method: 'DELETE', headers: { 'x-edit-token': token } }),
  cloneGame: (id: string) => req<{ id: string; editToken: string }>(`/api/games/${id}/clone`, { method: 'POST' }),
  createRoom: (gameId: string, settings: Partial<RoomSettings>) =>
    req<{ code: string; hostToken: string }>('/api/rooms', { method: 'POST', body: JSON.stringify({ gameId, settings }) }),
  checkRoom: (code: string) =>
    req<{ ok: boolean; phase: string; mode: string; locked: boolean; gameTitle: string }>(`/api/rooms/${code}`),
};

// ── Local persistence (no accounts — the browser is your library) ───────────

export interface MyGame {
  id: string;
  editToken: string;
  title: string;
  savedAt: number;
}

const MY_GAMES_KEY = 'buzzr:myGames';

export function getMyGames(): MyGame[] {
  try {
    return JSON.parse(localStorage.getItem(MY_GAMES_KEY) ?? '[]');
  } catch {
    return [];
  }
}

export function rememberGame(g: MyGame) {
  const list = getMyGames().filter((x) => x.id !== g.id);
  list.unshift(g);
  localStorage.setItem(MY_GAMES_KEY, JSON.stringify(list.slice(0, 100)));
}

export function forgetGame(id: string) {
  localStorage.setItem(MY_GAMES_KEY, JSON.stringify(getMyGames().filter((x) => x.id !== id)));
}

export function getEditToken(id: string): string | null {
  // URL ?token= wins (shareable edit links), then local library.
  const fromUrl = new URLSearchParams(location.search).get('token');
  if (fromUrl) return fromUrl;
  return getMyGames().find((g) => g.id === id)?.editToken ?? null;
}

export function rememberHostToken(code: string, token: string) {
  sessionStorage.setItem(`buzzr:host:${code}`, token);
}

export function getHostToken(code: string): string | null {
  return sessionStorage.getItem(`buzzr:host:${code}`);
}

export function rememberPlayerId(code: string, playerId: string) {
  localStorage.setItem(`buzzr:player:${code}`, playerId);
}

export function getPlayerId(code: string): string | null {
  return localStorage.getItem(`buzzr:player:${code}`);
}
