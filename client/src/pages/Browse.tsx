import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { GameMeta } from '@buzzr/shared';
import { api, forgetGame, getMyGames, rememberGame, type MyGame } from '../lib/api';
import { HomeLink } from '../components/ui';

export default function Browse() {
  const nav = useNavigate();
  const [q, setQ] = useState('');
  const [results, setResults] = useState<GameMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [myGames, setMyGames] = useState<MyGame[]>(getMyGames());

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const { games } = await api.listGames(q);
        if (!cancelled) setResults(games);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [q]);

  async function clone(id: string) {
    const res = await api.cloneGame(id);
    const g = await api.getGame(res.id);
    rememberGame({ id: res.id, editToken: res.editToken, title: g.data.title, savedAt: Date.now() });
    nav(`/edit/${res.id}`);
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <div className="mb-8 flex items-center justify-between">
        <HomeLink />
        <Link to="/" className="btn btn-ghost">Home</Link>
      </div>

      {myGames.length > 0 && (
        <section className="mb-10">
          <h2 className="mb-3 text-lg font-black uppercase tracking-widest text-ink/60">My games</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {myGames.map((g) => (
              <div key={g.id} className="card flex flex-col p-4">
                <div className="mb-1 font-black">{g.title}</div>
                <div className="mb-3 text-xs text-ink/50">saved {new Date(g.savedAt).toLocaleDateString()}</div>
                <div className="mt-auto flex gap-2">
                  <Link to={`/edit/${g.id}`} className="btn btn-ghost flex-1">Edit</Link>
                  <Link to={`/host-setup/${g.id}`} className="btn btn-gold flex-1">Host</Link>
                  <button
                    className="btn btn-ghost"
                    title="Remove from this browser"
                    onClick={() => {
                      forgetGame(g.id);
                      setMyGames(getMyGames());
                    }}
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section>
        <div className="mb-4 flex items-center gap-4">
          <h2 className="text-lg font-black uppercase tracking-widest text-ink/60">Public games</h2>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search topics, titles, tags…"
            className="input max-w-sm"
          />
        </div>
        {loading ? (
          <div className="py-16 text-center text-ink/50">Searching…</div>
        ) : results.length === 0 ? (
          <div className="py-16 text-center text-ink/50">No games found — be the first to make one!</div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {results.map((g) => (
              <div key={g.id} className="card flex flex-col p-4">
                <div className="mb-1 font-black">{g.title}</div>
                <div className="mb-2 line-clamp-2 min-h-8 text-sm text-ink/60">{g.description || 'No description'}</div>
                <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-ink/50">
                  <span className="money">{g.size.categories}×{g.size.rows}</span>
                  {g.size.rounds > 1 && <span>· {g.size.rounds} rounds</span>}
                  {g.size.hasFinal && <span>· Final</span>}
                  <span>· {g.plays} plays</span>
                  {g.tags.slice(0, 3).map((t) => (
                    <span key={t} className="rounded-full bg-ink/10 px-2 py-0.5">{t}</span>
                  ))}
                </div>
                <div className="mt-auto flex gap-2">
                  <button onClick={() => clone(g.id)} className="btn btn-ghost flex-1">Clone & edit</button>
                  <Link to={`/host-setup/${g.id}`} className="btn btn-gold flex-1">Host</Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
