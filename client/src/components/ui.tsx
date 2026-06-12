import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import type { Avatar, EventFlash } from '@buzzr/shared';
import { useTimer } from '../lib/socket';

export function Logo({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const cls = size === 'lg' ? 'text-7xl md:text-8xl' : size === 'sm' ? 'text-2xl' : 'text-4xl';
  return (
    <span
      className={`anim-marquee font-black tracking-wide text-amber-500 ${cls}`}
      style={{ fontFamily: 'var(--font-money)' }}
    >
      BUZZR
    </span>
  );
}

export function HomeLink() {
  return (
    <Link to="/" className="opacity-90 transition hover:opacity-100">
      <Logo size="sm" />
    </Link>
  );
}

export function AvatarBubble({ avatar, size = 44, ring }: { avatar: Avatar; size?: number; ring?: boolean }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full ${ring ? 'ring-2 ring-white' : ''}`}
      style={{ width: size, height: size, background: avatar.color, fontSize: size * 0.55 }}
    >
      <span style={{ lineHeight: 1 }}>{avatar.emoji}</span>
    </span>
  );
}

export function TimerRing({ timer, size = 72 }: { timer: { endsAt: number; totalMs: number } | null; size?: number }) {
  const t = useTimer(timer);
  if (!t) return null;
  return (
    <div
      className="timer-ring grid place-items-center rounded-full"
      style={{ width: size, height: size, ['--frac' as never]: String(t.frac) }}
    >
      <div
        className="grid place-items-center rounded-full bg-white font-black text-ink"
        style={{ width: size - 12, height: size - 12, fontSize: size * 0.34 }}
      >
        {t.secondsLeft}
      </div>
    </div>
  );
}

const FLASH_STYLES: Record<EventFlash['type'], string> = {
  correct: 'bg-emerald-200 text-emerald-950',
  wrong: 'bg-rose-200 text-rose-950',
  timeout: 'bg-amber-200 text-amber-950',
  info: 'bg-indigo-200 text-indigo-950',
  'daily-double': 'bg-gold text-ink',
};

export function FlashBanner({ flash }: { flash: EventFlash | null }) {
  if (!flash) return null;
  return (
    <div key={flash.id} className="pointer-events-none fixed inset-x-0 top-4 z-50 flex justify-center">
      <div className={`anim-flash rounded-full px-8 py-3 text-xl font-black shadow-xl ${FLASH_STYLES[flash.type]}`}>
        {flash.text}
      </div>
    </div>
  );
}

const CONFETTI_COLORS = ['#fcd34d', '#f9a8d4', '#93c5fd', '#6ee7b7', '#c4b5fd', '#fdba74'];

export function Confetti({ count = 90 }: { count?: number }) {
  const pieces = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        left: Math.random() * 100,
        delay: Math.random() * 4,
        duration: 3 + Math.random() * 4,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        rot: Math.random() * 360,
      })),
    [count],
  );
  return (
    <>
      {pieces.map((p, i) => (
        <div
          key={i}
          className="confetti"
          style={{
            left: `${p.left}%`,
            background: p.color,
            transform: `rotate(${p.rot}deg)`,
            animationDuration: `${p.duration}s`,
            animationDelay: `${p.delay}s`,
          }}
        />
      ))}
    </>
  );
}

export function ErrorScreen({ title, message, backTo = '/' }: { title: string; message: string; backTo?: string }) {
  return (
    <div className="grid min-h-screen place-items-center p-6">
      <div className="card max-w-md p-8 text-center">
        <div className="mb-2 text-4xl">😵</div>
        <h1 className="mb-2 text-2xl font-black">{title}</h1>
        <p className="mb-6 text-ink/70">{message}</p>
        <Link to={backTo} className="btn btn-gold">
          Back to Buzzr
        </Link>
      </div>
    </div>
  );
}

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="grid min-h-screen place-items-center">
      <div className="flex flex-col items-center gap-4">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-amber-400 border-t-transparent" />
        {label && <div className="text-ink/60">{label}</div>}
      </div>
    </div>
  );
}
