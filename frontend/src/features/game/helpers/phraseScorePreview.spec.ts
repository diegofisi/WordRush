import { describe, expect, it } from 'vitest';

import { PHRASE_RULES, SCORING } from '@/shared/contract';

import { computePhraseScorePreview, type PhraseScorePreviewInput } from './phraseScorePreview';

const base: PhraseScorePreviewInput = {
  secondsLeft: 53,
  initialSeconds: 90,
  wordsSent: 3,
  sendsFailed: 1,
  completed: false,
  position: null,
  finished: false,
  completedCount: 1,
  percent: 45,
  teamMode: false,
};

const preview = (over: Partial<PhraseScorePreviewInput> = {}) =>
  computePhraseScorePreview({ ...base, ...over });

/** The mockup's score card: 59 % · +80 · 3 words · 1 miss · second -> 137. */
describe('computePhraseScorePreview', () => {
  it('matches the mockup total', () => {
    const p = preview();
    expect(p.timePoints).toBe(59);
    expect(p.wordPenalty).toBe(-12);
    expect(p.sendPenalty).toBe(-5);
    expect(p.position).toBe(2);
    expect(p.positionBonus).toBe(SCORING.positionBonus[1]);
    expect(p.total).toBe(137);
  });

  it('keeps the completion bonus as the floor', () => {
    expect(preview({ secondsLeft: 0, wordsSent: 6, sendsFailed: 4, completedCount: 5 }).total).toBe(
      PHRASE_RULES.completeBonus,
    );
  });

  it('pays only the uncovered share, minus the misses, once the round is over without the phrase', () => {
    const p = preview({ finished: true, percent: 45, sendsFailed: 1 });
    expect(p.mode).toBe('open');
    expect(p.uncoveredPoints).toBe(9);
    expect(p.total).toBe(4);
  });

  it('gives a team the first-team bonus only', () => {
    expect(preview({ teamMode: true, completedCount: 0 }).positionBonus).toBe(
      SCORING.teamFirstBonus,
    );
    expect(preview({ teamMode: true, completedCount: 1 }).positionBonus).toBe(0);
  });
});
