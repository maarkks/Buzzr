import { useParams } from 'react-router-dom';
import { fmtScore, type RoomSnapshot } from '@buzzr/shared';
import { useRoom } from '../lib/socket';
import { AvatarBubble, Confetti, ErrorScreen, FlashBanner, Logo, Spinner, TimerRing } from '../components/ui';

export default function Board() {
  const { code = '' } = useParams();
  const conn = useRoom(code, 'board', { sounds: true });

  if (conn.closedReason) return <ErrorScreen title="Room closed" message={conn.closedReason} />;
  if (conn.error) return <ErrorScreen title="Room not found" message={conn.error} />;
  if (!conn.snap) return <Spinner label="Connecting to the board…" />;

  const snap = conn.snap;
  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <FlashBanner flash={snap.flash} />
      <div className="min-h-0 flex-1">
        {snap.phase === 'lobby' && <LobbyScreen snap={snap} />}
        {snap.phase === 'board' && <BoardScreen snap={snap} />}
        {snap.phase === 'clue' && <ClueScreen snap={snap} />}
        {snap.phase.startsWith('final') && <FinalScreen snap={snap} />}
        {snap.phase === 'ended' && <PodiumScreen snap={snap} />}
      </div>
      {snap.phase !== 'lobby' && snap.phase !== 'ended' && <ScoreStrip snap={snap} />}
    </div>
  );
}

function LobbyScreen({ snap }: { snap: RoomSnapshot }) {
  const joinHost = location.host;
  return (
    <div className="flex h-full flex-col items-center justify-center gap-6 p-8">
      <Logo size="lg" />
      <div className="text-2xl text-white/70">{snap.gameTitle}</div>
      <div className="card flex flex-col items-center gap-2 px-12 py-8">
        <div className="text-sm font-bold uppercase tracking-widest text-white/50">Join on your phone</div>
        <div className="text-xl text-white/80">
          {joinHost}<span className="text-gold">/play</span>
        </div>
        <div className="money anim-marquee mt-2 text-8xl tracking-[.3em]">{snap.code}</div>
        {snap.locked && <div className="mt-2 font-bold text-rose-400">🔒 Room locked</div>}
      </div>
      {snap.settings.mode === 'teams' ? (
        <div className="flex max-w-6xl flex-wrap justify-center gap-4">
          {snap.teams.map((t) => (
            <div key={t.id} className="card min-w-52 p-4" style={{ borderTop: `4px solid ${t.color}` }}>
              <div className="mb-2 text-center font-black">{t.name}</div>
              <div className="flex flex-wrap justify-center gap-2">
                {snap.players.filter((p) => p.teamId === t.id).map((p) => (
                  <PlayerChip key={p.id} name={p.name} avatar={p.avatar} />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex max-w-5xl flex-wrap justify-center gap-3">
          {snap.players.map((p) => (
            <PlayerChip key={p.id} name={p.name} avatar={p.avatar} />
          ))}
        </div>
      )}
      <div className="text-white/40">{snap.players.length} player{snap.players.length === 1 ? '' : 's'} in</div>
    </div>
  );
}

function PlayerChip({ name, avatar }: { name: string; avatar: { emoji: string; color: string } }) {
  return (
    <span className="anim-pop inline-flex items-center gap-2 rounded-full bg-white/10 py-1 pl-1 pr-3">
      <AvatarBubble avatar={avatar} size={28} />
      <span className="text-sm font-bold">{name}</span>
    </span>
  );
}

function BoardScreen({ snap }: { snap: RoomSnapshot }) {
  return (
    <div className="flex h-full flex-col gap-1.5 p-3">
      <div className="flex items-center justify-between px-1">
        <div className="text-sm font-bold uppercase tracking-widest text-white/40">{snap.roundName}</div>
        <div className="text-sm text-white/40">
          Control: <b className="text-gold">{snap.controlName ?? '—'}</b>
        </div>
      </div>
      <div
        className="grid min-h-0 flex-1 gap-1.5"
        style={{
          gridTemplateColumns: `repeat(${snap.categories.length}, minmax(0,1fr))`,
          gridTemplateRows: `minmax(0, 0.9fr) repeat(${snap.values.length}, minmax(0,1fr))`,
        }}
      >
        {snap.categories.map((c, ci) => (
          <div key={ci} className="cat-cell anim-cell-in flex items-center justify-center rounded-lg p-2 text-center font-black uppercase leading-tight [font-size:clamp(11px,1.4vw,22px)]">
            {c}
          </div>
        ))}
        {snap.values.map((v, ri) =>
          snap.categories.map((_, ci) => {
            const used = snap.used[ci]?.[ri];
            return (
              <div
                key={`${ci}-${ri}`}
                className={`${used ? 'board-cell-used' : 'board-cell'} anim-cell-in money flex items-center justify-center rounded-lg [font-size:clamp(18px,3.2vw,52px)]`}
                style={{ animationDelay: `${(ri * snap.categories.length + ci) * 0.03}s` }}
              >
                {used ? '' : `$${v}`}
              </div>
            );
          }),
        )}
      </div>
    </div>
  );
}

function ClueScreen({ snap }: { snap: RoomSnapshot }) {
  const clue = snap.clue!;
  const stage = snap.clueStage!;

  // Daily double splash while wagering
  if (stage === 'wager') {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-6 bg-gradient-to-br from-cell to-cell-2">
        <div className="anim-dd money text-center text-7xl md:text-9xl">DAILY<br />DOUBLE!</div>
        <div className="text-2xl text-white/80">
          <b className="text-gold">{clue.ddOwnerName ?? 'The team in control'}</b> is wagering…
        </div>
        <div className="text-white/50">{clue.category} · ${clue.value}</div>
      </div>
    );
  }

  return (
    <div className="anim-clue flex h-full flex-col bg-gradient-to-br from-cell to-cell-2 p-6">
      <div className="flex items-center justify-between">
        <div className="text-lg font-black uppercase tracking-widest text-white/70">
          {clue.category} — <span className="money text-2xl">${clue.isDailyDouble ? (clue.wager ?? clue.value).toLocaleString() : clue.value}</span>
          {clue.isDailyDouble && <span className="ml-3 rounded bg-gold px-2 py-0.5 text-sm text-black">DAILY DOUBLE</span>}
        </div>
        {snap.timer && <TimerRing timer={snap.timer} size={72} />}
      </div>

      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-6 text-center">
        {clue.image && <img src={clue.image} alt="" className="max-h-[35vh] rounded-xl shadow-2xl" />}
        <div className="max-w-5xl font-black uppercase leading-tight [font-size:clamp(22px,4vw,56px)] [text-shadow:0_3px_0_rgba(0,0,0,.5)]">
          {clue.question || '—'}
        </div>
        {snap.revealedAnswer && (
          <div className="anim-pop max-w-4xl rounded-xl bg-gold px-8 py-4 font-black text-black [font-size:clamp(18px,2.6vw,40px)]">
            {snap.revealedAnswer}
          </div>
        )}
      </div>

      {/* Status line */}
      <div className="flex min-h-20 items-center justify-center">
        {stage === 'reading' && <div className="text-xl text-white/50">Get ready…</div>}
        {stage === 'armed' && (
          <div className="anim-armed rounded-full bg-gold px-10 py-3 text-2xl font-black text-black">BUZZ NOW!</div>
        )}
        {stage === 'buzzed' && snap.buzzWinner && (
          <div className="anim-pop flex items-center gap-4 rounded-full bg-white/10 py-2 pl-2 pr-8">
            <AvatarBubble avatar={snap.buzzWinner.avatar} size={56} ring />
            <div className="text-left">
              <div className="text-2xl font-black">{snap.buzzWinner.name}</div>
              <div className="text-sm text-white/60">
                {snap.buzzWinner.teamName ? `${snap.buzzWinner.teamName} · ` : ''}
                {(snap.buzzWinner.reactionMs / 1000).toFixed(2)}s
              </div>
            </div>
          </div>
        )}
        {stage === 'dd-answer' && (
          <div className="text-xl text-white/70">
            <b className="text-gold">{clue.ddOwnerName}</b> wagered <span className="money text-3xl">${clue.wager?.toLocaleString()}</span>
          </div>
        )}
      </div>
    </div>
  );
}

function FinalScreen({ snap }: { snap: RoomSnapshot }) {
  const f = snap.final!;
  return (
    <div className="flex h-full flex-col items-center justify-center gap-8 bg-gradient-to-br from-cell to-cell-2 p-8">
      <div className="money text-5xl md:text-6xl">FINAL ROUND</div>
      <div className="rounded-xl bg-black/30 px-10 py-4 text-3xl font-black uppercase tracking-widest">{f.category || '—'}</div>

      {snap.phase === 'final-wager' && (
        <div className="text-center">
          <div className="mb-2 text-2xl text-white/80">Place your wagers on your phones…</div>
          <div className="money text-5xl">{f.wagersIn} / {f.wagersExpected}</div>
        </div>
      )}

      {snap.phase === 'final-answer' && (
        <>
          <div className="max-w-5xl text-center font-black uppercase leading-tight [font-size:clamp(20px,3.4vw,46px)]">
            {f.question}
          </div>
          <div className="flex items-center gap-6">
            {snap.timer && <TimerRing timer={snap.timer} size={88} />}
            <div className="text-xl text-white/70">
              Answers in: <span className="money text-3xl">{f.answersIn}/{f.wagersExpected}</span>
            </div>
          </div>
        </>
      )}

      {snap.phase === 'final-reveal' && (
        <div className="w-full max-w-3xl space-y-3">
          <div className="mb-4 text-center text-lg text-white/60">{f.question}</div>
          {f.reveals.map((r) => (
            <div key={r.entityId} className="anim-pop flex items-center gap-4 rounded-xl bg-white/10 p-4">
              {r.avatar ? (
                <AvatarBubble avatar={r.avatar} size={44} />
              ) : (
                <span className="h-6 w-6 rounded-full" style={{ background: r.color ?? '#888' }} />
              )}
              <div className="flex-1">
                <div className="font-black">{r.name}</div>
                <div className="text-xl italic">“{r.answer || '(no answer)'}”</div>
              </div>
              {r.judged && (
                <div className="text-right">
                  <div className={`text-2xl font-black ${r.judged === 'correct' ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {r.judged === 'correct' ? '✓' : '✗'} ${ (r.wager ?? 0).toLocaleString() }
                  </div>
                  <div className="money text-lg">{fmtScore(r.scoreAfter)}</div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PodiumScreen({ snap }: { snap: RoomSnapshot }) {
  const podium = snap.podium ?? [];
  const medals = ['🥇', '🥈', '🥉'];
  return (
    <div className="relative flex h-full flex-col items-center justify-center gap-8 p-8">
      <Confetti />
      <div className="money text-6xl">THAT'S THE GAME!</div>
      {podium[0] && (
        <div className="anim-pop text-center">
          <div className="text-4xl">👑</div>
          <div className="text-5xl font-black text-gold">{podium[0].name}</div>
          <div className="money mt-1 text-4xl">{fmtScore(podium[0].score)}</div>
        </div>
      )}
      <div className="w-full max-w-xl space-y-2">
        {podium.map((p, i) => (
          <div key={i} className="flex items-center gap-3 rounded-xl bg-white/10 px-5 py-3" style={{ opacity: 1 - i * 0.08 }}>
            <span className="w-10 text-2xl">{medals[i] ?? `${i + 1}.`}</span>
            {p.avatar && <AvatarBubble avatar={p.avatar} size={36} />}
            {!p.avatar && p.color && <span className="h-5 w-5 rounded-full" style={{ background: p.color }} />}
            <span className="flex-1 text-xl font-black">{p.name}</span>
            <span className="money text-2xl">{fmtScore(p.score)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ScoreStrip({ snap }: { snap: RoomSnapshot }) {
  const entries =
    snap.settings.mode === 'teams'
      ? snap.teams.map((t) => ({ id: t.id, name: t.name, color: t.color, score: t.score, control: snap.controlId === t.id }))
      : [...snap.players]
          .sort((a, b) => b.score - a.score)
          .slice(0, 8)
          .map((p) => ({ id: p.id, name: p.name, color: p.avatar.color, score: p.score, control: snap.controlId === p.id }));
  return (
    <div className="flex shrink-0 items-stretch gap-1.5 bg-black/40 p-1.5">
      {entries.map((e) => (
        <div
          key={e.id}
          className="flex min-w-0 flex-1 flex-col items-center justify-center rounded-lg px-2 py-1.5"
          style={{ background: `linear-gradient(160deg, ${e.color}33, ${e.color}11)`, boxShadow: `inset 0 -3px 0 ${e.color}` }}
        >
          <div className="w-full truncate text-center text-xs font-black uppercase tracking-wide text-white/80">
            {e.control && <span className="mr-1 text-gold">●</span>}
            {e.name}
          </div>
          <div className={`money [font-size:clamp(14px,2vw,28px)] ${e.score < 0 ? 'text-rose-400' : ''}`}>{fmtScore(e.score)}</div>
        </div>
      ))}
      {entries.length === 0 && <div className="flex-1 py-2 text-center text-sm text-white/30">No players</div>}
    </div>
  );
}
