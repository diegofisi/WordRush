import { create } from 'zustand';

import { rejoinRoom } from '@/core/session/api/rejoin-room/rejoinRoom';
import { ensureConnected, socket } from '@/core/session/lib/socket';
import {
  toStoredSession,
  type ConnectionStatus,
  type StoredSession,
} from '@/core/session/models/session.model';
import type { ErrorPayload, FullState, SessionAck } from '@/shared/contract';
import { toast } from '@/shared/stores/useToastStore';

/**
 * `localStorage`, not `sessionStorage`: closing the tab or losing the network
 * must not cost the seat while the game is still going
 * (docs/context/02-game-rules.md -> "Disconnections and room lifetime").
 */
const SESSION_KEY = 'wordrush.session';

const readSession = (): StoredSession | null => {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredSession>;
    if (!parsed.roomCode || !parsed.playerId || !parsed.token) return null;
    return {
      roomCode: parsed.roomCode,
      playerId: parsed.playerId,
      token: parsed.token,
      name: parsed.name ?? '',
    };
  } catch {
    return null;
  }
};

const writeSession = (session: StoredSession | null) => {
  try {
    if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    else localStorage.removeItem(SESSION_KEY);
  } catch {
    // storage unavailable (private mode): the in-memory session still works
  }
};

/** Error codes after which the stored session is useless. */
const FATAL_CODES = new Set<ErrorPayload['code']>([
  'session_expired',
  'room_not_found',
  'not_in_room',
]);

/** Codes that mean "that room is gone", worth telling the user about. */
const EXPIRED_CODES = new Set<ErrorPayload['code']>(['session_expired', 'room_not_found']);

interface SessionState {
  session: StoredSession | null;
  connection: ConnectionStatus;
  /** Latest full snapshot from create/join/rejoin; feature stores hydrate from it. */
  snapshot: FullState | null;
  /** True once the initial rejoin attempt (or its absence) has settled. */
  bootstrapped: boolean;
  /** A stored session was dropped because its room ended or vanished. */
  expired: boolean;
}

interface SessionActions {
  bind: () => void;
  applyAck: (ack: SessionAck, fallbackName: string) => void;
  clearSession: (options?: { expired?: boolean }) => void;
  dismissExpired: () => void;
  markBootstrapped: () => void;
  /** Re-emits `room:rejoin` with the stored session (single-flight); clears it on fatal errors. */
  rejoin: (options?: { initial?: boolean }) => Promise<FullState | null>;
}

let bound = false;
let rejoinInFlight: Promise<FullState | null> | null = null;

export const useSessionStore = create<SessionState & SessionActions>((set, get) => ({
  session: readSession(),
  connection: 'idle',
  snapshot: null,
  bootstrapped: false,
  expired: false,

  bind: () => {
    if (bound) return;
    bound = true;

    socket.on('connect', () => {
      set({ connection: 'connected' });
      // Every (re)connection re-attaches to the room; `rejoin` is single-flight.
      if (get().session) void get().rejoin();
    });
    socket.on('disconnect', () => set({ connection: 'disconnected' }));
    socket.on('connect_error', () => set({ connection: 'disconnected' }));
    socket.on('error', (payload) => {
      toast.error(payload.code);
      if (FATAL_CODES.has(payload.code)) {
        get().clearSession({ expired: EXPIRED_CODES.has(payload.code) });
      }
    });
  },

  applyAck: (ack, fallbackName) => {
    const session = toStoredSession(ack, fallbackName);
    writeSession(session);
    set({ session, snapshot: ack.state, expired: false });
  },

  clearSession: ({ expired = false } = {}) => {
    writeSession(null);
    set({ session: null, snapshot: null, expired });
  },

  dismissExpired: () => set({ expired: false }),

  markBootstrapped: () => set({ bootstrapped: true }),

  rejoin: ({ initial = false } = {}) => {
    if (rejoinInFlight) return rejoinInFlight;
    const session = get().session;
    if (!session) return Promise.resolve(null);
    rejoinInFlight = (async () => {
      set({ connection: socket.connected ? 'connected' : 'connecting' });
      ensureConnected();
      const result = await rejoinRoom(session);
      if (result.ok) {
        // Coming back to a game that already ended is a dead session, not a seat.
        if (initial && result.value.state.lobby.status === 'finished') {
          get().clearSession({ expired: true });
          return null;
        }
        get().applyAck(result.value, session.name);
        return result.value.state;
      }
      const timedOut = result.error.message === 'timeout';
      // A session that cannot be restored must never trap the user on a
      // guarded route: drop it and say so on the home page.
      if (EXPIRED_CODES.has(result.error.code) || timedOut) {
        get().clearSession({ expired: true });
        return null;
      }
      if (FATAL_CODES.has(result.error.code) || result.error.code === 'invalid_payload') {
        get().clearSession();
      }
      toast.error(result.error.code);
      return null;
    })().finally(() => {
      rejoinInFlight = null;
    });
    return rejoinInFlight;
  },
}));
