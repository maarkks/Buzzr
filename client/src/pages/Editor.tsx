import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  type GameData,
  type Visibility,
  clueIsEmpty,
  emptyClue,
  emptyRound,
  MAX_CATEGORIES,
  MAX_ROWS,
} from '@buzzr/shared';
import { api, getEditToken, rememberGame } from '../lib/api';
import { ErrorScreen, HomeLink, Spinner } from '../components/ui';

type CellRef = { round: number; cat: number; row: number } | 'final' | null;

export default function Editor() {
  const { id = '' } = useParams();
  const nav = useNavigate();
  const token = useMemo(() => getEditToken(id), [id]);

  const [game, setGame] = useState<GameData | null>(null);
  const [visibility, setVisibility] = useState<Visibility>('public');
  const [notFound, setNotFound] = useState(false);
  const [tab, setTab] = useState(0); // round index, or rounds.length for Final tab
  const [editing, setEditing] = useState<CellRef>(null);
  const [saveState, setSaveState] = useState<'saved' | 'saving' | 'dirty' | 'error' | 'readonly'>('saved');
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    api
      .getGame(id)
      .then((g) => {
        setGame(g.data);
        setVisibility(g.meta.visibility);
        if (!token) setSaveState('readonly');
      })
      .catch(() => setNotFound(true));
  }, [id, token]);

  const scheduleSave = useCallback(
    (next: GameData, vis: Visibility) => {
      if (!token) return;
      setSaveState('dirty');
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(async () => {
        setSaveState('saving');
        try {
          await api.updateGame(id, token, next, vis);
          rememberGame({ id, editToken: token, title: next.title, savedAt: Date.now() });
          setSaveState('saved');
        } catch {
          setSaveState('error');
        }
      }, 800);
    },
    [id, token],
  );

  const update = useCallback(
    (fn: (g: GameData) => void) => {
      setGame((prev) => {
        if (!prev) return prev;
        const next = structuredClone(prev);
        fn(next);
        scheduleSave(next, visibility);
        return next;
      });
    },
    [scheduleSave, visibility],
  );

  if (notFound) return <ErrorScreen title="Game not found" message="This game may have been deleted." />;
  if (!game) return <Spinner label="Loading game…" />;

  const readonly = !token;
  const isFinalTab = tab >= game.rounds.length;
  const round = isFinalTab ? null : game.rounds[tab];

  async function cloneToEdit() {
    const res = await api.cloneGame(id);
    const g = await api.getGame(res.id);
    rememberGame({ id: res.id, editToken: res.editToken, title: g.data.title, savedAt: Date.now() });
    nav(`/edit/${res.id}`);
  }

  function copyEditLink() {
    const url = `${location.origin}/edit/${id}?token=${token}`;
    void navigator.clipboard.writeText(url);
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <HomeLink />
        <input
          value={game.title}
          disabled={readonly}
          onChange={(e) => update((g) => (g.title = e.target.value))}
          className="input min-w-48 flex-1 text-xl font-black"
          placeholder="Game title"
        />
        <select
          value={visibility}
          disabled={readonly}
          onChange={(e) => {
            const v = e.target.value as Visibility;
            setVisibility(v);
            if (game) scheduleSave(game, v);
          }}
          className="input w-auto"
        >
          <option value="public">Public</option>
          <option value="unlisted">Unlisted</option>
        </select>
        <SaveBadge state={saveState} />
        {readonly ? (
          <button onClick={cloneToEdit} className="btn btn-ghost">Clone to edit</button>
        ) : (
          <button onClick={copyEditLink} className="btn btn-ghost" title="Anyone with this link can edit">
            Copy edit link
          </button>
        )}
        <Link to={`/host-setup/${id}`} className="btn btn-gold">Host live ▸</Link>
      </div>

      <input
        value={game.description ?? ''}
        disabled={readonly}
        onChange={(e) => update((g) => (g.description = e.target.value))}
        className="input mb-2"
        placeholder="Description (shown when browsing)"
      />
      <input
        value={(game.tags ?? []).join(', ')}
        disabled={readonly}
        onChange={(e) => update((g) => (g.tags = e.target.value.split(',').map((t) => t.trim()).filter(Boolean)))}
        className="input mb-6"
        placeholder="Tags, comma separated (e.g. history, grade-8)"
      />

      {/* Round tabs */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {game.rounds.map((r, i) => (
          <button
            key={i}
            onClick={() => setTab(i)}
            className={`btn ${tab === i ? 'btn-gold' : 'btn-ghost'}`}
          >
            {r.name}
          </button>
        ))}
        {!readonly && game.rounds.length < 2 && (
          <button
            className="btn btn-ghost border-dashed"
            onClick={() =>
              update((g) => {
                const rows = g.rounds[0].values.length;
                const cats = g.rounds[0].categories.length;
                g.rounds.push(emptyRound('Double Round', cats, rows, 2));
              })
            }
          >
            + Double round
          </button>
        )}
        {!readonly && game.rounds.length > 1 && tab === 1 && (
          <button
            className="btn btn-ghost text-rose-400"
            onClick={() => {
              if (confirm('Remove the second round?')) {
                update((g) => void g.rounds.splice(1, 1));
                setTab(0);
              }
            }}
          >
            Remove round
          </button>
        )}
        <button
          onClick={() => setTab(game.rounds.length)}
          className={`btn ${isFinalTab ? 'btn-gold' : 'btn-ghost'}`}
        >
          Final round {game.final ? '✓' : ''}
        </button>
      </div>

      {isFinalTab ? (
        <FinalEditor game={game} readonly={readonly} update={update} />
      ) : (
        round && (
          <RoundEditor
            round={round}
            roundIndex={tab}
            readonly={readonly}
            update={update}
            onEditCell={(cat, row) => setEditing({ round: tab, cat, row })}
          />
        )
      )}

      {/* Cell modal */}
      {editing && editing !== 'final' && (
        <ClueModal
          game={game}
          cell={editing}
          readonly={readonly}
          update={update}
          onClose={() => setEditing(null)}
          onMove={(cat, row) => setEditing({ round: editing.round, cat, row })}
        />
      )}
    </div>
  );
}

function SaveBadge({ state }: { state: string }) {
  const map: Record<string, [string, string]> = {
    saved: ['Saved', 'text-emerald-400'],
    saving: ['Saving…', 'text-ink/50'],
    dirty: ['Unsaved…', 'text-gold'],
    error: ['Save failed!', 'text-rose-400'],
    readonly: ['Read-only', 'text-ink/50'],
  };
  const [label, cls] = map[state] ?? ['', ''];
  return <span className={`text-sm font-bold ${cls}`}>{label}</span>;
}

function RoundEditor({
  round,
  roundIndex,
  readonly,
  update,
  onEditCell,
}: {
  round: GameData['rounds'][number];
  roundIndex: number;
  readonly: boolean;
  update: (fn: (g: GameData) => void) => void;
  onEditCell: (cat: number, row: number) => void;
}) {
  const cats = round.categories.length;
  return (
    <div>
      <div className="overflow-x-auto pb-4">
        <div
          className="grid min-w-[640px] gap-1.5"
          style={{ gridTemplateColumns: `90px repeat(${cats}, minmax(110px, 1fr))` }}
        >
          {/* Category headers */}
          <div />
          {round.categories.map((c, ci) => (
            <div key={ci} className="cat-cell relative rounded-lg p-2">
              <textarea
                value={c.name}
                disabled={readonly}
                onChange={(e) => update((g) => (g.rounds[roundIndex].categories[ci].name = e.target.value))}
                placeholder={`Category ${ci + 1}`}
                rows={2}
                className="w-full resize-none bg-transparent text-center text-sm font-black uppercase tracking-wide text-white outline-none placeholder:text-white/50"
              />
              {!readonly && cats > 1 && (
                <button
                  className="absolute -right-1.5 -top-1.5 hidden h-5 w-5 cursor-pointer items-center justify-center rounded-full bg-rose-600 text-xs hover:flex [div:hover>&]:flex"
                  title="Remove category"
                  onClick={() => {
                    if (confirm(`Remove "${c.name || `Category ${ci + 1}`}"?`))
                      update((g) => void g.rounds[roundIndex].categories.splice(ci, 1));
                  }}
                >
                  ✕
                </button>
              )}
            </div>
          ))}

          {/* Value rows */}
          {round.values.map((v, ri) => (
            <RowCells key={ri} round={round} roundIndex={roundIndex} ri={ri} v={v} readonly={readonly} update={update} onEditCell={onEditCell} />
          ))}
        </div>
      </div>

      {!readonly && (
        <div className="flex flex-wrap gap-2">
          <button
            className="btn btn-ghost"
            disabled={cats >= MAX_CATEGORIES}
            onClick={() =>
              update((g) => {
                const r = g.rounds[roundIndex];
                r.categories.push({ name: '', clues: r.values.map(() => emptyClue()) });
              })
            }
          >
            + Category
          </button>
          <button
            className="btn btn-ghost"
            disabled={round.values.length >= MAX_ROWS}
            onClick={() =>
              update((g) => {
                const r = g.rounds[roundIndex];
                const step = r.values.length > 0 ? (r.values[r.values.length - 1] ?? 100) - (r.values[r.values.length - 2] ?? 0) : 100;
                r.values.push((r.values[r.values.length - 1] ?? 0) + (step > 0 ? step : 100));
                r.categories.forEach((c) => c.clues.push(emptyClue()));
              })
            }
          >
            + Row
          </button>
          <button
            className="btn btn-ghost"
            disabled={round.values.length <= 1}
            onClick={() =>
              update((g) => {
                const r = g.rounds[roundIndex];
                r.values.pop();
                r.categories.forEach((c) => c.clues.pop());
              })
            }
          >
            − Row
          </button>
          <span className="self-center text-xs text-ink/50">
            Click a tile to edit its clue · 💰 marks Daily Doubles · values are editable on the left
          </span>
        </div>
      )}
    </div>
  );
}

function RowCells({
  round,
  roundIndex,
  ri,
  v,
  readonly,
  update,
  onEditCell,
}: {
  round: GameData['rounds'][number];
  roundIndex: number;
  ri: number;
  v: number;
  readonly: boolean;
  update: (fn: (g: GameData) => void) => void;
  onEditCell: (cat: number, row: number) => void;
}) {
  return (
    <>
      <input
        type="number"
        value={v}
        disabled={readonly}
        onChange={(e) => update((g) => (g.rounds[roundIndex].values[ri] = Number(e.target.value)))}
        className="money w-full rounded-lg border border-ink/10 bg-ink/5 px-1 py-2 text-center text-lg outline-none"
      />
      {round.categories.map((c, ci) => {
        const clue = c.clues[ri];
        const empty = clueIsEmpty(clue);
        const partial = !empty && (!clue.question.trim() || !clue.answer.trim());
        return (
          <button
            key={ci}
            onClick={() => onEditCell(ci, ri)}
            className={`board-cell group relative min-h-16 cursor-pointer rounded-lg p-2 text-left transition hover:brightness-125 ${empty ? 'opacity-40' : ''}`}
          >
            <span className="money block text-center text-2xl">${v}</span>
            <span className="mt-1 line-clamp-2 block text-center text-[10px] leading-tight text-white/75">
              {empty ? 'empty' : clue.question}
            </span>
            {clue.dailyDouble && <span className="absolute left-1 top-1 text-xs">💰</span>}
            {partial && <span className="absolute right-1 top-1 text-xs" title="Missing question or answer">⚠️</span>}
          </button>
        );
      })}
    </>
  );
}

function ClueModal({
  game,
  cell,
  readonly,
  update,
  onClose,
  onMove,
}: {
  game: GameData;
  cell: { round: number; cat: number; row: number };
  readonly: boolean;
  update: (fn: (g: GameData) => void) => void;
  onClose: () => void;
  onMove: (cat: number, row: number) => void;
}) {
  const round = game.rounds[cell.round];
  const cat = round.categories[cell.cat];
  const clue = cat?.clues[cell.row];
  if (!clue) return null;

  const set = (fn: (c: NonNullable<typeof clue>) => void) =>
    update((g) => fn(g.rounds[cell.round].categories[cell.cat].clues[cell.row]));

  const cats = round.categories.length;
  const rows = round.values.length;
  const flatIndex = cell.cat * rows + cell.row;
  const move = (delta: number) => {
    const next = flatIndex + delta;
    if (next < 0 || next >= cats * rows) return;
    onMove(Math.floor(next / rows), next % rows);
  };

  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-black/70 p-4" onClick={onClose}>
      <div className="card anim-pop w-full max-w-xl p-6" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <div className="font-black uppercase tracking-wide text-ink/70">
            {cat.name || `Category ${cell.cat + 1}`} · <span className="money">${round.values[cell.row]}</span>
          </div>
          <div className="flex gap-2">
            <button className="btn btn-ghost px-3" onClick={() => move(-1)} title="Previous clue">←</button>
            <button className="btn btn-ghost px-3" onClick={() => move(1)} title="Next clue">→</button>
            <button className="btn btn-ghost px-3" onClick={onClose}>✕</button>
          </div>
        </div>
        <label className="mb-1 block text-xs font-bold uppercase text-ink/50">Clue (what players see)</label>
        <textarea
          value={clue.question}
          disabled={readonly}
          onChange={(e) => set((c) => (c.question = e.target.value))}
          rows={3}
          autoFocus
          className="input mb-4 resize-none text-base"
          placeholder="This 1969 mission landed the first humans on the Moon"
        />
        <label className="mb-1 block text-xs font-bold uppercase text-ink/50">Correct response</label>
        <textarea
          value={clue.answer}
          disabled={readonly}
          onChange={(e) => set((c) => (c.answer = e.target.value))}
          rows={2}
          className="input mb-4 resize-none text-base"
          placeholder="What is Apollo 11?"
        />
        <label className="mb-1 block text-xs font-bold uppercase text-ink/50">Image URL (optional)</label>
        <input
          value={clue.image ?? ''}
          disabled={readonly}
          onChange={(e) => set((c) => (c.image = e.target.value || undefined))}
          className="input mb-4"
          placeholder="https://…"
        />
        {clue.image && <img src={clue.image} alt="" className="mb-4 max-h-40 rounded-lg object-contain" />}
        <label className="flex cursor-pointer items-center gap-3">
          <input
            type="checkbox"
            checked={!!clue.dailyDouble}
            disabled={readonly}
            onChange={(e) => set((c) => (c.dailyDouble = e.target.checked || undefined))}
            className="h-5 w-5 accent-[#fbbf24]"
          />
          <span className="font-bold">💰 Daily Double</span>
          <span className="text-xs text-ink/50">— the team in control wagers before seeing the clue</span>
        </label>
      </div>
    </div>
  );
}

function FinalEditor({
  game,
  readonly,
  update,
}: {
  game: GameData;
  readonly: boolean;
  update: (fn: (g: GameData) => void) => void;
}) {
  const final = game.final;
  if (!final) {
    return (
      <div className="card grid place-items-center p-12 text-center">
        <p className="mb-4 max-w-md text-ink/60">
          The Final round is the big finish: everyone wagers from their score, then answers on their phone before the timer runs out.
        </p>
        {!readonly && (
          <button
            className="btn btn-gold"
            onClick={() => update((g) => (g.final = { category: '', question: '', answer: '' }))}
          >
            + Add a Final round
          </button>
        )}
      </div>
    );
  }
  const set = (fn: (f: NonNullable<GameData['final']>) => void) => update((g) => g.final && fn(g.final));
  return (
    <div className="card max-w-2xl p-6">
      <label className="mb-1 block text-xs font-bold uppercase text-ink/50">Category (revealed first, for wagering)</label>
      <input
        value={final.category}
        disabled={readonly}
        onChange={(e) => set((f) => (f.category = e.target.value))}
        className="input mb-4 font-black uppercase"
        placeholder="WORLD CAPITALS"
      />
      <label className="mb-1 block text-xs font-bold uppercase text-ink/50">Final clue</label>
      <textarea
        value={final.question}
        disabled={readonly}
        onChange={(e) => set((f) => (f.question = e.target.value))}
        rows={3}
        className="input mb-4 resize-none"
      />
      <label className="mb-1 block text-xs font-bold uppercase text-ink/50">Correct response</label>
      <textarea
        value={final.answer}
        disabled={readonly}
        onChange={(e) => set((f) => (f.answer = e.target.value))}
        rows={2}
        className="input mb-4 resize-none"
      />
      {!readonly && (
        <button
          className="btn btn-ghost text-rose-400"
          onClick={() => confirm('Remove the Final round?') && update((g) => (g.final = null))}
        >
          Remove Final round
        </button>
      )}
    </div>
  );
}
