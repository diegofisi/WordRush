import type { BossAction, BossFrame, BossTelemetry } from '@shared/contract';
import type { LetterState, SlotState } from '../services/boss-wiring';

export const BOSS_BRAIN = Symbol('BOSS_BRAIN');
export const BOSS_BRAIN_STREAM = Symbol('BOSS_BRAIN_STREAM');

/**
 * The live view of the brain, for the panel. Separate from `IBossBrain` because
 * it is about watching, not deciding: it keeps the simulation running on the
 * board she is looking at and emits a slice several times a second.
 */
export interface IBossBrainStream {
  /** Every live slice, with the room it was simulated for. */
  subscribe(listener: (roomCode: string, frame: BossFrame) => void): void;
  /**
   * Wakes the brain if it is asleep. Called once a room is actually playing
   * against her, so a server with no boss room holds no connectome at all.
   */
  ensure(): void;
  /**
   * Points a stream at a room's board, or stops streaming that room. Off costs
   * nothing; a room past the thread count gets no stream until one frees up.
   */
  stream(
    roomCode: string,
    on: boolean,
    board?: { slots?: string[]; letters?: [string, string][] },
  ): void;
  /** How many rooms can be streamed at once. */
  readonly streams: number;
}

export type { BossAction };

/**
 * Everything the brain is allowed to know: the board, and what she has learnt
 * about each letter. Never the word, never the answer list, never how many
 * answers are still standing.
 *
 * It used to carry the candidate count, the greens, the yellows, the attempt
 * number, the hint and the clock — everything a hand-written policy needed to
 * choose her move. The policy is gone and so is its input
 * (docs/context/08-boss-mode.md, 2026-09-13).
 */
export interface BossSituation {
  /** What she can see on her own board: a colour per slot. */
  slots: SlotState[];
  /** Her keyboard: what she has learnt about each letter she has spent. */
  letters: [string, LetterState][];
  /** Same seed, same spike train, so a round can be replayed exactly. */
  seed: number;
}

export interface BossMove {
  action: BossAction;
  /** 0..1. Low means she almost went the other way. */
  confidence: number;
  /**
   * How much she wants each letter of the alphabet, straight out of the
   * readout. This is what picks the word: the board plays the legal word that
   * best matches it. Null when the brain did not answer, and then she does not
   * move at all — nothing stands in for it.
   */
  letterPreference: Float32Array | null;
  /**
   * How much her readout wants to spend the hint on this board, 0..1. Asking is
   * not getting: the room decides whether hints exist and she has only one.
   */
  hintWant: number;
  /** Firing rate of each readout cell, in Hz, for the interface. Empty when silent. */
  rates: number[];
  /** What the simulation cost, measured. */
  biologicalMs: number;
  wallMs: number;
  /** What the brain did while deciding. Null when it did not answer. */
  telemetry: BossTelemetry | null;
}

/**
 * Chooses what the fly plays next.
 *
 * One implementation ships: `ConnectomeBossBrain`, which runs the real FlyWire
 * brain and reads her descending neurons. There is deliberately no fallback —
 * a policy standing in for the brain is an algorithm playing the game.
 */
export interface IBossBrain {
  decide(situation: BossSituation): Promise<BossMove>;
  /** What to tell the room about which brain is answering. */
  describe(): string;
}
