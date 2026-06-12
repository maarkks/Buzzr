import { useEffect, useMemo, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import type {
  Avatar,
  HostSecrets,
  JoinAck,
  MeState,
  Role,
  RoomSnapshot,
  SfxName,
} from '@buzzr/shared';
import { playSfx } from './sfx';

export interface RoomConn {
  snap: RoomSnapshot | null;
  me: MeState | null;
  secrets: HostSecrets | null;
  joined: boolean;
  error: string | null;
  closedReason: string | null;
  emit: (event: string, ...args: unknown[]) => void;
}

export interface JoinOptions {
  hostToken?: string;
  playerId?: string;
  name?: string;
  avatar?: Avatar;
  /** Play sound effects on this surface (board / host). */
  sounds?: boolean;
  onJoined?: (playerId: string | undefined) => void;
}

/**
 * Connects to a room and keeps role-scoped state in sync. The server pushes
 * full snapshots on every change; reconnects automatically re-join.
 */
export function useRoom(code: string | undefined, role: Role, opts: JoinOptions, enabled = true): RoomConn {
  const [snap, setSnap] = useState<RoomSnapshot | null>(null);
  const [me, setMe] = useState<MeState | null>(null);
  const [secrets, setSecrets] = useState<HostSecrets | null>(null);
  const [joined, setJoined] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [closedReason, setClosedReason] = useState<string | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const optsRef = useRef(opts);
  optsRef.current = opts;

  useEffect(() => {
    if (!code || !enabled) return;
    const socket = io({ transports: ['websocket', 'polling'] });
    socketRef.current = socket;

    const join = () => {
      const o = optsRef.current;
      socket.emit(
        'room:join',
        {
          code: code.toUpperCase(),
          role,
          hostToken: o.hostToken,
          playerId: o.playerId,
          name: o.name,
          avatar: o.avatar,
        },
        (ack: JoinAck) => {
          if (ack.ok) {
            setJoined(true);
            setError(null);
            optsRef.current.onJoined?.(ack.playerId);
            if (ack.playerId) optsRef.current.playerId = ack.playerId;
          } else {
            setError(ack.error ?? 'Could not join the room.');
          }
        },
      );
    };

    socket.on('connect', join);
    socket.on('room:state', (s: RoomSnapshot, m: MeState | null, sec: HostSecrets | null) => {
      setSnap(s);
      setMe(m);
      setSecrets(sec);
    });
    socket.on('room:closed', (reason: string) => {
      setClosedReason(reason || 'The room was closed.');
      socket.disconnect();
    });
    if (opts.sounds) {
      socket.on('sfx', (name: SfxName) => playSfx(name));
    }

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, role, enabled]);

  return useMemo(
    () => ({
      snap,
      me,
      secrets,
      joined,
      error,
      closedReason,
      emit: (event: string, ...args: unknown[]) => socketRef.current?.emit(event, ...args),
    }),
    [snap, me, secrets, joined, error, closedReason],
  );
}

/** Live countdown text/fraction for a server timer. */
export function useTimer(timer: { endsAt: number; totalMs: number } | null): { secondsLeft: number; frac: number } | null {
  const [, force] = useState(0);
  useEffect(() => {
    if (!timer) return;
    const id = setInterval(() => force((n) => n + 1), 100);
    return () => clearInterval(id);
  }, [timer]);
  if (!timer) return null;
  const msLeft = Math.max(0, timer.endsAt - Date.now());
  return { secondsLeft: Math.ceil(msLeft / 1000), frac: timer.totalMs > 0 ? msLeft / timer.totalMs : 0 };
}
