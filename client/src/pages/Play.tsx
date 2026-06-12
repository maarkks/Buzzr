import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  AVATAR_COLORS,
  AVATAR_EMOJI,
  fmtScore,
  randomAvatar,
  type Avatar,
  type MeState,
  type RoomSnapshot,
} from '@buzzr/shared';
import { api, getPlayerId, rememberPlayerId } from '../lib/api';
import { useRoom, type RoomConn } from '../lib/socket';
import { vibrate } from '../lib/sfx';
import { AvatarBubble, ErrorScreen, Logo, TimerRing } from '../components/ui';

interface Profile {
  name: string;
  avatar: Avatar;
}

function loadProfile(): Profile {
  try {
    const p = JSON.parse(localStorage.getItem('buzzr:profile') ?? '');
    if (p?.name != null && p?.avatar) return p;
  } catch { /* first visit */ }
  return { name: '', avatar: randomAvatar() };
}

export default function Play() {
  const { code: codeParam } = useParams();
  const nav = useNavigate();
  const [profile, setProfile] = useState<Profile>(loadProfile);
  const [ready, setReady] = useState(false);
  const code = (codeParam ?? '').toUpperCase();

  const conn = useRoom(
    code,
    'player',
    {
      name: profile.name || 'Player',
      avatar: profile.avatar,
      playerId: getPlayerId(code) ?? undefined,
      onJoined: (pid) => pid && rememberPlayerId(code, pid),
    },
    ready && !!code,
  );

  if (!code) return <JoinCodeForm onSubmit={(c) => nav(`/play/${c}`)} />;
  if (conn.closedReason) return <ErrorScreen title="Game over" message={conn.closedReason} backTo="/" />;
  if (conn.error) return <ErrorScreen title="Couldn't join" message={conn.error} backTo="/" />;

  if (!ready) {
    return (
      <ProfileForm
        code={code}
        profile={profile}
        onChange={(p) => {
          setProfile(p);
          localStorage.setItem('buzzr:profile', JSON.stringify(p));
        }}
        onJoin={() => setReady(true)}
      />
    );
  }

  if (!conn.snap || !conn.me) {
    return (
      <div className="grid min-h-screen place-items-center">
        <div className="animate-pulse text-xl text-ink/60">Joining {code}…</div>
      </div>
    );
  }

  return <PhoneGame snap={conn.snap} me={conn.me} conn={conn} profile={profile} onProfile={(p) => {
    setProfile(p);
    localStorage.setItem('buzzr:profile', JSON.stringify(p));
    conn.emit('player:setAvatar', p.avatar);
  }} />;
}

// ── Join forms ────────────────────────────────────────────────────────────────

function JoinCodeForm({ onSubmit }: { onSubmit: (code: string) => void }) {
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 p-6">
      <Logo />
      <form
        className="card w-full max-w-sm p-6"
        onSubmit={async (e) => {
          e.preventDefault();
          try {
            await api.checkRoom(code);
            onSubmit(code);
          } catch (err) {
            setError((err as Error).message);
          }
        }}
      >
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4))}
          placeholder="CODE"
          className="input mb-4 text-center text-4xl font-black tracking-[.4em]"
          style={{ fontFamily: 'var(--font-money)' }}
          autoFocus
        />
        {error && <div className="mb-3 text-center text-sm text-rose-400">{error}</div>}
        <button className="btn btn-gold w-full py-3 text-lg" disabled={code.length !== 4}>Join game</button>
      </form>
    </div>
  );
}

function ProfileForm({
  code,
  profile,
  onChange,
  onJoin,
}: {
  code: string;
  profile: Profile;
  onChange: (p: Profile) => void;
  onJoin: () => void;
}) {
  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col gap-5 p-6">
      <div className="flex items-center justify-between">
        <Logo size="sm" />
        <span className="money text-2xl tracking-[.2em]">{code}</span>
      </div>
      <div className="flex flex-col items-center gap-3">
        <AvatarBubble avatar={profile.avatar} size={88} ring />
        <input
          value={profile.name}
          onChange={(e) => onChange({ ...profile, name: e.target.value.slice(0, 24) })}
          placeholder="Your name"
          className="input max-w-60 text-center text-xl font-black"
          autoFocus
        />
      </div>
      <div className="card p-4">
        <div className="mb-2 text-xs font-bold uppercase tracking-widest text-ink/50">Pick your look</div>
        <div className="mb-3 grid grid-cols-8 gap-1.5">
          {AVATAR_EMOJI.map((e) => (
            <button
              key={e}
              onClick={() => onChange({ ...profile, avatar: { ...profile.avatar, emoji: e } })}
              className={`grid aspect-square cursor-pointer place-items-center rounded-lg text-xl transition ${profile.avatar.emoji === e ? 'bg-gold/30 ring-2 ring-gold' : 'bg-ink/5 hover:bg-ink/10'}`}
            >
              {e}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-12 gap-1.5">
          {AVATAR_COLORS.map((c) => (
            <button
              key={c}
              onClick={() => onChange({ ...profile, avatar: { ...profile.avatar, color: c } })}
              className={`aspect-square cursor-pointer rounded-full transition ${profile.avatar.color === c ? 'ring-2 ring-ink/70' : 'opacity-70 hover:opacity-100'}`}
              style={{ background: c }}
            />
          ))}
        </div>
      </div>
      <button className="btn btn-gold mt-auto w-full py-4 text-xl" disabled={!profile.name.trim()} onClick={onJoin}>
        I'm ready ▸
      </button>
    </div>
  );
}

// ── In-game phone UI ──────────────────────────────────────────────────────────

function PhoneGame({
  snap,
  me,
  conn,
  profile,
  onProfile,
}: {
  snap: RoomSnapshot;
  me: MeState;
  conn: RoomConn;
  profile: Profile;
  onProfile: (p: Profile) => void;
}) {
  const [showBoard, setShowBoard] = useState(false);
  const myPlayer = snap.players.find((p) => p.id === me.playerId);
  const myTeam = snap.teams.find((t) => t.id === myPlayer?.teamId);
  const myScore = snap.settings.mode === 'teams' ? myTeam?.score ?? 0 : myPlayer?.score ?? 0;

  // Haptics on judge feedback
  const lastFlash = useRef<string | null>(null);
  useEffect(() => {
    if (me.judgeFlash && me.judgeFlash !== lastFlash.current) {
      vibrate(me.judgeFlash === 'correct' ? [60, 40, 60] : [220]);
    }
    lastFlash.current = me.judgeFlash;
  }, [me.judgeFlash]);

  return (
    <div
      className="mx-auto flex h-screen max-w-md flex-col p-4 transition-colors duration-300"
      style={{
        background:
          me.judgeFlash === 'correct'
            ? 'radial-gradient(circle at 50% 30%, rgba(132,204,22,.3), transparent 70%)'
            : me.judgeFlash === 'wrong'
              ? 'radial-gradient(circle at 50% 30%, rgba(244,63,94,.35), transparent 70%)'
              : undefined,
      }}
    >
      {/* Header */}
      <div className="mb-3 flex items-center gap-2">
        <AvatarBubble avatar={profile.avatar} size={36} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-black">{profile.name}</div>
          {myTeam && (
            <div
              className="inline-block max-w-full truncate rounded-full px-2 text-xs font-bold text-deep"
              style={{ background: myTeam.color }}
            >
              {myTeam.name}
            </div>
          )}
        </div>
        <div className={`money text-2xl ${myScore < 0 ? 'text-rose-400' : ''}`}>{fmtScore(myScore)}</div>
        <button className="btn btn-ghost px-3" onClick={() => setShowBoard(true)} title="Leaderboard">🏆</button>
      </div>

      {/* Main area */}
      <div className="flex min-h-0 flex-1 flex-col">
        <MainArea snap={snap} me={me} conn={conn} myTeamColor={myTeam?.color} />
      </div>

      {showBoard && <LeaderboardSheet snap={snap} me={me} onClose={() => setShowBoard(false)} onProfile={onProfile} profile={profile} />}
    </div>
  );
}

function MainArea({ snap, me, conn, myTeamColor }: { snap: RoomSnapshot; me: MeState; conn: RoomConn; myTeamColor?: string }) {
  const clue = snap.clue;

  if (snap.phase === 'lobby') {
    return (
      <Center>
        <div className="mb-2 text-5xl">🎉</div>
        <div className="mb-1 text-xl font-black">You're in!</div>
        <div className="mb-6 text-ink/60">Waiting for the host to start…</div>
        {snap.settings.mode === 'teams' && (
          <>
            <div className="mb-2 text-xs font-bold uppercase tracking-widest text-ink/50">Pick your team</div>
            <div className="flex flex-wrap justify-center gap-2">
              {snap.teams.map((t) => {
                const mine = snap.players.find((p) => p.id === me.playerId)?.teamId === t.id;
                const count = snap.players.filter((p) => p.teamId === t.id).length;
                return (
                  <button
                    key={t.id}
                    onClick={() => conn.emit('player:joinTeam', t.id)}
                    className={`btn cursor-pointer ${mine ? 'ring-2 ring-white' : ''}`}
                    style={mine ? { background: t.color, color: '#0b1120' } : { background: `${t.color}2e`, color: '#f9fafb' }}
                  >
                    {t.name} ({count})
                  </button>
                );
              })}
            </div>
          </>
        )}
      </Center>
    );
  }

  if (snap.phase === 'board') {
    return (
      <Center>
        <div className="mb-2 text-5xl">👀</div>
        <div className="text-xl font-black">Eyes on the board!</div>
        <div className="mt-1 text-ink/60">
          {snap.controlName ? <><b className="text-gold">{snap.controlName}</b> picks the next clue</> : 'The host is picking a clue'}
        </div>
      </Center>
    );
  }

  if (snap.phase === 'clue' && clue) {
    const stage = snap.clueStage!;
    if (stage === 'wager' && me.mustWager) {
      return <WagerPad key="dd" me={me} conn={conn} title="DAILY DOUBLE — your wager" />;
    }
    if (stage === 'wager') {
      return (
        <Center>
          <div className="mb-2 text-5xl">💰</div>
          <div className="text-xl font-black text-gold">DAILY DOUBLE!</div>
          <div className="mt-1 text-ink/60"><b>{clue.ddOwnerName ?? 'Someone'}</b> is wagering…</div>
        </Center>
      );
    }
    if (stage === 'dd-answer') {
      const mine = me.mustWager || (clue.ddOwnerId && snap.players.find((p) => p.id === me.playerId && (p.teamId === clue.ddOwnerId || p.id === clue.ddOwnerId)));
      return (
        <Center>
          <div className="mb-2 text-5xl">{mine ? '🎤' : '🤫'}</div>
          <div className="text-xl font-black">{mine ? 'Answer out loud!' : `${clue.ddOwnerName} is answering…`}</div>
          <div className="money mt-2 text-3xl">${clue.wager?.toLocaleString()}</div>
        </Center>
      );
    }
    // reading / armed / buzzed / resolved → buzzer surface
    return <BuzzerSurface snap={snap} me={me} conn={conn} myTeamColor={myTeamColor} />;
  }

  if (snap.phase === 'final-wager') {
    return me.mustWager ? (
      <WagerPad key="final" me={me} conn={conn} title={`FINAL: ${snap.final?.category ?? ''}`} allowZero />
    ) : (
      <Center>
        <div className="text-xl font-black">Final Round</div>
        <div className="mt-1 text-ink/60">Waiting for wagers…</div>
      </Center>
    );
  }

  if (snap.phase === 'final-answer') {
    return <FinalAnswerPad snap={snap} me={me} conn={conn} />;
  }

  if (snap.phase === 'final-reveal') {
    return (
      <Center>
        <div className="mb-2 text-5xl">🥁</div>
        <div className="text-xl font-black">The reveals…</div>
        <div className="mt-1 text-center text-ink/60">Watch the board — answers are being revealed one by one.</div>
      </Center>
    );
  }

  if (snap.phase === 'ended') {
    return <FinalStandings snap={snap} me={me} />;
  }

  return null;
}

function BuzzerSurface({ snap, me, conn, myTeamColor }: { snap: RoomSnapshot; me: MeState; conn: RoomConn; myTeamColor?: string }) {
  const stage = snap.clueStage!;
  const clue = snap.clue!;
  const armed = stage === 'armed' && me.canBuzz;

  let label = '';
  let sub = '';
  if (stage === 'reading') {
    label = 'GET READY…';
    sub = 'Buzzers arm when the host finishes reading';
  } else if (stage === 'armed') {
    label = me.lockedOut ? 'LOCKED OUT' : 'BUZZ!';
    sub = me.lockedOut ? 'Your side already tried this one' : '';
  } else if (stage === 'buzzed') {
    label = me.hasFloor ? 'YOU GOT IT!' : `${snap.buzzWinner?.name ?? 'Someone'} has it`;
    sub = me.hasFloor ? 'Answer out loud 🎤' : 'Stand by — they might miss…';
  } else if (stage === 'resolved') {
    label = '';
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="mb-3 rounded-xl bg-ink/5 p-3 text-center">
        <div className="text-xs font-bold uppercase tracking-widest text-ink/50">
          {clue.category} · <span className="money text-base">${clue.value}</span>
        </div>
        <div className="mt-1 line-clamp-3 text-sm font-bold leading-snug">{clue.question}</div>
        {snap.revealedAnswer && <div className="mt-2 rounded bg-gold/15 px-2 py-1 text-sm font-black text-gold">{snap.revealedAnswer}</div>}
      </div>

      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4">
        {snap.timer && stage !== 'resolved' && <TimerRing timer={snap.timer} size={56} />}
        {stage !== 'resolved' ? (
          <>
            <button
              disabled={!armed}
              onPointerDown={() => {
                if (armed) {
                  conn.emit('player:buzz');
                  vibrate(30);
                }
              }}
              className={`grid aspect-square w-[min(62vw,260px)] cursor-pointer select-none place-items-center rounded-full text-3xl font-black transition active:scale-95 ${
                armed
                  ? 'anim-buzzer bg-gradient-to-b from-cyan-300 to-cyan-500 text-deep'
                  : me.hasFloor
                    ? 'bg-gradient-to-b from-lime-300 to-lime-500 text-deep'
                    : 'bg-ink/10 text-ink/50'
              }`}
              style={me.hasFloor && myTeamColor ? { boxShadow: `0 0 60px ${myTeamColor}` } : undefined}
            >
              {label}
            </button>
            {sub && <div className="px-6 text-center text-sm text-ink/50">{sub}</div>}
          </>
        ) : (
          <div className="text-center">
            <div className="mb-2 text-4xl">📋</div>
            <div className="text-ink/60">Next clue coming up…</div>
          </div>
        )}
      </div>
    </div>
  );
}

function WagerPad({ me, conn, title, allowZero }: { me: MeState; conn: RoomConn; title: string; allowZero?: boolean }) {
  const [value, setValue] = useState<number>(me.wagerSubmitted ?? me.wagerMin);
  const max = me.wagerMax;
  const min = allowZero ? 0 : me.wagerMin;
  const submitted = me.wagerSubmitted;
  return (
    <Center>
      <div className="mb-1 text-xs font-bold uppercase tracking-widest text-gold">{title}</div>
      <div className="money mb-4 text-6xl">${value.toLocaleString()}</div>
      <input
        type="range"
        min={min}
        max={Math.max(min, max)}
        step={Math.max(1, Math.min(100, Math.round(max / 100) || 1))}
        value={value}
        onChange={(e) => setValue(Number(e.target.value))}
        className="mb-4 w-full accent-[#fbbf24]"
      />
      <div className="mb-5 flex flex-wrap justify-center gap-2">
        <button className="btn btn-ghost" onClick={() => setValue(min)}>Min</button>
        <button className="btn btn-ghost" onClick={() => setValue(Math.floor(max / 2))}>Half</button>
        <button className="btn btn-ghost" onClick={() => setValue(max)}>All in ({fmtScore(max)})</button>
      </div>
      <button
        className="btn btn-gold w-full max-w-60 py-3 text-lg"
        onClick={() => {
          conn.emit('player:wager', value);
          vibrate(30);
        }}
      >
        {submitted !== null ? `Update wager (now $${submitted.toLocaleString()})` : 'Lock it in'}
      </button>
      {submitted !== null && <div className="mt-2 text-sm text-emerald-400">✓ Wager submitted</div>}
    </Center>
  );
}

function FinalAnswerPad({ snap, me, conn }: { snap: RoomSnapshot; me: MeState; conn: RoomConn }) {
  const [text, setText] = useState(me.answerSubmitted ?? '');
  const submitted = me.answerSubmitted;
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="rounded-xl bg-ink/5 p-3 text-center">
        <div className="text-xs font-bold uppercase tracking-widest text-gold">{snap.final?.category}</div>
        <div className="mt-1 text-sm font-bold leading-snug">{snap.final?.question}</div>
      </div>
      <div className="flex items-center justify-center">{snap.timer && <TimerRing timer={snap.timer} size={64} />}</div>
      {me.mustAnswer ? (
        <>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, 200))}
            rows={3}
            placeholder="What is…?"
            className="input resize-none text-lg"
            autoFocus
          />
          <button
            className="btn btn-gold w-full py-3 text-lg"
            disabled={!text.trim()}
            onClick={() => {
              conn.emit('player:finalAnswer', text.trim());
              vibrate(30);
            }}
          >
            {submitted ? 'Update answer' : 'Submit answer'}
          </button>
          {submitted && <div className="text-center text-sm text-emerald-400">✓ Submitted: “{submitted}”</div>}
        </>
      ) : (
        <Center>
          <div className="text-ink/60">Answers are closed.</div>
        </Center>
      )}
    </div>
  );
}

function FinalStandings({ snap, me }: { snap: RoomSnapshot; me: MeState }) {
  const podium = snap.podium ?? [];
  const myPlayer = snap.players.find((p) => p.id === me.playerId);
  const myName = snap.settings.mode === 'teams' ? snap.teams.find((t) => t.id === myPlayer?.teamId)?.name : myPlayer?.name;
  const myRank = podium.findIndex((p) => p.name === myName);
  return (
    <Center>
      <div className="mb-2 text-5xl">{myRank === 0 ? '👑' : '🏁'}</div>
      <div className="mb-1 text-2xl font-black">{myRank === 0 ? 'CHAMPIONS!' : "That's the game!"}</div>
      {myRank >= 0 && <div className="mb-4 text-ink/60">You finished <b className="text-gold">#{myRank + 1}</b></div>}
      <div className="w-full max-w-xs space-y-1.5">
        {podium.slice(0, 5).map((p, i) => (
          <div key={i} className={`flex items-center gap-2 rounded-lg px-3 py-1.5 ${p.name === myName ? 'bg-gold/15 ring-1 ring-gold' : 'bg-ink/5'}`}>
            <span className="w-6 font-black">{i + 1}</span>
            <span className="flex-1 truncate text-left font-bold">{p.name}</span>
            <span className="money">{fmtScore(p.score)}</span>
          </div>
        ))}
      </div>
    </Center>
  );
}

function LeaderboardSheet({
  snap,
  me,
  onClose,
  profile,
  onProfile,
}: {
  snap: RoomSnapshot;
  me: MeState;
  onClose: () => void;
  profile: Profile;
  onProfile: (p: Profile) => void;
}) {
  const isTeams = snap.settings.mode === 'teams';
  const rows = isTeams
    ? [...snap.teams].sort((a, b) => b.score - a.score).map((t) => ({ id: t.id, name: t.name, score: t.score, color: t.color, avatar: null as Avatar | null }))
    : [...snap.players].sort((a, b) => b.score - a.score).map((p) => ({ id: p.id, name: p.name, score: p.score, color: p.avatar.color, avatar: p.avatar as Avatar | null }));
  return (
    <div className="fixed inset-0 z-40 flex flex-col justify-end bg-black/60" onClick={onClose}>
      <div className="anim-pop max-h-[80vh] overflow-y-auto rounded-t-3xl bg-stage-2 p-5" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-lg font-black">🏆 Leaderboard</h3>
          <button className="btn btn-ghost px-3" onClick={onClose}>✕</button>
        </div>
        <div className="mb-5 space-y-1.5">
          {rows.map((r, i) => (
            <div key={r.id} className="flex items-center gap-2 rounded-lg bg-ink/5 px-3 py-2">
              <span className="w-6 font-black text-ink/50">{i + 1}</span>
              {r.avatar ? <AvatarBubble avatar={r.avatar} size={28} /> : <span className="h-4 w-4 rounded-full" style={{ background: r.color }} />}
              <span className="flex-1 truncate font-bold">{r.name}</span>
              <span className={`money ${r.score < 0 ? 'text-rose-400' : ''}`}>{fmtScore(r.score)}</span>
            </div>
          ))}
        </div>
        {isTeams && snap.players.length > 0 && (
          <div className="mb-5">
            <div className="mb-1 text-xs font-bold uppercase text-ink/50">Players</div>
            <div className="flex flex-wrap gap-1.5">
              {snap.players.map((p) => (
                <span key={p.id} className={`inline-flex items-center gap-1 rounded-full bg-ink/10 py-0.5 pl-0.5 pr-2 text-xs ${p.id === me.playerId ? 'ring-1 ring-gold' : ''}`}>
                  <AvatarBubble avatar={p.avatar} size={18} />
                  {p.name}
                </span>
              ))}
            </div>
          </div>
        )}
        {/* Quick avatar restyle mid-game */}
        <div>
          <div className="mb-1 text-xs font-bold uppercase text-ink/50">Change your look</div>
          <div className="flex flex-wrap gap-1">
            {AVATAR_EMOJI.slice(0, 12).map((e) => (
              <button
                key={e}
                onClick={() => onProfile({ ...profile, avatar: { ...profile.avatar, emoji: e } })}
                className={`grid h-8 w-8 place-items-center rounded-lg ${profile.avatar.emoji === e ? 'bg-gold/30 ring-1 ring-gold' : 'bg-ink/5'}`}
              >
                {e}
              </button>
            ))}
            {AVATAR_COLORS.slice(0, 8).map((c) => (
              <button
                key={c}
                onClick={() => onProfile({ ...profile, avatar: { ...profile.avatar, color: c } })}
                className={`h-8 w-8 rounded-full ${profile.avatar.color === c ? 'ring-2 ring-ink/70' : 'opacity-70'}`}
                style={{ background: c }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function Center({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-0 flex-1 flex-col items-center justify-center p-4 text-center">{children}</div>;
}
