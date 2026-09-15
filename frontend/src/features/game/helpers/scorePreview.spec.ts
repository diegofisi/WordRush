import { describe, expect, it } from 'vitest';

import { DEFAULT_WORD_LENGTH, SCORING } from '@/shared/contract';

import { computeScorePreview, type ScorePreviewInput } from './scorePreview';

/**
 * This helper re-implements the server's scoring formula so the player can see
 * what a solve is worth *before* committing to it. Nothing keeps the two in
 * step, so these tests assert against the `SCORING` constants rather than
 * literals: a rebalance on the server changes the contract, and only a real
 * divergence — a rule the preview forgot — fails here.
 */

const base: ScorePreviewInput = {
  secondsLeft: 45,
  initialSeconds: 90,
  attempts: 0,
  solved: false,
  solvedPosition: null,
  finished: false,
  solvedCount: 0,
  hintEnabled: true,
  hintUsed: false,
  greens: 0,
  yellows: 0,
};

const preview = (over: Partial<ScorePreviewInput> = {}) =>
  computeScorePreview({ ...base, ...over });

describe('computeScorePreview · solving', () => {
  it('reports a total that is exactly the sum of the parts it shows', () => {
    // "Every row of the table is a plain sum" — docs/context/04, 2026-09-12.
    const p = preview({ attempts: 2, solvedCount: 1 });
    expect(p.total).toBe(
      p.timePoints + p.solveBonus + p.attemptPenalty + p.positionBonus + p.hintBonus,
    );
  });

  it('turns the clock into a percentage of the initial time', () => {
    expect(preview({ secondsLeft: 45, initialSeconds: 90 }).timePercent).toBe(50);
    expect(preview({ secondsLeft: 90, initialSeconds: 90 }).timePercent).toBe(100);
    expect(preview({ secondsLeft: 0, initialSeconds: 90 }).timePercent).toBe(0);
  });

  it('never reports a negative percentage, and survives a zero initial time', () => {
    expect(preview({ secondsLeft: -10 }).timePercent).toBe(0);
    expect(() => preview({ initialSeconds: 0 })).not.toThrow();
  });

  it('leaves the first attempt free and charges every one after it', () => {
    // `-penalty * 0` is `-0`, which `toBe` tells apart from `0`. It is still
    // zero everywhere it matters — `t.common.points` prints it as "0", not
    // "-0" — so this asserts what the function really returns.
    expect(preview({ attempts: 0 }).attemptPenalty).toBe(-0);
    expect(preview({ attempts: 1 }).attemptPenalty).toBe(-SCORING.attemptPenalty);
    expect(preview({ attempts: 4 }).attemptPenalty).toBe(-SCORING.attemptPenalty * 4);
  });

  it('costs exactly one penalty per extra attempt on the total', () => {
    const free = preview({ attempts: 0 });
    const second = preview({ attempts: 1 });
    expect(second.total).toBe(free.total - SCORING.attemptPenalty);
  });

  it('counts the attempt it would solve on, not the ones already spent', () => {
    // Two rows submitted: solving now happens on the third.
    expect(preview({ attempts: 2 }).attempt).toBe(3);
    // Already solved: the attempt is the row it landed on.
    expect(preview({ attempts: 3, solved: true, solvedPosition: 1 }).attempt).toBe(3);
  });

  it('takes the place after everyone who already solved', () => {
    expect(preview({ solvedCount: 0 }).position).toBe(1);
    expect(preview({ solvedCount: 2 }).position).toBe(3);
    // Once solved the server's own position wins over the running count.
    expect(preview({ solved: true, solvedPosition: 2, solvedCount: 5 }).position).toBe(2);
  });

  it('pays a position bonus only for the places the contract lists', () => {
    SCORING.positionBonus.forEach((bonus, index) => {
      expect(preview({ solvedCount: index }).positionBonus).toBe(bonus);
    });
    expect(preview({ solvedCount: SCORING.positionBonus.length }).positionBonus).toBe(0);
  });

  it('pays the hint bonus only while the hint is both offered and unused', () => {
    expect(preview({ hintEnabled: true, hintUsed: false }).hintBonus).toBe(SCORING.hintKeptBonus);
    expect(preview({ hintEnabled: true, hintUsed: true }).hintBonus).toBe(0);
    expect(preview({ hintEnabled: false, hintUsed: false }).hintBonus).toBe(0);
  });

  it('never drops a solve below the flat solve bonus', () => {
    // No clock left, every attempt spent, no position, no hint: still the floor.
    const worst = preview({
      secondsLeft: 0,
      attempts: 20,
      solvedCount: 7,
      hintEnabled: true,
      hintUsed: true,
    });
    expect(worst.total).toBe(SCORING.solveBonus);
  });
});

describe('computeScorePreview · not solving', () => {
  it('pays per green and per yellow, and nothing else', () => {
    const p = preview({ finished: true, solved: false, greens: 3, yellows: 2 });
    expect(p.mode).toBe('unsolved');
    expect(p.greenPoints).toBe(3 * SCORING.pointsPerGreenUnsolved);
    expect(p.yellowPoints).toBe(2 * SCORING.pointsPerYellowUnsolved);
    expect(p.total).toBe(p.greenPoints + p.yellowPoints);
  });

  it('pays no hint bonus even when the hint was kept', () => {
    const p = preview({ finished: true, solved: false, hintEnabled: true, hintUsed: false });
    expect(p.hintKept).toBe(true);
    expect(p.hintBonus).toBe(0);
    expect(p.total).toBe(0);
  });

  it('stays in the solve branch while the round is still running', () => {
    expect(preview({ finished: false, solved: false }).mode).toBe('solve');
  });
});

describe('the rule the two branches have to keep between them', () => {
  it('makes the worst solve beat the best failure', () => {
    // The reason the floor and the cap were replaced by a flat bonus
    // (docs/context/04, 2026-09-12). Five greens would be a solve, so the best
    // a failure can reach is four greens and a yellow.
    const bestFailure =
      (DEFAULT_WORD_LENGTH - 1) * SCORING.pointsPerGreenUnsolved + SCORING.pointsPerYellowUnsolved;
    expect(bestFailure).toBeLessThan(SCORING.solveBonus);
  });
});
