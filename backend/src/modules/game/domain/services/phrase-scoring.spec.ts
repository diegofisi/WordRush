import { PHRASE_RULES, SCORING } from '@shared/contract';
import { scorePhraseRound, scoreTeamPhraseRound, type PhraseRoundResult } from './scoring';

const INITIAL = 90;

const result = (over: Partial<PhraseRoundResult> = {}): PhraseRoundResult => ({
  playerId: 'p',
  name: 'P',
  completed: true,
  position: 1,
  secondsLeftAtSolve: 53,
  wordsSent: 3,
  sendsFailed: 1,
  percent: 100,
  ...over,
});

/** docs/context/06-v1.1.md -> Guess the phrase, and the mockup's score card. */
describe('scorePhraseRound', () => {
  it('Diego on the mockup: 59 %, 3 words, 1 miss, second -> 137', () => {
    const b = scorePhraseRound(result({ position: 2 }), INITIAL);
    expect(b.timePoints).toBe(59);
    expect(b.solveBonus).toBe(PHRASE_RULES.completeBonus);
    expect(b.attemptPenalty).toBe(-3 * PHRASE_RULES.wordPenalty);
    expect(b.sendPenalty).toBe(-PHRASE_RULES.sendPenalty);
    expect(b.positionBonus).toBe(SCORING.positionBonus[1]);
    expect(b.roundPoints).toBe(59 + 80 - 12 - 5 + 15);
  });

  it('never drops a completed phrase below the completion bonus', () => {
    const b = scorePhraseRound(
      result({ secondsLeftAtSolve: 0, wordsSent: 6, sendsFailed: 4, position: 5 }),
      INITIAL,
    );
    expect(b.roundPoints).toBe(PHRASE_RULES.completeBonus);
  });

  it('pays the uncovered share, minus the misses, when the phrase is not completed', () => {
    const b = scorePhraseRound(
      result({ completed: false, position: null, percent: 45, sendsFailed: 1 }),
      INITIAL,
    );
    expect(b.solved).toBe(false);
    expect(b.uncoveredPoints).toBe(9);
    expect(b.sendPenalty).toBe(-5);
    expect(b.attemptPenalty).toBe(0);
    expect(b.roundPoints).toBe(4);
    expect(
      scorePhraseRound(result({ completed: false, percent: 10, sendsFailed: 5 }), INITIAL)
        .roundPoints,
    ).toBe(0);
  });

  it('gives a team the first-team bonus only', () => {
    const team = (position: number) =>
      scoreTeamPhraseRound(
        {
          team: 'a',
          name: '',
          color: 'violet',
          completed: true,
          solverId: 'p',
          solverName: 'P',
          position,
          secondsLeftAtSolve: 72,
          wordsSent: 5,
          sendsFailed: 0,
          percent: 100,
        },
        INITIAL,
      );
    expect(team(1).positionBonus).toBe(SCORING.teamFirstBonus);
    expect(team(1).roundPoints).toBe(80 + 80 - 20 + 20);
    expect(team(2).positionBonus).toBe(0);
  });
});
