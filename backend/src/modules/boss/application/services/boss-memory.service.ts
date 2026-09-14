import { Injectable } from '@nestjs/common';

/**
 * What the fly remembers inside one round, which is now only what she did
 * herself: the words she has already sent, and when she is next ready to move.
 *
 * It used to hold the answers still compatible with her colours, the letters
 * she had located and the hint she had spent — a deduction about the answer,
 * kept on her behalf. That is the player's job, and hers is a brain
 * (docs/context/06-boss-mode.md, 2026-09-13).
 */
export interface BossMemory {
  /** The round this memory belongs to; a new round throws it away. */
  round: number;
  /** Whole words she has already sent. She never sends one twice. */
  played: Set<string>;
  /** The letter her hint named, once she has chosen to spend it. */
  hintLetter: string | null;
  /** Epoch ms before which she is still thinking or typing. */
  nextMoveAt: number;
  /** True while the brain is mid-simulation on its own thread. */
  thinking: boolean;
}

@Injectable()
export class BossMemoryService {
  private readonly byRoom = new Map<string, BossMemory>();

  /** The memory for this room's current round, freshly seeded if the round moved on. */
  forRound(roomCode: string, round: number, now: number): BossMemory {
    const existing = this.byRoom.get(roomCode);
    if (existing && existing.round === round) return existing;

    const seeded: BossMemory = {
      round,
      played: new Set<string>(),
      hintLetter: null,
      // A beat before her first move, so a round does not open with her already typing.
      nextMoveAt: now + 1200,
      thinking: false,
    };
    this.byRoom.set(roomCode, seeded);
    return seeded;
  }

  /** The memory this room already has, without seeding one. */
  peek(roomCode: string): BossMemory | undefined {
    return this.byRoom.get(roomCode);
  }

  forget(roomCode: string): void {
    this.byRoom.delete(roomCode);
  }

  /** Rooms the repository no longer knows about leave nothing behind. */
  prune(liveRoomCodes: ReadonlySet<string>): void {
    for (const code of this.byRoom.keys()) {
      if (!liveRoomCodes.has(code)) this.byRoom.delete(code);
    }
  }
}
