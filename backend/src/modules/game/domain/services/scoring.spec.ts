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
  it('Ana: 94 s of 90, attempt 3, second, hint kept -> 125', () => {
    const b = scoreRound(
      solved({ name: 'Ana', secondsLeftAtSolve: 94, attempt: 3, position: 2 }),
      INITIAL,
      true,
    );
    expect(b.timeLeftPercent).toBe(104);
    expect(b.timePoints).toBe(104);
    expect(b.attemptPenalty).toBe(-4);
    expect(b.positionBonus).toBe(15);
    expect(b.hintBonus).toBe(10);
    expect(b.floorApplied).toBe(false);
    expect(b.roundPoints).toBe(125);
  });

  it('Ana with the hint used: 89 s -> 99 -> 110', () => {
    const b = scoreRound(
      solved({ secondsLeftAtSolve: 89, attempt: 3, position: 2, hintUsed: true }),
      INITIAL,
      true,
    );
    expect(b.timePoints).toBe(99);
    expect(b.hintBonus).toBe(0);
    expect(b.roundPoints).toBe(110);
  });

  it('Bruno: 100 s, attempt 2, first, hint kept -> 144', () => {
    const b = scoreRound(
      solved({ secondsLeftAtSolve: 100, attempt: 2, position: 1 }),
      INITIAL,
      true,
    );
    expect(b.timePoints).toBe(111);
    expect(b.roundPoints).toBe(144);
  });

  it('Carla: 40 s, attempt 5, fourth, hint kept -> 46', () => {
    const b = scoreRound(
      solved({ secondsLeftAtSolve: 40, attempt: 5, position: 4 }),
      INITIAL,
      true,
    );
    expect(b.timeLeftPercent).toBe(44);
    expect(b.attemptPenalty).toBe(-8);
    expect(b.positionBonus).toBe(0);
    expect(b.hintBonus).toBe(10);
    expect(b.roundPoints).toBe(46);
  });

  it('Elena: 12 s, attempt 6, fifth -> floor 30', () => {
    const b = scoreRound(
      solved({ secondsLeftAtSolve: 12, attempt: 6, position: 5 }),
      INITIAL,
      true,
    );
    expect(b.timePoints + b.attemptPenalty + b.positionBonus + b.hintBonus).toBeLessThan(30);
    expect(b.floorApplied).toBe(true);
    expect(b.roundPoints).toBe(30);
  });

  it('solving at attempt 8 with 2 seconds never scores below 30', () => {
    const b = scoreRound(
      solved({ secondsLeftAtSolve: 2, attempt: 8, position: 6 }),
      INITIAL,
      false,
    );
    expect(b.hintBonus).toBe(0);
    expect(b.floorApplied).toBe(true);
    expect(b.roundPoints).toBe(30);
  });

  it('the worst solve (30) still beats the best consolation (28)', () => {
    const worstSolve = scoreRound(
      solved({ secondsLeftAtSolve: 0, attempt: 8, position: 8 }),
      INITIAL,
      false,
    );
    const bestConsolation = scoreRound(unsolved(4, 1), INITIAL, true);
    expect(worstSolve.roundPoints).toBe(30);
    expect(bestConsolation.roundPoints).toBe(28);
    expect(worstSolve.roundPoints).toBeGreaterThan(bestConsolation.roundPoints);
  });

  it('no hint bonus when hints are disabled in the room', () => {
    const b = scoreRound(
      solved({ secondsLeftAtSolve: 90, attempt: 1, position: 1 }),
      INITIAL,
      false,
    );
    expect(b.hintBonus).toBe(0);
    expect(b.roundPoints).toBe(125);
  });

  it('unsolved: 8 per green and 4 per yellow, capped at 28; nothing else', () => {
    const fito = scoreRound(unsolved(4), INITIAL, true);
    expect(fito.greenPoints).toBe(32);
    expect(fito.yellowPoints).toBe(0);
    expect(fito.roundPoints).toBe(28); // capped
    expect(fito.hintBonus).toBe(0);
    expect(fito.timeLeftPercent).toBeNull();
    expect(fito.position).toBeNull();

    const gaby = scoreRound(unsolved(2, 1), INITIAL, true);
    expect(gaby.greenPoints).toBe(16);
    expect(gaby.yellowPoints).toBe(4);
    expect(gaby.roundPoints).toBe(20);

    expect(scoreRound(unsolved(0), INITIAL, true).roundPoints).toBe(0);
  });

  it('unsolved: yellows alone pay, and never past the cap', () => {
    expect(scoreRound(unsolved(0, 1), INITIAL, true).roundPoints).toBe(4);
    expect(scoreRound(unsolved(0, 5), INITIAL, true).roundPoints).toBe(20);
    expect(scoreRound(unsolved(3, 2), INITIAL, true).roundPoints).toBe(28); // 24 + 8 capped
  });

  it('solving ignores greens and yellows entirely', () => {
    const b = scoreRound(
      solved({ secondsLeftAtSolve: 90, attempt: 1, position: 1, greens: 5, yellows: 0 }),
      INITIAL,
      false,
    );
    expect(b.greenPoints).toBe(0);
    expect(b.yellowPoints).toBe(0);
    expect(b.roundPoints).toBe(125);
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
