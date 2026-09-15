import { describe, expect, it } from 'vitest';

import { attemptsFor, type PlayerProgress } from '@/shared/contract';

const MAX_ATTEMPTS = attemptsFor(5);

import { toRivalViewModel, type RosterEntry } from './game.model';

const roster: RosterEntry = { name: 'Ana', connected: true };

const progress = (over: Partial<PlayerProgress> = {}): PlayerProgress => ({
  playerId: 'p1',
  rows: [],
  attempt: 1,
  secondsLeft: 60,
  at: 1_000_000,
  solved: false,
  solvedPosition: null,
  finished: false,
  greens: 0,
  yellows: 0,
  penaltySeconds: 0,
  ...over,
});

describe('toRivalViewModel · what a rival is allowed to leak', () => {
  /*
   * "Rival boards render colours only" is a fairness rule, not a styling one:
   * seeing a rival's letters would hand you the answer. The mapper copies each
   * row rather than aliasing it, so nothing downstream can hold a reference
   * into the socket payload.
   */
  it('copies the colour rows instead of aliasing the payload', () => {
    const source = progress({ rows: [['green', 'gray', 'gray', 'gray', 'gray']] });
    const rival = toRivalViewModel(source, roster, 90);

    expect(rival.rows).toEqual(source.rows);
    expect(rival.rows[0]).not.toBe(source.rows[0]);
  });

  it('exposes nothing but colours on a row', () => {
    const rival = toRivalViewModel(
      progress({ rows: [['green', 'yellow', 'gray', 'gray', 'gray']] }),
      roster,
      90,
    );
    for (const color of rival.rows.flat()) {
      expect(['green', 'yellow', 'gray']).toContain(color);
    }
    expect(JSON.stringify(rival)).not.toMatch(/word|letter/i);
  });
});

describe('toRivalViewModel · status', () => {
  it('shows a player who left as left, whatever the round says', () => {
    const rival = toRivalViewModel(progress({ solved: true }), roster, 90, true);
    expect(rival.status).toBe('left');
    expect(rival.connected).toBe(false);
  });

  it('separates running out of attempts from running out of time', () => {
    const rows = Array.from({ length: MAX_ATTEMPTS }, () => [
      'gray' as const,
      'gray' as const,
      'gray' as const,
      'gray' as const,
      'gray' as const,
    ]);
    expect(toRivalViewModel(progress({ finished: true, rows }), roster, 90).status).toBe(
      'out-of-attempts',
    );
    expect(toRivalViewModel(progress({ finished: true, rows: [] }), roster, 90).status).toBe(
      'out-of-time',
    );
  });

  it('is playing while the round is still open', () => {
    expect(toRivalViewModel(progress(), roster, 90).status).toBe('playing');
  });
});

describe('toRivalViewModel · derived fields', () => {
  it('reports the time left as a percentage only once solved', () => {
    expect(
      toRivalViewModel(progress({ solved: true, secondsLeft: 45 }), roster, 90).timePercent,
    ).toBe(50);
    expect(toRivalViewModel(progress({ secondsLeft: 45 }), roster, 90).timePercent).toBeNull();
  });

  it('never counts past the last attempt', () => {
    const rows = Array.from({ length: MAX_ATTEMPTS }, () => [
      'gray' as const,
      'gray' as const,
      'gray' as const,
      'gray' as const,
      'gray' as const,
    ]);
    expect(toRivalViewModel(progress({ rows }), roster, 90).currentAttempt).toBe(MAX_ATTEMPTS);
  });

  it('falls back to a placeholder name when the roster has not caught up', () => {
    expect(toRivalViewModel(progress(), undefined, 90).name).toBe('?');
  });
});
