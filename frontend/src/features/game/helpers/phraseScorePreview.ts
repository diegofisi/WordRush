import { PHRASE_RULES, SCORING } from '@/shared/contract';

/** docs/context/06-v1.1.md -> Guess the phrase, scoring. */
export interface PhraseScorePreviewInput {
  secondsLeft: number;
  initialSeconds: number;
  /** Words typed so far (every member's, in team mode). */
  wordsSent: number;
  sendsFailed: number;
  completed: boolean;
  /** 1-based completion order; null while open. */
  position: number | null;
  finished: boolean;
  /** Players (or teams) that already completed it. */
  completedCount: number;
  /** Share of the phrase uncovered, 0-100. */
  percent: number;
  teamMode: boolean;
}

export interface PhraseScorePreview {
  mode: 'complete' | 'open';
  timePercent: number;
  timePoints: number;
  completeBonus: number;
  wordsSent: number;
  wordPenalty: number;
  sendsFailed: number;
  sendPenalty: number;
  position: number;
  positionBonus: number;
  percent: number;
  uncoveredPoints: number;
  total: number;
}

/** Mirrors `scorePhraseRound` / `scoreTeamPhraseRound` with the contract's constants. */
export const computePhraseScorePreview = (input: PhraseScorePreviewInput): PhraseScorePreview => {
  const sendPenalty = -PHRASE_RULES.sendPenalty * input.sendsFailed;
  if (input.finished && !input.completed) {
    const uncoveredPoints = Math.round((input.percent / 100) * PHRASE_RULES.uncoveredMaxPoints);
    return {
      mode: 'open',
      timePercent: 0,
      timePoints: 0,
      completeBonus: 0,
      wordsSent: input.wordsSent,
      wordPenalty: 0,
      sendsFailed: input.sendsFailed,
      sendPenalty,
      position: 0,
      positionBonus: 0,
      percent: input.percent,
      uncoveredPoints,
      total: Math.max(0, uncoveredPoints + sendPenalty),
    };
  }
  const position = input.completed && input.position ? input.position : input.completedCount + 1;
  const positionBonus = input.teamMode
    ? position === 1
      ? SCORING.teamFirstBonus
      : 0
    : (SCORING.positionBonus[position - 1] ?? 0);
  const wordPenalty = -PHRASE_RULES.wordPenalty * input.wordsSent;
  const timePercent = Math.max(
    0,
    Math.round((input.secondsLeft / Math.max(1, input.initialSeconds)) * 100),
  );
  const total = Math.max(
    PHRASE_RULES.completeBonus,
    timePercent + PHRASE_RULES.completeBonus + wordPenalty + sendPenalty + positionBonus,
  );
  return {
    mode: 'complete',
    timePercent,
    timePoints: timePercent,
    completeBonus: PHRASE_RULES.completeBonus,
    wordsSent: input.wordsSent,
    wordPenalty,
    sendsFailed: input.sendsFailed,
    sendPenalty,
    position,
    positionBonus,
    percent: input.percent,
    uncoveredPoints: 0,
    total,
  };
};
