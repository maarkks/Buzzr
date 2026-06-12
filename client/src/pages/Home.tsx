import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { emptyGame } from '@buzzr/shared';
import { api, rememberGame } from '../lib/api';
import { Logo } from '../components/ui';

export default function Home() {
  const nav = useNavigate();
  const [code, setCode] = useState('');
  const [joinError, setJoinError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function joinRoom(e: React.FormEvent) {
    e.preventDefault();
    const c = code.trim().toUpperCase();
    if (c.length !== 4) return setJoinError('Codes are 4 letters.');
    setBusy(true);
    try {
      await api.checkRoom(c);
      nav(`/play/${c}`);
    } catch (err) {
      setJoinError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function createGame() {
    setBusy(true);
    try {
      const { id, editToken } = await api.createGame(emptyGame('My New Game'), 'public');
      rememberGame({ id, editToken, title: 'My New Game', savedAt: Date.now() });
      nav(`/edit/${id}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center px-6 py-14">
      <div className="anim-pop mb-3 mt-8">
        <Logo size="lg" />
      </div>
      <p className="mb-12 max-w-xl text-center text-lg text-white/70">
        Build a Jeopardy-style game in minutes. Host it live — every phone becomes a buzzer.
      </p>

      {/* Join a game */}
      <form onSubmit={joinRoom} className="card anim-pop mb-10 w-full max-w-md p-6">
        <div className="mb-3 text-center text-sm font-bold uppercase tracking-widest text-white/50">
          Joining a game?
        </div>
        <div className="flex gap-3">
          <input
            value={code}
            onChange={(e) => {
              setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4));
              setJoinError(null);
            }}
            placeholder="CODE"
            autoCapitalize="characters"
            autoComplete="off"
            className="input text-center text-3xl font-black tracking-[.4em]"
            style={{ fontFamily: 'var(--font-money)' }}
          />
          <button className="btn btn-gold px-7 text-lg" disabled={busy || code.length !== 4}>
            Join
          </button>
        </div>
        {joinError && <div className="mt-3 text-center text-sm text-rose-400">{joinError}</div>}
      </form>

      {/* Create / browse */}
      <div className="grid w-full max-w-3xl gap-5 md:grid-cols-2">
        <button onClick={createGame} disabled={busy} className="card group cursor-pointer p-7 text-left transition hover:border-gold/50 hover:bg-white/10">
          <div className="mb-2 text-3xl">🛠️</div>
          <div className="mb-1 text-xl font-black group-hover:text-gold">Create a game</div>
          <div className="text-sm text-white/60">
            No account needed. Categories, point values, Daily Doubles, a Final round — yours in minutes.
          </div>
        </button>
        <Link to="/browse" className="card group p-7 transition hover:border-gold/50 hover:bg-white/10">
          <div className="mb-2 text-3xl">📚</div>
          <div className="mb-1 text-xl font-black group-hover:text-gold">Browse games</div>
          <div className="text-sm text-white/60">
            Host a ready-made board, or clone one and make it your own.
          </div>
        </Link>
      </div>

      {/* How it works */}
      <div className="mt-16 grid w-full max-w-3xl gap-4 text-center text-sm text-white/50 md:grid-cols-3">
        <div><span className="font-black text-gold">1.</span> Build or pick a board</div>
        <div><span className="font-black text-gold">2.</span> Put it on the big screen — players scan the QR</div>
        <div><span className="font-black text-gold">3.</span> Phones become buzzers — scores keep themselves</div>
      </div>

      <div className="mt-auto pt-16 text-xs text-white/30">
        Buzzr — teams & free-for-all · phone buzzers · automatic scoring · host dashboard
      </div>
    </div>
  );
}
