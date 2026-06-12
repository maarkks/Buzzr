import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { DEFAULT_SETTINGS, type GameData, type RoomSettings } from '@buzzr/shared';
import { api, rememberHostToken } from '../lib/api';
import { ErrorScreen, HomeLink, Spinner } from '../components/ui';

export default function HostSetup() {
  const { gameId = '' } = useParams();
  const nav = useNavigate();
  const [game, setGame] = useState<GameData | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [settings, setSettings] = useState<RoomSettings>({ ...DEFAULT_SETTINGS });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.getGame(gameId).then((g) => setGame(g.data)).catch(() => setNotFound(true));
  }, [gameId]);

  if (notFound) return <ErrorScreen title="Game not found" message="This game may have been deleted." />;
  if (!game) return <Spinner label="Loading game…" />;

  const set = <K extends keyof RoomSettings>(k: K, v: RoomSettings[K]) => setSettings((s) => ({ ...s, [k]: v }));

  async function start() {
    setBusy(true);
    try {
      const { code, hostToken } = await api.createRoom(gameId, settings);
      rememberHostToken(code, hostToken);
      nav(`/board/${code}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-8">
      <div className="mb-8 flex items-center justify-between">
        <HomeLink />
        <Link to="/browse" className="btn btn-ghost">Browse</Link>
      </div>

      <h1 className="mb-1 text-3xl font-black">Host “{game.title}”</h1>
      <p className="mb-8 text-ink/60">
        {game.rounds.length} round{game.rounds.length > 1 ? 's' : ''}
        {game.final ? ' + Final' : ''} · players join with a 4-letter code from their phones.
      </p>

      <div className="card mb-6 p-6">
        <div className="mb-3 text-xs font-bold uppercase tracking-widest text-ink/50">Game mode</div>
        <div className="mb-6 grid grid-cols-2 gap-3">
          <button
            onClick={() => set('mode', 'teams')}
            className={`card cursor-pointer p-4 text-left transition ${settings.mode === 'teams' ? 'border-gold bg-gold/10' : 'hover:bg-ink/10'}`}
          >
            <div className="text-2xl">👥</div>
            <div className="font-black">Teams</div>
            <div className="text-xs text-ink/60">Shared team scores · a wrong answer locks out the whole team</div>
          </button>
          <button
            onClick={() => set('mode', 'ffa')}
            className={`card cursor-pointer p-4 text-left transition ${settings.mode === 'ffa' ? 'border-gold bg-gold/10' : 'hover:bg-ink/10'}`}
          >
            <div className="text-2xl">⚡</div>
            <div className="font-black">Free-for-all</div>
            <div className="text-xs text-ink/60">Every player for themselves · individual scores and lockouts</div>
          </button>
        </div>

        {settings.mode === 'teams' && (
          <NumberRow label="Number of teams" value={settings.teamCount} min={2} max={8} onChange={(v) => set('teamCount', v)} />
        )}
        <NumberRow label="Buzz window (seconds)" value={settings.buzzWindowSec} min={3} max={60} onChange={(v) => set('buzzWindowSec', v)} />
        <NumberRow label="Answer time (seconds)" value={settings.answerSec} min={5} max={120} onChange={(v) => set('answerSec', v)} />
        <NumberRow label="Final answer time (seconds)" value={settings.finalAnswerSec} min={15} max={300} onChange={(v) => set('finalAnswerSec', v)} />

        <ToggleRow
          label="Wrong answers lose points"
          hint="Classic rules: a missed buzz-in deducts the clue value"
          checked={settings.penalizeWrong}
          onChange={(v) => set('penalizeWrong', v)}
        />
        <ToggleRow
          label="Auto-arm buzzers"
          hint="Buzzers go live the moment a clue opens (skip the host's Arm click)"
          checked={settings.autoArm}
          onChange={(v) => set('autoArm', v)}
        />
      </div>

      <button onClick={start} disabled={busy} className="btn btn-gold w-full py-4 text-xl">
        {busy ? 'Creating room…' : 'Create room ▸'}
      </button>
      <p className="mt-3 text-center text-xs text-ink/50">
        You'll land on the big-screen board — share or project it, players scan the QR code to join,
        and you run the whole game right from that screen. A separate dashboard is one click away for
        roster &amp; score management.
      </p>
    </div>
  );
}

function NumberRow({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (v: number) => void }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-4">
      <span className="text-sm font-bold">{label}</span>
      <div className="flex items-center gap-2">
        <button className="btn btn-ghost px-3" onClick={() => onChange(Math.max(min, value - 1))}>−</button>
        <span className="money w-10 text-center text-xl">{value}</span>
        <button className="btn btn-ghost px-3" onClick={() => onChange(Math.min(max, value + 1))}>+</button>
      </div>
    </div>
  );
}

function ToggleRow({ label, hint, checked, onChange }: { label: string; hint: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="mb-4 flex cursor-pointer items-center justify-between gap-4">
      <span>
        <span className="block text-sm font-bold">{label}</span>
        <span className="block text-xs text-ink/50">{hint}</span>
      </span>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-6 w-6 accent-[#fbbf24]" />
    </label>
  );
}
