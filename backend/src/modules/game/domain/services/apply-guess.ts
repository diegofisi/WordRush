import type { LetterGain, TileColor } from '@shared/contract';
import type { PlayerRound } from '@modules/rooms/domain/entities/player-round.entity';
import { computeFeedback } from './color-feedback';
import { chargeGuess, totalSeconds } from './time-ledger';

export interface GuessRowOutcome {
  colors: TileColor[];
  gains: LetterGain[];
  secondsGained: number;
}

/**
 * Colours one guess, charges the time ledger and appends the row. The single
 * place a guess touches a round, so the fly and a human can never drift apart.
 *
 * `earnsTime` is the one difference between them: the fly forfeits every gain
 * instead of banking it, and the forfeited total is kept for the interface
 * (docs/context/06-boss-mode.md).
 */
export function applyGuessRow(
  round: PlayerRound,
  word: string,
  answer: string,
  earnsTime: boolean,
): GuessRowOutcome {
  const feedback = computeFeedback(word, answer);
  const gains = chargeGuess(round.charges, word, feedback);
  const secondsGained = totalSeconds(gains);
  if (earnsTime) {
    round.addSeconds(secondsGained);
  } else {
    round.forfeitedSeconds += secondsGained;
  }
  round.rows.push({ word, colors: feedback.colors });
  return { colors: feedback.colors, gains, secondsGained };
}
