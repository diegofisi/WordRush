import { SCORING } from '@shared/contract';

import { computeStandings, scoreRound, type RoundResult } from './scoring';

const INITIAL = 90;

function solved(overrides: Partial<RoundResult>): RoundResult {
  return {
    playerId: 'p',
    name: 'P',
    solved: true,
    attempt: 1,
    position: 1,
    secondsLeftAtSolve: 0,
    hintUsed: false,
    greens: 5,
    yellows: 0,
    ...overrides,
  };
}

function unsolved(greens: number, yellows = 0): RoundResult {
  return {
    playerId: 'p',
    name: 'P',
    solved: false,
    attempt: 8,
    position: null,
    secondsLeftAtSolve: 0,
    hintUsed: false,
    greens,
    yellows,
  };
}

describe('scoreRound (03-scoring-system.md)', () => {
  it('Ana: 94 s of 90, attempt 3, second, hint kept -> 165', () => {
    const b = scoreRound(
      solved({ name: 'Ana', secondsLeftAtSolve: 94, attempt: 3, position: 2 }),
      INITIAL,
      true,
    );
    expect(b.timeLeftPercent).toBe(104);
    expect(b.timePoints).toBe(104);
    expect(b.solveBonus).toBe(40);
    expect(b.attemptPenalty).toBe(-4);
    expect(b.positionBonus).toBe(15);
    expect(b.hintBonus).toBe(10);
    expect(b.roundPoints).toBe(165);
  });

  it('Ana with the hint used: 89 s -> 99 -> 150', () => {
    const b = scoreRound(
      solved({ secondsLeftAtSolve: 89, attempt: 3, position: 2, hintUsed: true }),
      INITIAL,
      true,
    );
    expect(b.timePoints).toBe(99);
    expect(b.hintBonus).toBe(0);
    expect(b.roundPoints).toBe(150);
  });

  it('Bruno: 100 s, attempt 2, first, hint kept -> 179', () => {
    const b = scoreRound(
      solved({ secondsLeftAtSolve: 100, attempt: 2, position: 1 }),
      INITIAL,
      true,
    );
    expect(b.timePoints).toBe(111);
    expect(b.positionBonus).toBe(20);
    expect(b.roundPoints).toBe(179);
  });

  it('Carla: 40 s, attempt 5, fourth, hint kept -> 86', () => {
    const b = scoreRound(
      solved({ secondsLeftAtSolve: 40, attempt: 5, position: 4 }),
      INITIAL,
      true,
    );
    expect(b.timeLeftPercent).toBe(44);
    expect(b.attemptPenalty).toBe(-8);
    expect(b.positionBonus).toBe(0);
    expect(b.hintBonus).toBe(10);
    expect(b.roundPoints).toBe(86);
  });

  it('Elena: 12 s, attempt 6, fifth, hint kept -> 53', () => {
    const b = scoreRound(
      solved({ secondsLeftAtSolve: 12, attempt: 6, position: 5 }),
      INITIAL,
      true,
    );
    expect(b.timePoints).toBe(13);
    expect(b.solveBonus).toBe(40);
    expect(b.attemptPenalty).toBe(-10);
    expect(b.roundPoints).toBe(53);
  });

  it('a late solve never drops below the solve bonus: 2 s, attempt 8 -> raw 28, paid 40', () => {
    const b = scoreRound(
      solved({ secondsLeftAtSolve: 2, attempt: 8, position: 6 }),
      INITIAL,
      false,
    );
    expect(b.timePoints).toBe(2);
    expect(b.hintBonus).toBe(0);
    expect(b.attemptPenalty).toBe(-14);
    expect(b.roundPoints).toBe(SCORING.solveBonus);
  });

  it('solving never scores below the solve bonus, so it always beats the best consolation', () => {
    const bestConsolation = scoreRound(unsolved(4, 1), INITIAL, true);
    expect(bestConsolation.roundPoints).toBe(36);
    // Worst solve: clock at 0, attempt 8 (−14), no position bonus, hint spent → 26 raw.
    const worstSolve = scoreRound(
      solved({ secondsLeftAtSolve: 0, attempt: 8, position: 8, hintUsed: true }),
      INITIAL,
      true,
    );
    expect(worstSolve.roundPoints).toBe(SCORING.solveBonus);
    expect(worstSolve.roundPoints).toBeGreaterThan(bestConsolation.roundPoints);
  });

  it('no hint bonus when hints are disabled in the room', () => {
    const b = scoreRound(
      solved({ secondsLeftAtSolve: 90, attempt: 1, position: 1 }),
      INITIAL,
      false,
    );
    expect(b.hintBonus).toBe(0);
    expect(b.roundPoints).toBe(160);
  });

  it('unsolved: 8 per green and 4 per yellow, with no cap; nothing else', () => {
    const fito = scoreRound(unsolved(4), INITIAL, true);
    expect(fito.greenPoints).toBe(32);
    expect(fito.yellowPoints).toBe(0);
    expect(fito.roundPoints).toBe(32);
    expect(fito.solveBonus).toBe(0);
    expect(fito.hintBonus).toBe(0);
    expect(fito.timeLeftPercent).toBeNull();
    expect(fito.position).toBeNull();

    const gaby = scoreRound(unsolved(2, 1), INITIAL, true);
    expect(gaby.greenPoints).toBe(16);
    expect(gaby.yellowPoints).toBe(4);
    expect(gaby.roundPoints).toBe(20);

    expect(scoreRound(unsolved(0), INITIAL, true).roundPoints).toBe(0);
  });

  it('unsolved: yellows alone pay', () => {
    expect(scoreRound(unsolved(0, 1), INITIAL, true).roundPoints).toBe(4);
    expect(scoreRound(unsolved(0, 5), INITIAL, true).roundPoints).toBe(20);
    expect(scoreRound(unsolved(3, 2), INITIAL, true).roundPoints).toBe(32);
  });

  it('solving ignores greens and yellows entirely', () => {
    const b = scoreRound(
      solved({ secondsLeftAtSolve: 90, attempt: 1, position: 1, greens: 5, yellows: 0 }),
      INITIAL,
      false,
    );
    expect(b.greenPoints).toBe(0);
    expect(b.yellowPoints).toBe(0);
    expect(b.roundPoints).toBe(160);
  });
});

describe('computeStandings', () => {
  const base = { playerId: '', name: '', total: 100, attempts: 5, hintsUsed: 0 };

  it('orders by total, then fewer attempts, then fewer hints', () => {
    const standings = computeStandings([
      { ...base, playerId: 'a', name: 'A', attempts: 5, hintsUsed: 0 },
      { ...base, playerId: 'b', name: 'B', attempts: 4, hintsUsed: 1 },
      { ...base, playerId: 'c', name: 'C', attempts: 4, hintsUsed: 0 },
      { ...base, playerId: 'd', name: 'D', total: 120, attempts: 9, hintsUsed: 3 },
    ]);
    expect(standings.map((s) => s.playerId)).toEqual(['d', 'c', 'b', 'a']);
    expect(standings.map((s) => s.rank)).toEqual([1, 2, 3, 4]);
  });

  it('shares the rank on a full tie', () => {
    const standings = computeStandings([
      { ...base, playerId: 'a', name: 'A' },
      { ...base, playerId: 'b', name: 'B' },
      { ...base, playerId: 'c', name: 'C', total: 50 },
    ]);
    expect(standings.map((s) => s.rank)).toEqual([1, 1, 3]);
  });
});
