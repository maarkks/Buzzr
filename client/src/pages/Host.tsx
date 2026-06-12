import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { fmtScore, type HostSecrets, type PlayerPub, type RoomSnapshot } from '@buzzr/shared';
import { getHostToken, openDisplayWindow } from '../lib/api';
import { useRoom, type RoomConn } from '../lib/socket';
import { AvatarBubble, ErrorScreen, FlashBanner, HomeLink, Spinner, TimerRing } from '../components/ui';

export default function Host() {
  const { code = '' } = useParams();
  const hostToken = useMemo(() => getHostToken(code), [code]);
  const conn = useRoom(code, 'host', { hostToken: hostToken ?? undefined, sounds: true }, !!hostToken);

  if (!hostToken)
    return <ErrorScreen title="Not the host" message="This browser doesn't hold the host key for that room. Create the room from a game page to host it." />;
  if (conn.closedReason) return <ErrorScreen title="Room closed" message={conn.closedReason} />;
  if (conn.error) return <ErrorScreen title="Can't host" message={conn.error} />;
  if (!conn.snap || !conn.secrets) return <Spinner label="Connecting to your room…" />;

  const { snap, secrets } = conn;
  return (
    <div className="mx-auto max-w-7xl px-4 py-4">
      <FlashBanner flash={snap.flash} />
      <TopBar snap={snap} conn={conn} />
      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <div>
          <PhasePanel snap={snap} secrets={secrets} conn={conn} />
        </div>
        <Roster snap={snap} conn={conn} />
      </div>
    </div>
  );
}

function TopBar({ snap, conn }: { snap: RoomSnapshot; conn: RoomConn }) {
  const [copied, setCopied] = useState<string | null>(null);
  const joinUrl = `${location.origin}/play/${snap.code}`;
  const copy = (label: string, text: string) => {
    void navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 1500);
  };
  return (
    <div className="card mb-4 flex flex-wrap items-center gap-3 p-3">
      <HomeLink />
      <span className="money on-stage rounded-lg bg-white/10 px-4 py-1 text-3xl tracking-[.25em]">{snap.code}</span>
      <span className="hidden text-sm text-ink/50 md:block">{snap.gameTitle}</span>
      <div className="ml-auto flex flex-wrap items-center gap-2">
        <button className="btn btn-ghost" onClick={() => copy('join', joinUrl)}>
          {copied === 'join' ? '✓ Copied' : '📱 Copy join link'}
        </button>
        <button
          className="btn btn-ghost"
          onClick={() => openDisplayWindow(snap.code)}
          title="Pop out the clean audience display — share/project that window while you judge from this one"
        >
          ⧉ Pop out display
        </button>
        <button
          className={`btn ${snap.locked ? 'btn-red' : 'btn-ghost'}`}
          onClick={() => conn.emit('host:lockRoom', !snap.locked)}
          title="Locked rooms reject new players"
        >
          {snap.locked ? '🔒 Locked' : '🔓 Open'}
        </button>
        {snap.phase !== 'ended' && (
          <button
            className="btn btn-red"
            onClick={() => confirm('End the game and show the podium?') && conn.emit('host:endGame')}
          >
            End game
          </button>
        )}
      </div>
    </div>
  );
}

// ── Phase panels ──────────────────────────────────────────────────────────────

function PhasePanel({ snap, secrets, conn }: { snap: RoomSnapshot; secrets: HostSecrets; conn: RoomConn }) {
  switch (snap.phase) {
    case 'lobby':
      return <LobbyPanel snap={snap} conn={conn} />;
    case 'board':
      return <BoardPanel snap={snap} conn={conn} />;
    case 'clue':
      return <CluePanel snap={snap} secrets={secrets} conn={conn} />;
    case 'final-wager':
    case 'final-answer':
    case 'final-reveal':
      return <FinalPanel snap={snap} secrets={secrets} conn={conn} />;
    case 'ended':
      return <EndedPanel snap={snap} />;
    default:
      return null;
  }
}

function LobbyPanel({ snap, conn }: { snap: RoomSnapshot; conn: RoomConn }) {
  const joinUrl = `${location.origin}/play/${snap.code}`;
  return (
    <div className="card p-6">
      <h2 className="mb-2 text-2xl font-black">Lobby</h2>
      <p className="mb-4 text-ink/60">
        Players join at <span className="font-bold text-gold">{joinUrl.replace(/^https?:\/\//, '')}</span> — they appear in the
        roster as they arrive. Open the board view on the big screen so everyone can see the code.
      </p>
      <ul className="mb-6 list-inside list-disc space-y-1 text-sm text-ink/50">
        <li>{snap.settings.mode === 'teams' ? `Teams mode · ${snap.teams.length} teams · players are auto-balanced, drag them around in the roster` : 'Free-for-all · every player for themselves'}</li>
        <li>Wrong answers {snap.settings.penalizeWrong ? 'deduct points' : "don't deduct points"} · {snap.settings.buzzWindowSec}s buzz window</li>
        <li>You can also run the board with no phones at all — score with the ± buttons.</li>
      </ul>
      <button className="btn btn-gold px-8 py-3 text-lg" onClick={() => conn.emit('host:start')}>
        Start game ▸
      </button>
    </div>
  );
}

function BoardPanel({ snap, conn }: { snap: RoomSnapshot; conn: RoomConn }) {
  const allUsed = snap.used.every((c) => c.every(Boolean));
  return (
    <div className="card p-4">
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <h2 className="text-xl font-black">{snap.roundName}</h2>
        <span className="text-sm text-ink/50">
          Control: <b className="text-gold">{snap.controlName ?? '—'}</b>
        </span>
        <div className="ml-auto flex gap-2">
          {snap.roundIndex + 1 < snap.roundCount && (
            <button className={`btn ${allUsed ? 'btn-gold' : 'btn-ghost'}`} onClick={() => conn.emit('host:nextRound')}>
              Next round ▸
            </button>
          )}
          {snap.hasFinal && (
            <button
              className={`btn ${allUsed && snap.roundIndex + 1 >= snap.roundCount ? 'btn-gold' : 'btn-ghost'}`}
              onClick={() => conn.emit('host:startFinal')}
            >
              Final round ▸
            </button>
          )}
        </div>
      </div>
      <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${snap.categories.length}, minmax(0,1fr))` }}>
        {snap.categories.map((c, ci) => (
          <div key={ci} className="cat-cell flex min-h-12 items-center justify-center rounded p-1 text-center text-[11px] font-black uppercase leading-tight">
            {c}
          </div>
        ))}
        {snap.values.map((v, ri) =>
          snap.categories.map((_, ci) => {
            const used = snap.used[ci]?.[ri];
            return (
              <button
                key={`${ci}-${ri}`}
                disabled={used}
                onClick={() => conn.emit('host:selectClue', ci, ri)}
                className={`${used ? 'board-cell-used' : 'board-cell cursor-pointer hover:brightness-125'} money min-h-12 rounded text-xl transition`}
              >
                {used ? '' : `$${v}`}
              </button>
            );
          }),
        )}
      </div>
      <p className="mt-3 text-xs text-ink/50">Click a tile to open it for everyone.</p>
    </div>
  );
}

function CluePanel({ snap, secrets, conn }: { snap: RoomSnapshot; secrets: HostSecrets; conn: RoomConn }) {
  const clue = snap.clue!;
  const stage = snap.clueStage!;
  const [wagerInput, setWagerInput] = useState('');
  return (
    <div className="card p-6">
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <span className="rounded bg-ink/10 px-3 py-1 text-sm font-black uppercase">{clue.category}</span>
        <span className="money text-2xl">${clue.value}</span>
        {clue.isDailyDouble && <span className="rounded bg-gold px-3 py-1 text-sm font-black text-ink">💰 DAILY DOUBLE</span>}
        {snap.timer && <span className="ml-auto"><TimerRing timer={snap.timer} size={56} /></span>}
      </div>

      <p className="mb-2 text-xl font-bold leading-snug">{clue.question || <i className="text-ink/50">— empty clue —</i>}</p>
      {clue.image && <img src={clue.image} alt="" className="mb-3 max-h-44 rounded-lg" />}
      <div className="mb-5 rounded-lg border border-gold/50 bg-gold/10 px-4 py-2">
        <span className="mr-2 text-xs font-black uppercase text-gold">Answer</span>
        <span className="font-bold">{secrets.answer || <i className="text-ink/50">—</i>}</span>
      </div>

      {/* Stage-specific controls */}
      {stage === 'reading' && (
        <div className="flex flex-wrap gap-3">
          <button className="btn btn-gold anim-armed px-8 py-3 text-lg" onClick={() => conn.emit('host:arm')}>
            🔔 Arm buzzers
          </button>
          <button className="btn btn-ghost" onClick={() => conn.emit('host:reveal')}>Reveal answer</button>
          <button className="btn btn-ghost" onClick={() => conn.emit('host:close')}>Back to board</button>
        </div>
      )}

      {stage === 'armed' && (
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-lg font-bold text-gold">Buzzers are LIVE…</span>
          <button className="btn btn-ghost" onClick={() => conn.emit('host:reveal')}>No takers — reveal</button>
        </div>
      )}

      {stage === 'buzzed' && snap.buzzWinner && (
        <div>
          <div className="anim-pop mb-4 flex items-center gap-3 rounded-xl border border-gold/50 bg-gold/10 p-4">
            <AvatarBubble avatar={snap.buzzWinner.avatar} size={48} />
            <div>
              <div className="text-xl font-black">{snap.buzzWinner.name}</div>
              <div className="text-sm text-ink/60">
                {snap.buzzWinner.teamName ? `${snap.buzzWinner.teamName} · ` : ''}buzzed in {(snap.buzzWinner.reactionMs / 1000).toFixed(2)}s
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <button className="btn btn-green px-8 py-3 text-lg" onClick={() => conn.emit('host:judge', true)}>✓ Correct</button>
            <button className="btn btn-red px-8 py-3 text-lg" onClick={() => conn.emit('host:judge', false)}>✗ Wrong</button>
            <button className="btn btn-ghost" onClick={() => conn.emit('host:reveal')}>Reveal answer</button>
          </div>
          {secrets.buzzQueue.length > 0 && (
            <div className="mt-3 text-sm text-ink/50">Also buzzed: {secrets.buzzQueue.join(', ')}</div>
          )}
        </div>
      )}

      {stage === 'wager' && (
        <div>
          <p className="mb-3 font-bold">
            Waiting for <span className="text-gold">{clue.ddOwnerName ?? 'someone'}</span> to wager from their phone…
          </p>
          {!clue.ddOwnerId && (
            <p className="mb-3 text-sm text-gold">No one has control — pick who wagers using “Give control” in the roster.</p>
          )}
          <div className="flex items-center gap-2">
            <input
              value={wagerInput}
              onChange={(e) => setWagerInput(e.target.value.replace(/\D/g, ''))}
              placeholder="Override wager"
              inputMode="numeric"
              className="input w-36"
            />
            <button className="btn btn-ghost" disabled={!wagerInput || !clue.ddOwnerId} onClick={() => conn.emit('host:setWager', Number(wagerInput))}>
              Set wager
            </button>
            <button className="btn btn-ghost ml-auto" onClick={() => conn.emit('host:close')}>Cancel clue</button>
          </div>
        </div>
      )}

      {stage === 'dd-answer' && (
        <div>
          <p className="mb-4 text-lg">
            <span className="font-black text-gold">{clue.ddOwnerName}</span> wagered{' '}
            <span className="money text-2xl">${clue.wager?.toLocaleString()}</span> — they answer out loud.
          </p>
          <div className="flex flex-wrap gap-3">
            <button className="btn btn-green px-8 py-3 text-lg" onClick={() => conn.emit('host:judge', true)}>✓ Correct</button>
            <button className="btn btn-red px-8 py-3 text-lg" onClick={() => conn.emit('host:judge', false)}>✗ Wrong</button>
          </div>
        </div>
      )}

      {stage === 'resolved' && (
        <div className="flex flex-wrap gap-3">
          <button className="btn btn-gold px-8 py-3 text-lg" onClick={() => conn.emit('host:close')}>Back to board ▸</button>
        </div>
      )}
    </div>
  );
}

function FinalPanel({ snap, secrets, conn }: { snap: RoomSnapshot; secrets: HostSecrets; conn: RoomConn }) {
  const f = snap.final!;
  return (
    <div className="card p-6">
      <h2 className="mb-1 text-2xl font-black">Final Round</h2>
      <div className="mb-4 text-ink/60">
        Category: <b className="text-gold uppercase">{f.category || '—'}</b>
      </div>
      <div className="mb-5 rounded-lg border border-gold/50 bg-gold/10 px-4 py-2">
        <span className="mr-2 text-xs font-black uppercase text-gold">Clue & answer</span>
        <div className="font-bold">{secrets.finalAnswer ? <>{f.question ?? '(clue hidden from players until you show it)'} — <span className="text-gold">{secrets.finalAnswer}</span></> : '—'}</div>
      </div>

      {snap.phase === 'final-wager' && (
        <div>
          <p className="mb-3">
            Wagers in: <b className="money text-xl">{f.wagersIn}/{f.wagersExpected}</b> — players pick a wager on their phones.
          </p>
          <button className="btn btn-gold px-8 py-3 text-lg" onClick={() => conn.emit('host:finalShowClue')}>
            Lock wagers & show the clue ▸
          </button>
        </div>
      )}

      {snap.phase === 'final-answer' && (
        <div className="flex flex-wrap items-center gap-4">
          <p>
            Answers in: <b className="money text-xl">{f.answersIn}/{f.wagersExpected}</b>
          </p>
          {snap.timer && <TimerRing timer={snap.timer} size={56} />}
          <button className="btn btn-gold" onClick={() => conn.emit('host:finalCloseAnswers')}>Close answers now</button>
        </div>
      )}

      {snap.phase === 'final-reveal' && (
        <div className="space-y-2">
          <p className="mb-2 text-sm text-ink/50">Reveal one at a time (lowest score first builds the most drama), then judge each answer.</p>
          {secrets.finalBoard.map((e) => (
            <div key={e.entityId} className="flex flex-wrap items-center gap-3 rounded-lg bg-ink/5 p-3">
              <span className="min-w-28 font-black">{e.name}</span>
              {e.revealed ? (
                <>
                  <span className="flex-1 italic text-ink/80">“{e.answer || '(no answer)'}”</span>
                  <span className="money">${(e.wager ?? 0).toLocaleString()}</span>
                  {e.judged ? (
                    <span className={`font-black ${e.judged === 'correct' ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {e.judged === 'correct' ? '✓' : '✗'}
                    </span>
                  ) : (
                    <span className="flex gap-2">
                      <button className="btn btn-green" onClick={() => conn.emit('host:finalJudge', e.entityId, true)}>✓</button>
                      <button className="btn btn-red" onClick={() => conn.emit('host:finalJudge', e.entityId, false)}>✗</button>
                    </span>
                  )}
                </>
              ) : (
                <>
                  <span className="flex-1 text-ink/40">answer hidden</span>
                  <button className="btn btn-ghost" onClick={() => conn.emit('host:finalReveal', e.entityId)}>Reveal</button>
                </>
              )}
            </div>
          ))}
          {secrets.finalBoard.every((e) => e.judged) && secrets.finalBoard.length > 0 && (
            <button className="btn btn-gold mt-3 px-8 py-3 text-lg" onClick={() => conn.emit('host:endGame')}>
              Show the podium 🏆
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function EndedPanel({ snap }: { snap: RoomSnapshot }) {
  return (
    <div className="card p-6">
      <h2 className="mb-4 text-2xl font-black">Final standings 🏆</h2>
      <ol className="space-y-2">
        {(snap.podium ?? []).map((p, i) => (
          <li key={i} className="flex items-center gap-3 rounded-lg bg-ink/5 p-3">
            <span className="money w-8 text-2xl">{i + 1}</span>
            {p.avatar && <AvatarBubble avatar={p.avatar} size={36} />}
            {!p.avatar && p.color && <span className="h-5 w-5 rounded-full" style={{ background: p.color }} />}
            <span className="flex-1 font-black">{p.name}</span>
            <span className="money text-xl">{fmtScore(p.score)}</span>
          </li>
        ))}
      </ol>
      <p className="mt-4 text-sm text-ink/50">The room stays open so phones can see the leaderboard. Closing this tab lets it expire.</p>
    </div>
  );
}

// ── Roster ────────────────────────────────────────────────────────────────────

function Roster({ snap, conn }: { snap: RoomSnapshot; conn: RoomConn }) {
  const isTeams = snap.settings.mode === 'teams';
  return (
    <div className="card max-h-[85vh] overflow-y-auto p-4">
      <h3 className="mb-3 text-sm font-black uppercase tracking-widest text-ink/50">
        {isTeams ? 'Teams' : 'Players'} ({snap.players.length} connected)
      </h3>
      {isTeams ? (
        <div className="space-y-4">
          {snap.teams.map((t) => (
            <TeamCard key={t.id} snap={snap} conn={conn} team={t} />
          ))}
          <UnassignedPlayers snap={snap} conn={conn} />
        </div>
      ) : (
        <div className="space-y-2">
          {[...snap.players]
            .sort((a, b) => b.score - a.score)
            .map((p) => (
              <PlayerRow key={p.id} snap={snap} conn={conn} p={p} showScore />
            ))}
          {snap.players.length === 0 && <EmptyRoster />}
        </div>
      )}
    </div>
  );
}

function TeamCard({ snap, conn, team }: { snap: RoomSnapshot; conn: RoomConn; team: RoomSnapshot['teams'][number] }) {
  const members = snap.players.filter((p) => p.teamId === team.id);
  const isControl = snap.controlId === team.id;
  return (
    <div className="rounded-xl border border-ink/10 p-3" style={{ borderLeft: `4px solid ${team.color}` }}>
      <div className="mb-2 flex items-center gap-2">
        <input
          defaultValue={team.name}
          key={team.id + team.name}
          onBlur={(e) => e.target.value !== team.name && conn.emit('host:renameTeam', team.id, e.target.value)}
          className="w-28 flex-1 rounded bg-transparent px-1 font-black outline-none focus:bg-ink/10"
        />
        {isControl && <span title="Has control" className="text-gold">●</span>}
        <span className="money text-xl">{fmtScore(team.score)}</span>
      </div>
      <ScoreAdjust conn={conn} entityId={team.id} />
      <div className="mt-2 space-y-1">
        {members.map((p) => (
          <PlayerRow key={p.id} snap={snap} conn={conn} p={p} />
        ))}
        {members.length === 0 && <div className="text-xs text-ink/40">No players yet</div>}
      </div>
      {!isControl && (
        <button className="mt-2 text-xs text-ink/50 hover:text-gold" onClick={() => conn.emit('host:setControl', team.id)}>
          Give control
        </button>
      )}
    </div>
  );
}

function UnassignedPlayers({ snap, conn }: { snap: RoomSnapshot; conn: RoomConn }) {
  const unassigned = snap.players.filter((p) => !p.teamId);
  if (unassigned.length === 0) return null;
  return (
    <div className="rounded-xl border border-dashed border-ink/20 p-3">
      <div className="mb-1 text-xs font-bold uppercase text-ink/50">Unassigned</div>
      {unassigned.map((p) => (
        <PlayerRow key={p.id} snap={snap} conn={conn} p={p} />
      ))}
    </div>
  );
}

function PlayerRow({ snap, conn, p, showScore }: { snap: RoomSnapshot; conn: RoomConn; p: PlayerPub; showScore?: boolean }) {
  const isTeams = snap.settings.mode === 'teams';
  const isControl = !isTeams && snap.controlId === p.id;
  return (
    <div className={`flex items-center gap-2 rounded-lg px-1 py-0.5 text-sm ${p.connected ? '' : 'opacity-40'}`}>
      <AvatarBubble avatar={p.avatar} size={24} />
      <span className="flex-1 truncate font-bold">{p.name}</span>
      {isControl && <span title="Has control" className="text-gold">●</span>}
      {p.locked && <span title="Locked out of this clue">🚫</span>}
      {!p.connected && <span title="Disconnected">📴</span>}
      {showScore && <span className="money">{fmtScore(p.score)}</span>}
      {showScore && <ScoreAdjust conn={conn} entityId={p.id} compact />}
      {isTeams && (
        <select
          value={p.teamId ?? ''}
          onChange={(e) => conn.emit('host:assignTeam', p.id, e.target.value || null)}
          className="w-7 cursor-pointer rounded bg-ink/10 text-xs outline-none"
          title="Move to team"
        >
          <option value="">—</option>
          {snap.teams.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
      )}
      {!isTeams && !isControl && (
        <button className="text-xs text-ink/40 hover:text-gold" title="Give control" onClick={() => conn.emit('host:setControl', p.id)}>
          ●
        </button>
      )}
      <button
        className="text-xs text-ink/40 hover:text-rose-400"
        title="Kick player"
        onClick={() => confirm(`Kick ${p.name}?`) && conn.emit('host:kick', p.id)}
      >
        ✕
      </button>
    </div>
  );
}

function ScoreAdjust({ conn, entityId, compact }: { conn: RoomConn; entityId: string; compact?: boolean }) {
  const cls = compact ? 'px-1 text-xs' : 'px-2 text-sm';
  return (
    <span className="inline-flex gap-1">
      <button className={`btn btn-ghost ${cls} py-0`} title="−100" onClick={() => conn.emit('host:adjustScore', entityId, -100)}>−</button>
      <button className={`btn btn-ghost ${cls} py-0`} title="+100" onClick={() => conn.emit('host:adjustScore', entityId, 100)}>+</button>
    </span>
  );
}

function EmptyRoster() {
  return <div className="py-6 text-center text-sm text-ink/40">No players yet — share the join link!</div>;
}
