// Synthesized game-show sound effects via WebAudio — no audio assets needed.
import type { SfxName } from '@buzzr/shared';

let ctx: AudioContext | null = null;
let enabled = true;

function audio(): AudioContext | null {
  if (typeof AudioContext === 'undefined') return null;
  if (!ctx) ctx = new AudioContext();
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

// Browsers require a user gesture before audio — resume on first interaction.
if (typeof window !== 'undefined') {
  const unlock = () => {
    audio();
    window.removeEventListener('pointerdown', unlock);
    window.removeEventListener('keydown', unlock);
  };
  window.addEventListener('pointerdown', unlock);
  window.addEventListener('keydown', unlock);
}

export function setSfxEnabled(on: boolean) {
  enabled = on;
}

export function sfxEnabled() {
  return enabled;
}

interface Note {
  freq: number;
  at: number; // seconds from now
  dur: number;
  type?: OscillatorType;
  gain?: number;
}

function play(notes: Note[]) {
  if (!enabled) return;
  const ac = audio();
  if (!ac || ac.state !== 'running') return;
  const t0 = ac.currentTime;
  for (const n of notes) {
    const osc = ac.createOscillator();
    const g = ac.createGain();
    osc.type = n.type ?? 'sine';
    osc.frequency.value = n.freq;
    const start = t0 + n.at;
    const peak = n.gain ?? 0.18;
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(peak, start + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, start + n.dur);
    osc.connect(g).connect(ac.destination);
    osc.start(start);
    osc.stop(start + n.dur + 0.05);
  }
}

export function playSfx(name: SfxName) {
  switch (name) {
    case 'board-fill':
      play(Array.from({ length: 6 }, (_, i) => ({ freq: 320 + i * 90, at: i * 0.07, dur: 0.12, type: 'triangle' as const })));
      break;
    case 'clue-open':
      play([
        { freq: 520, at: 0, dur: 0.12, type: 'triangle' },
        { freq: 780, at: 0.09, dur: 0.2, type: 'triangle' },
      ]);
      break;
    case 'buzz':
      play([{ freq: 880, at: 0, dur: 0.28, type: 'square', gain: 0.12 }]);
      break;
    case 'correct':
      play([
        { freq: 660, at: 0, dur: 0.12, type: 'triangle' },
        { freq: 880, at: 0.1, dur: 0.12, type: 'triangle' },
        { freq: 1100, at: 0.2, dur: 0.3, type: 'triangle' },
      ]);
      break;
    case 'wrong':
      play([
        { freq: 220, at: 0, dur: 0.25, type: 'sawtooth', gain: 0.1 },
        { freq: 165, at: 0.18, dur: 0.4, type: 'sawtooth', gain: 0.1 },
      ]);
      break;
    case 'timeout':
      play([
        { freq: 392, at: 0, dur: 0.18, type: 'triangle' },
        { freq: 330, at: 0.16, dur: 0.18, type: 'triangle' },
        { freq: 262, at: 0.32, dur: 0.4, type: 'triangle' },
      ]);
      break;
    case 'daily-double':
      play([
        { freq: 523, at: 0, dur: 0.14, type: 'square', gain: 0.09 },
        { freq: 659, at: 0.12, dur: 0.14, type: 'square', gain: 0.09 },
        { freq: 784, at: 0.24, dur: 0.14, type: 'square', gain: 0.09 },
        { freq: 1047, at: 0.36, dur: 0.5, type: 'square', gain: 0.1 },
      ]);
      break;
    case 'final':
      play([
        { freq: 523, at: 0, dur: 0.4, type: 'triangle' },
        { freq: 659, at: 0.35, dur: 0.4, type: 'triangle' },
        { freq: 784, at: 0.7, dur: 0.7, type: 'triangle' },
        { freq: 1047, at: 1.1, dur: 0.9, type: 'triangle' },
      ]);
      break;
    case 'tick':
      play([{ freq: 1000, at: 0, dur: 0.05, type: 'sine', gain: 0.06 }]);
      break;
  }
}

export function vibrate(pattern: number | number[]) {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* unsupported */
  }
}
