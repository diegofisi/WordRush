import { describe, expect, it } from 'vitest';

import { SCORING } from '@/shared/contract';

import { computeTeamScorePreview, type TeamScorePreviewInput } from './teamScorePreview';

/**
 * Team scoring (docs/context/06-v1.1.md): one score per team, every member's
 * words after their own first cost the team, only the first team to solve
 * gets a bonus, nothing at all when the team does not solve. Asserted against
 * the SCORING constants so a rebalance on the server changes the contract
 * rather than these numbers.
 */

const base: TeamScorePreviewInput = {
  secondsLeft: 45,
  initialSeconds: 90,
  attemptsAfterFirst: 0,
  myAttempts: 0,
  solved: false,
  solvedPosition: null,
  finished: false,
  solvedTeams: 0,
  hintEnabled: true,
  hintUsed: false,
};

const preview = (over: Partial<TeamScorePreviewInput> = {}) =>
  computeTeamScorePreview({ ...base, ...over });

describe('computeTeamScorePreview', () => {
  it('is a plain sum of the rows it shows', () => {
    const p = preview({ attemptsAfterFirst: 3, myAttempts: 2 });
    expect(p.total).toBe(
      p.timePoints + p.solveBonus + p.attemptPenalty + p.positionBonus + p.hintBonus,
    );
  });

  it('charges my next word to the team once I already sent one', () => {
    expect(preview({ attemptsAfterFirst: 2, myAttempts: 0 }).attemptsAfterFirst).toBe(2);
    expect(preview({ attemptsAfterFirst: 2, myAttempts: 1 }).attemptsAfterFirst).toBe(3);
    expect(preview({ attemptsAfterFirst: 2, myAttempts: 1 }).attemptPenalty).toBe(
      -3 * SCORING.attemptPenalty,
    );
  });

  it('gives the first-team bonus only while no rival team has solved', () => {
    expect(preview({ solvedTeams: 0 }).positionBonus).toBe(SCORING.teamFirstBonus);
    expect(preview({ solvedTeams: 1 }).positionBonus).toBe(0);
    expect(preview({ solved: true, solvedPosition: 2, finished: true }).positionBonus).toBe(0);
  });

  it('keeps the solve floor', () => {
    const p = preview({ secondsLeft: 0, attemptsAfterFirst: 20, solvedTeams: 1, hintUsed: true });
    expect(p.total).toBe(SCORING.solveBonus);
  });

  it('is worth nothing when the team ends the round without the word', () => {
    const p = preview({ finished: true, solved: false, attemptsAfterFirst: 4 });
    expect(p.mode).toBe('unsolved');
    expect(p.total).toBe(0);
  });

  it('freezes the attempts once solved instead of charging another word', () => {
    const p = preview({
      solved: true,
      finished: true,
      solvedPosition: 1,
      attemptsAfterFirst: 2,
      myAttempts: 3,
    });
    expect(p.attemptsAfterFirst).toBe(2);
  });
});
